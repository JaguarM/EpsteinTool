---
description: How to open shader_test.html (or any local HTML) in the browser scratchpad
---

# Opening Local HTML Files in the Browser Scratchpad

The browser subagent **cannot** open `file:///` URLs — they are blocked at the tool level.
Both Antigravity and Gemini hit this restriction.

## Workaround: Local HTTP Server

// turbo
1. Start a Python HTTP server in the directory containing `shader_test.html`:

```
python -m http.server 8765
```

Run this from the **project directory** (e.g. `c:\Users\yanni\Desktop\visualize_artifacts\test_image`).

2. Open the page via `http://localhost:8765/shader_test.html` in the browser subagent.

3. When done, terminate the server command by its command ID.

## Notes

- The server serves all files in the directory, so any images or assets referenced by relative paths will work.
- Port 8765 is arbitrary — pick any free port.
- The `image-rendering: pixelated` CSS in `shader_test.html` ensures textures render at 3× without interpolation for visual inspection, but pixel-level analysis must use the **native 256×64 resolution** via JS `readPixels` or canvas 2D `getImageData`.
- The WebGL canvas is 256×64 natively — screenshots are scaled by CSS and are NOT suitable for pixel-perfect comparison. Always extract raw pixel data via JavaScript.

## Pixel Data Extraction Pattern

To compare the WebGL output against the expected image at the native resolution, execute this JavaScript in the browser:

```javascript
// Read WebGL canvas pixels (bottom-up, RGBA)
var gl = document.getElementById('c').getContext('webgl');
var px = new Uint8Array(256 * 64 * 4);
gl.readPixels(0, 0, 256, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);

// Read expected image pixels
var img = document.querySelectorAll('img')[2]; // 3rd img = expected
var c2 = document.createElement('canvas');
c2.width = 256; c2.height = 64;
var ctx = c2.getContext('2d');
ctx.drawImage(img, 0, 0, 256, 64);
var exp = ctx.getImageData(0, 0, 256, 64).data;

// Compare — note WebGL is flipped vertically
var diffs = 0;
for (var y = 0; y < 64; y++) {
  for (var x = 0; x < 256; x++) {
    var gi = ((63 - y) * 256 + x) * 4; // WebGL bottom-up
    var ei = (y * 256 + x) * 4;        // Canvas top-down
    if (px[gi] !== exp[ei]) diffs++;
  }
}
'Total differing pixels: ' + diffs + ' / ' + (256*64);
```

This gives a single number to track progress toward pixel-perfect matching.
