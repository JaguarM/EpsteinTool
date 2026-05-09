---
home: true
heroImage: null
actions:
  - text: Get Started
    link: /architecture/architecture-overview.html
    type: primary
  - text: API Reference
    link: /api-reference/api-reference.html
    type: secondary
features:
  - title: Redaction Detection
    details: OpenCV-based row scanning detects precise 816x1056px redaction boundaries in scanned PDF images.
  - title: Width Matching
    details: High-precision HarfBuzz text shaping measures candidate names against detected pixel widths.
  - title: WebGL Visualization
    details: GPU-accelerated masks provide real-time interactive overlays for visual verification.
footer: MIT Licensed | Copyright © 2026
---

# Epstein Unredactor Documentation

Welcome to the technical documentation for the Epstein Unredactor. This guide covers the internal logic, architecture, and deployment strategies for analyzing redacted documents.

## Core Concepts

The tool operates on a "Core + Plugin" architecture with a declarative tool registry:

- **Core (`guesser_core`)**: Handles PDF parsing, image extraction, redaction box detection, and the base viewer template. Provides the `PDFTool` base class and `@register_tool` decorator.
- **Plugins**: Optional features (WebGL masking, typography tools, OCR, etc.) are isolated into independent Django apps. Each plugin defines a `tool.py` subclassing `PDFTool` — the registry auto-discovers styles, templates, scripts, and URL routes.
- **Adding a tool**: Create the app folder with a `tool.py` and `apps.py`. Django auto-discovers it — no changes to `index.html`, `urls.py`, or `settings.py`.
- **Removing a tool**: Delete the folder. Done.

## Navigation

- **[Architecture Overview](./architecture/architecture-overview.md)**: Understand the high-level system design.
- **[Tool Expansion Guide](./tool-expansion-guide.md)**: How to add new plugins using the PDFTool registry.
- **[Backend Logic](./redaction-processing/backend-logic.md)**: Deep dive into the Python processing pipeline.
- **[Frontend Implementation](./frontend/javascript-module-reference.md)**: Explore the vanilla JS and WebGL rendering engine.
- **[API Reference](./api-reference/api-reference.md)**: Detailed documentation of all JSON endpoints.
- **[Setup & Deployment](./setup-and-deployment/setup-deployment.md)**: Instructions for local development and production.
