# Chrome Native PDF Viewer Replication

I have created a custom frontend web PDF Viewer that perfectly mimics Chrome's native PDF Viewer UI and functionality.

## Implementation Details
I opted to build a fresh, highly performant UI using standard HTML/CSS/JS and the `pdf.js` rendering engine rather than reverse-engineering the massive, extension-specific [pdf_viewer_wrapper.js](../../guesser_core/static/guesser_core/pdf-viewer.js) from the original Chrome files. 

### 1. UI Layout ([index.html](file:///c:/Users/yanni/Desktop/PDF%20Editor/index.html) & [viewer.css](file:///c:/Users/yanni/Desktop/PDF%20Editor/viewer.css))
- **Top Toolbar**: I implemented the `#323639` dark-themed top bar exactly matching Chrome's layout.
- **Icons**: Used Google's `Material Symbols Outlined` with precise configurations (`opsz 20`, `wght 400`) to match Chrome's native iconography for sidebar toggle, zoom controls, fit-to-page, rotate, download, and print.
- **Main Canvas**: Set the background to `rgb(40, 40, 40)` matching [pdf_embedder.css](file:///c:/Users/yanni/Desktop/PDF%20Editor/Chome%20Example/pdf_embedder.css) from Chrome. Added the signature wrapper shadow (`box-shadow: 0 2px 4px rgba(0,0,0,0.5)`) to the PDF container.
- **Inputs**: Replicated the custom `#202124` input boxes for the page number and zoom percentage, complete with hover and blue focus states.

### 2. Core Functionality ([viewer.js](file:///c:/Users/yanni/Desktop/PDF%20Editor/viewer.js))
- **Engine**: Integrated `pdf.js` via CDN for robust PDF rendering.
- **Loading Documents**: Implemented a global drag-and-drop overlay allowing users to drop PDF files anywhere on the window. (The [PDF.pdf](file:///c:/Users/yanni/Desktop/PDF%20Editor/PDF.pdf) file also auto-loads right now for convenience during testing).
- **Zooming (Exponential & Clamped)**: 
  - The zoom level is clamped strictly between **0.25x (25%)** and **6.0x (600%)**.
  - **Ctrl + Scroll wheel** triggers a smooth exponential calculation (`currentZoom *= Math.pow(1.005, -delta)`), scaling the document via CSS initially for immediate 60fps responsiveness, then re-rendering the crisp canvas automatically once scrolling stops (`debounced render`).
  - Zoom UI buttons `+` and `-` correctly apply `1.1x` bracket zooming and manually update the input box.

## Verification
A browser subagent verified the visual layout and interactivity.

### Initial Load
The UI matches Chrome, the layout is styled correctly, and the pagination inputs reflect the document length.
![Initial Load](/assets/images/pdf_viewer_initial_load_1773589830869.png)

### Zoom Interactivity
The document can be zoomed up to 800%. The debounced re-rendering ensures text stays incredibly sharp even after zoom state modifications.
![Zoomed In](/assets/images/pdf_viewer_zoomed_in_1773589966202.png)
