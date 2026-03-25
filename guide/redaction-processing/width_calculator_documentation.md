# width_calculator.py Documentation

[width_calculator.py](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/width_calculator.py) provides precision text width measurement for candidate name matching. It uses HarfBuzz for accurate OpenType shaping with full kerning and ligature support, falling back to Pillow if HarfBuzz is unavailable.

## Functions

### `get_text_widths(texts, font_name, font_size, force_uppercase, scale_factor, kerning, ligatures)`

Calculates pixel widths for a list of text strings.

**Inputs:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `texts` | list[str] | — | Strings to measure |
| `font_name` | str | `"times.ttf"` | Font filename |
| `font_size` | int | `12` | Font size in points |
| `force_uppercase` | bool | `False` | Convert text to uppercase before measuring |
| `scale_factor` | float | `1.35` | Multiplier applied to the raw width |
| `kerning` | bool | `True` | Enable OpenType `kern` feature |
| `ligatures` | bool | `True` | Enable `liga` and `clig` features |

**Output:**
```python
[{"text": "Jeffrey Epstein", "width": 89.472}, ...]
```

### Font Resolution

The font is searched in this order:
1. Direct path (`font_name` as-is)
2. `assets/fonts/{font_name}`
3. `assets/fonts/{font_name}.ttf`

System font directories are intentionally excluded to ensure consistent results across environments.

### HarfBuzz Engine (Primary)

When `uharfbuzz` is available:

```python
face = hb.Face(font_data)
font = hb.Font(face)
upem = face.upem   # units per em

buf = hb.Buffer()
buf.add_str(text)
buf.guess_segment_properties()

hb.shape(font, buf, features)

total_advance = sum(pos.x_advance for pos in buf.glyph_positions)
pixel_width = (total_advance / upem) * font_size * scale_factor
```

**Features controlled:**
| Feature | Enabled | Disabled |
|---------|---------|----------|
| `kern` | Default | `kerning=False` |
| `liga` | Default | `ligatures=False` |
| `clig` | Default | `ligatures=False` |
| `dlig` | Never | `ligatures=False` |

### Pillow Fallback

If HarfBuzz fails or is not installed, falls back to `ImageFont.truetype()` with `font.getlength()`. This method does not support fine-grained kerning/ligature control.

---

### `get_available_fonts()`

Scans the `assets/fonts/` directory and returns a list of `.ttf` filenames.

**Output:** `["times.ttf", "arial.ttf", ...]`

Used by the `/fonts-list` API endpoint to populate the frontend font dropdown.

---

## Scale Factor

The `scale_factor` converts from typographic units to the pixel space used by the redaction box coordinates. The default `1.35` corresponds to the ratio needed for 12pt text at approximately 96 DPI. The frontend auto-calculates a `suggested_scale` of ~178 (i.e., `1.78`) based on the detected font size and page resolution ratio `(816/612)²`.
