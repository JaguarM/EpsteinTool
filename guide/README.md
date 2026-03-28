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

The tool operates on a "Core + Plugin" architecture:

- **Core**: Handles PDF parsing, image extraction, and basic redaction box detection.
- **Plugins**: Optional features like WebGL masking and typography tools are isolated into independent Django apps for modularity.

## Navigation

- **[Architecture Overview](./architecture/architecture-overview.md)**: Understand the high-level system design.
- **[Backend Logic](./redaction-processing/backend-logic.md)**: Deep dive into the Python processing pipeline.
- **[Frontend Implementation](./frontend/JavaScript%20module-reference.md)**: Explore the vanilla JS and WebGL rendering engine.
- **[API Reference](./api-reference/api-reference.md)**: Detailed documentation of all JSON endpoints.
- **[Setup & Deployment](./setup-and-deployment/setup-deployment.md)**: Instructions for local development and production.
