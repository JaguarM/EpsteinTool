/* WebGL Mask Overlays extracted from pdf-viewer.js */
const webglContexts = new Map();
const maskBlobCache = new Map();

const webglObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const pageNum = parseInt(entry.target.dataset.pageNum);
    const canvas = entry.target.querySelector('.webgl-overlay');

    if (entry.isIntersecting) {
      if (!webglContexts.has(pageNum) && canvas) {
        initWebGLOverlay(canvas, pageNum);
      }
    } else {
      if (webglContexts.has(pageNum)) {
        destroyWebGLOverlay(pageNum);
      }
    }
  });
}, { root: null, rootMargin: '100% 0px', threshold: 0 });

function setupWebGLOverlay(pageContainer, _webglCanvas, pageNum) {
  pageContainer.dataset.pageNum = pageNum;
  webglObserver.observe(pageContainer);
}

function clearWebGLContexts() {
  for (const [, ctx] of webglContexts.entries()) {
    if (ctx && ctx.gl) {
      const loseCtx = ctx.gl.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
    }
  }
  webglContexts.clear();
  maskBlobCache.clear();
  webglObserver.disconnect();
}

function destroyWebGLOverlay(pageNum) {
  const ctx = webglContexts.get(pageNum);
  if (!ctx) return;
  if (ctx.gl) {
    const loseCtx = ctx.gl.getExtension('WEBGL_lose_context');
    if (loseCtx) loseCtx.loseContext();
  }
  webglContexts.delete(pageNum);
}

async function initWebGLOverlay(canvas, pageNum) {
  try {
    webglContexts.set(pageNum, { loading: true });

    let blob;
    if (maskBlobCache.has(pageNum)) {
      blob = maskBlobCache.get(pageNum);
    } else {
      // Use inline mask data from the initial upload response
      const maskDataUrl = state.maskImages && state.maskImages[pageNum - 1];
      if (!maskDataUrl) {
        canvas.style.display = 'none';
        webglContexts.delete(pageNum);
        return;
      }
      const res = await fetch(maskDataUrl);
      blob = await res.blob();
      maskBlobCache.set(pageNum, blob);
    }

    const img = new Image();
    img.onload = () => {
      if (!webglContexts.has(pageNum)) return; // Was destroyed before load

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const gl = canvas.getContext('webgl', { antialias: false }) || canvas.getContext('experimental-webgl', { antialias: false });
      if (!gl) {
        webglContexts.delete(pageNum);
        return;
      }

      const vsSource = `
        attribute vec2 aPosition;
        varying vec2 vTexCoord;
        void main() {
          gl_Position = vec4(aPosition, 0.0, 1.0);
          vTexCoord = vec2((aPosition.x + 1.0) / 2.0, 1.0 - (aPosition.y + 1.0) / 2.0);
        }
      `;

      const fsSource = `
        precision mediump float;
        varying vec2 vTexCoord;
        uniform sampler2D uMask;
        uniform vec3 uColor;
        uniform float uOpacity;
        void main() {
          float maskVal = texture2D(uMask, vTexCoord).r;
          float alpha = maskVal * uOpacity;
          vec3 invColor = 1.0 - uColor;
          gl_FragColor = vec4(invColor * alpha, alpha);
        }
      `;

      function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      }

      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);

      const positionLocation = gl.getAttribLocation(program, "aPosition");
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
      ]), gl.STATIC_DRAW);

      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      const uColorLoc = gl.getUniformLocation(program, "uColor");
      const uOpacityLoc = gl.getUniformLocation(program, "uOpacity");

      webglContexts.set(pageNum, { gl, program, texture, uColorLoc, uOpacityLoc });

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img);
      requestAnimationFrame(() => updateWebGLUniforms(pageNum));
    };
    img.src = URL.createObjectURL(blob);
  } catch (e) {
    console.error("Could not load mask", e);
    canvas.remove();
    webglContexts.delete(pageNum);
  }
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255.0,
    parseInt(result[2], 16) / 255.0,
    parseInt(result[3], 16) / 255.0
  ] : [0, 0, 0];
}

function updateWebGLUniforms(specificPage = null) {
  const colorHex = els.maskColor ? els.maskColor.value : "#000000";
  const rgb = hexToRgb(colorHex);
  const opacity = els.edgeSubtract ? els.edgeSubtract.value / 255.0 : 1.0;

  const pagesToUpdate = specificPage ? [specificPage] : Array.from(webglContexts.keys());

  pagesToUpdate.forEach(p => {
    const ctx = webglContexts.get(p);
    if (!ctx || !ctx.gl) return;
    const { gl, program, uColorLoc, uOpacityLoc } = ctx;
    gl.useProgram(program);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3fv(uColorLoc, rgb);
    gl.uniform1f(uOpacityLoc, opacity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  });
}
