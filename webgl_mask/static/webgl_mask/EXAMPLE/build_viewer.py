import os
import sys
import base64
import fitz
from io import BytesIO

import numpy as np
from PIL import Image

# Add project root so we can import from the main app
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, _PROJECT_ROOT)

from webgl_mask.logic.artifact_visualizer import build_mask_array, PAGE_W, PAGE_H

SOURCE_PDF = "PDF.pdf"


def render_rgb(page):
    mat = fitz.Matrix(PAGE_W / page.rect.width, PAGE_H / page.rect.height)
    return page.get_pixmap(matrix=mat, colorspace=fitz.csRGB).tobytes("png")


def make_mask(page_png, base, page_number):
    path = f"{base}_mask_p{page_number}.png"
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()

    rendered = np.array(Image.open(BytesIO(page_png)).convert("L"))
    m = build_mask_array(rendered)
    if m is None:
        m = np.zeros((PAGE_H, PAGE_W), np.uint8)

    buf = BytesIO()
    Image.fromarray(m, "L").save(buf, "PNG")
    return buf.getvalue()


def to_b64(data):
    return base64.b64encode(data).decode()


HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redaction Viewer</title>
  <style>
    body {
      margin: 0;
      background: #111;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: sans-serif;
    }

    #bar {
      color: #eee;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    #bar button {
      font-size: 1rem;
      cursor: pointer;
    }

    #bar input[type="range"] {
      width: 220px;
    }

    #viewport {
      overflow: hidden;
      width: 100vw;
      height: calc(100vh - 48px);
      cursor: grab;
      position: relative;
    }

    #viewport:active {
      cursor: grabbing;
    }

    canvas {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: top left;
    }
  </style>
</head>
<body>
  <div id="bar">
    <button id="prev">&#9664;</button>
    <span>Page <span id="pn">1</span> / <span id="pt"></span></span>
    <button id="next">&#9654;</button>
    <label for="sl">Mask opacity:</label>
    <input type="range" id="sl" min="0" max="1" step="0.01" value="0.5">
  </div>
  <div id="viewport">
    <canvas id="c"></canvas>
  </div>

  <script>
    const PAGES = [$PAGES$];

    const canvas = document.getElementById('c');
    canvas.width = 816;
    canvas.height = 1056;

    const gl = canvas.getContext('webgl');
    document.getElementById('pt').textContent = PAGES.length;

    const vertSrc = `
      attribute vec2 aPos;
      varying vec2 vUV;
      void main() {
        vUV = aPos * 0.5 + 0.5;
        vUV.y = 1.0 - vUV.y;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

    const fragSrc = `
      precision mediump float;
      uniform sampler2D uPage;
      uniform sampler2D uMask;
      uniform float uStrength;
      varying vec2 vUV;
      void main() {
        vec4 page = texture2D(uPage, vUV);
        float m = texture2D(uMask, vUV).r;
        // Lift pixels that are darker than the mask; leave lighter pixels untouched.
        // max(page, m*strength): dark pixels rise to mask level, bright pixels unchanged.
        gl_FragColor = vec4(max(page.rgb, vec3(m * uStrength)), 1.0);
      }
    `;

    function compileShader(type, src) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uPage     = gl.getUniformLocation(prog, 'uPage');
    const uMask     = gl.getUniformLocation(prog, 'uMask');
    const uStrength = gl.getUniformLocation(prog, 'uStrength');
    gl.uniform1i(uPage, 0);
    gl.uniform1i(uMask, 1);

    function loadTexture(slot, b64src, format, onLoad) {
      const tex = gl.createTexture();
      const img = new Image();
      img.onload = () => {
        gl.activeTexture(gl.TEXTURE0 + slot);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, img);
        // Use NEAREST for the mask so edges don't bleed into surrounding pixels
        const filter = slot === 1 ? gl.NEAREST : gl.LINEAR;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        onLoad();
      };
      img.src = 'data:image/png;base64,' + b64src;
    }

    let currentPage = 0;
    let readyCount = 0;

    function draw() {
      gl.uniform1f(uStrength, parseFloat(document.getElementById('sl').value));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function loadPage(index) {
      readyCount = 0;
      const onLoad = () => { if (++readyCount === 2) draw(); };
      loadTexture(0, PAGES[index][0], gl.RGB,       onLoad);
      loadTexture(1, PAGES[index][1], gl.LUMINANCE, onLoad);
    }

    // Zoom and pan
    const viewport = document.getElementById('viewport');
    let scale = 1.0;
    let panX = 0;
    let panY = 0;

    function fitToViewport() {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      scale = Math.min(vw / canvas.width, vh / canvas.height);
      panX = (vw - canvas.width  * scale) / 2;
      panY = (vh - canvas.height * scale) / 2;
      applyTransform();
    }

    function applyTransform() {
      canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.max(0.1, Math.min(10, scale * factor));
      panX = mx - (mx - panX) * (newScale / scale);
      panY = my - (my - panY) * (newScale / scale);
      scale = newScale;
      applyTransform();
    }, { passive: false });

    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    viewport.addEventListener('mousedown', (e) => {
      dragging = true;
      dragStartX = e.clientX - panX;
      dragStartY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panX = e.clientX - dragStartX;
      panY = e.clientY - dragStartY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => { dragging = false; });

    document.getElementById('sl').addEventListener('input', draw);

    document.getElementById('prev').addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage--;
        document.getElementById('pn').textContent = currentPage + 1;
        loadPage(currentPage);
      }
    });

    document.getElementById('next').addEventListener('click', () => {
      if (currentPage < PAGES.length - 1) {
        currentPage++;
        document.getElementById('pn').textContent = currentPage + 1;
        loadPage(currentPage);
      }
    });

    fitToViewport();
    loadPage(0);
  </script>
</body>
</html>
"""


def main():
    doc = fitz.open(SOURCE_PDF)
    base = os.path.splitext(SOURCE_PDF)[0]

    page_entries = []
    for i, page in enumerate(doc):
        png = render_rgb(page)
        mask = make_mask(png, base, i + 1)
        page_entries.append(f'["{to_b64(png)}", "{to_b64(mask)}"]')

    doc.close()

    out = HTML_TEMPLATE.replace("$PAGES$", ",\n    ".join(page_entries))
    with open("viewer.html", "w", encoding="utf-8") as f:
        f.write(out)

    print(f"viewer.html written ({len(page_entries)} pages)")


if __name__ == "__main__":
    main()
