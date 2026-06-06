# Epstein Unredactor

A tool that analyzes scanned PDF documents to detect black redaction bars and guesses which names could fit underneath by matching text widths.

## How It Works

1. Upload a PDF with redacted (blacked-out) names
2. The tool detects redaction bars, fonts and measures their pixel width
3. Enter additional candidate names, change box size or font settings
4. Names whose width matches a redaction bar are highlighted as potential matches

## Install & Run (Windows)

> **Requires:** [Python 3.10+](https://www.python.org/downloads/) installed and added to PATH.

Double-click **`run_app.bat`** — it installs dependencies and opens the app in your browser automatically.

## Install & Run (Linux)

```bash
chmod +x setup.sh
./setup.sh
```

## Documentation
Look at the complete documentation at [github.io](https://jaguarm.github.io/EpsteinTool/)!
