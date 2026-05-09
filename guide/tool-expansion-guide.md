# Tool Expansion Guide

A reference for adding new plugins to EpsteinTool. Read the architecture section first — it explains the conventions every plugin relies on.

---

## Architecture Overview

### The Plugin System

Plugins are standard Django apps that register themselves with the **PDFTool registry**. Each plugin defines a `tool.py` containing a class that inherits from `PDFTool` and is decorated with `@register_tool`:

```python
# my_tool/tool.py
from guesser_core.base import PDFTool
from guesser_core.registry import register_tool

@register_tool
class MyTool(PDFTool):
    name = 'my_tool'
    toolbar_button = 'my_tool/toolbar_button.html'
    # ... override only the fields you need
```

The plugin's `apps.py` triggers registration with a single import:

```python
# my_tool/apps.py
from django.apps import AppConfig

class MyToolConfig(AppConfig):
    name = 'my_tool'

    def ready(self):
        import my_tool.tool  # noqa: F401 — registers MyTool
```

`guesser_core/templates/guesser_core/index.html` iterates the registry to inject each tool's styles, toolbar buttons, options bars, sidebars, and scripts. **No manual edits to `index.html` are needed.**

URL routes declared on the PDFTool class are auto-discovered by `epstein_project/urls.py`. **No manual edits to `urls.py` are needed.**

`settings.py` dynamically scans the project directory for folders containing `apps.py` and auto-appends them to `INSTALLED_APPS`. **Dropping a plugin folder in enables it; deleting it disables it. No `settings.py` edits needed.**

### PDFTool Base Class

All available fields with their defaults (`guesser_core/base.py`):

```python
class PDFTool:
    name = None                       # Required — e.g. 'my_tool'

    # URL routing
    url_prefix = ''                   # path prefix for include()
    url_module = None                 # dotted path to urls.py, or None

    # Template slots
    styles = ()                       # tuple/list of {'path': '...'} dicts
    toolbar_button = None             # template path for toolbar button
    options_bar = None                # template path for options bar
    sidebar = None                    # template path for sidebar panel
    shows_text_options_bar = False    # include shared text_options_bar.html
    has_sidebar_toggle = False        # contributes a sidebar toggle button

    # Script injection
    scripts_before_viewer = ()        # scripts loaded before pdf-viewer.js
    scripts_after_app = ()            # scripts loaded after app.js
```

Base class uses **tuples** for sequence defaults to avoid the mutable-default-on-a-class-attribute trap. Subclasses can safely assign lists.

### Global JavaScript Objects

Two objects are defined in `guesser_core/static/guesser_core/state.js` and are available to all plugin scripts:

- **`state`** — application state (current page, zoom, redactions, candidates, etc.)
- **`els`** — cached DOM element references (viewer, toolbars, sidebar buttons, etc.)

### Script Load Order

Scripts load in this order, controlled by the `scripts_before_viewer` and `scripts_after_app` fields on each PDFTool:

```
state.js
  → [tool.scripts_before_viewer for each registered tool]
  → pdf-viewer.js
  → ui-events.js
  → app.js                ← defines window.openSubtoolbar, window.openRightPanel
  → mobile.js
  → [tool.scripts_after_app for each registered tool]
```

Scripts in `scripts_before_viewer` run before `app.js`, so they cannot call `app.js` functions at module scope — only inside event handlers. Scripts in `scripts_after_app` can safely reference `app.js` globals.

### Two UI Patterns

There are two distinct plugin UI patterns. Choose one based on what your tool needs:

| Pattern | Used by | Adds |
|---|---|---|
| **Subtoolbar** | `webgl_mask`, `embedded_text_viewer` | A toolbar button that swaps the options bar row |
| **Right Panel** | `redaction_matching` | A toolbar button that opens a full-height side panel |

---

## Pattern A — Subtoolbar Plugin

Use this when your tool needs a row of controls (sliders, selects, checkboxes) rather than a persistent panel. Examples: `webgl_mask`, `embedded_text_viewer` formatting bar.

The subtoolbar row is mutually exclusive — only one bar is visible at a time. This is enforced by `window.openSubtoolbar`, defined in `app.js`.

### File Structure

```
my_tool/
  apps.py                  ← AppConfig with ready() importing tool.py
  tool.py                  ← PDFTool subclass with @register_tool
  templates/my_tool/
    toolbar_button.html    ← button injected into #toolbar-right
    options_bar.html       ← bar injected into #text-toolbar-row
  static/my_tool/
    my-tool.js             ← toggle logic + tool behaviour
  views.py, urls.py, ...
```

### Step 1 — Define Your Tool

```python
# my_tool/tool.py
from guesser_core.base import PDFTool
from guesser_core.registry import register_tool

@register_tool
class MyTool(PDFTool):
    name = 'my_tool'
    url_module = 'my_tool.urls'        # omit if no backend routes
    toolbar_button = 'my_tool/toolbar_button.html'
    options_bar = 'my_tool/options_bar.html'
    scripts_after_app = [
        {'path': 'my_tool/my-tool.js', 'version': 'v=1'},
    ]
```

### Step 2 — AppConfig

```python
# my_tool/apps.py
from django.apps import AppConfig

class MyToolConfig(AppConfig):
    name = 'my_tool'

    def ready(self):
        import my_tool.tool  # noqa: F401
```

### Step 3 — Toolbar Button

```html
<!-- templates/my_tool/toolbar_button.html -->
<button id="toggle-my-tool" class="icon-button" title="My Tool">
  <span class="material-symbols-outlined">your_icon_name</span>
</button>
```

### Step 4 — Options Bar

Start with `class="options-bar hidden"`. The bar must be hidden by default; `openSubtoolbar` manages visibility from here.

```html
<!-- templates/my_tool/options_bar.html -->
<div id="my-tool-bar" class="options-bar hidden">
  <div class="options-divider"></div>
  <div class="options-group">
    <div class="options-group-header">My Setting</div>
    <div class="options-group-controls">
      <input type="range" id="my-slider" min="0" max="100" value="50">
    </div>
  </div>
</div>
```

### Step 5 — JavaScript Toggle

Call `openSubtoolbar` inside the click handler. Because `app.js` loads before `scripts_after_app`, you can safely reference `openSubtoolbar` directly. If your script is in `scripts_before_viewer` instead, guard the call with `typeof openSubtoolbar === 'function'`.

```js
// static/my_tool/my-tool.js

document.getElementById('toggle-my-tool')?.addEventListener('click', () => {
  const bar = document.getElementById('my-tool-bar');
  const btn = document.getElementById('toggle-my-tool');

  if (bar.classList.contains('hidden')) {
    // Open: hand off to the global coordinator
    if (typeof openSubtoolbar === 'function') openSubtoolbar(bar, btn);
    else { bar.classList.remove('hidden'); btn.classList.add('active'); }
  } else {
    // Close: revert to the default text-options-bar
    if (typeof openSubtoolbar === 'function') openSubtoolbar(null, null);
    else { bar.classList.add('hidden'); btn.classList.remove('active'); }
  }
});
```

### Step 6 — Register `openSubtoolbar` Awareness in `app.js`

`window.openSubtoolbar` in `app.js` hides all known bars when switching. Add your new bar to its hide list so it closes when another tool opens:

```js
// guesser_core/static/guesser_core/app.js — inside openSubtoolbar()
document.getElementById('my-tool-bar')?.classList.add('hidden');
document.getElementById('toggle-my-tool')?.classList.remove('active');
```

That's it. No changes to `index.html`, `urls.py`, or `settings.py` — the registry and dynamic discovery handle everything.

---

## Pattern B — Right Panel Plugin

Use this when your tool needs a persistent, scrollable side panel. The right panel area is mutually exclusive with the AI Unredactor Tools sidebar — opening one closes the other.

### File Structure

```
my_panel/
  apps.py                  ← AppConfig with ready() importing tool.py
  tool.py                  ← PDFTool subclass with @register_tool
  templates/my_panel/
    toolbar_button.html    ← button injected into #toolbar-right
    panel.html             ← <aside> injected as sidebar
  static/my_panel/
    my-panel.js            ← open/close logic + panel behaviour
  views.py, urls.py, ...
```

### Step 1 — Define Your Tool

```python
# my_panel/tool.py
from guesser_core.base import PDFTool
from guesser_core.registry import register_tool

@register_tool
class MyPanel(PDFTool):
    name = 'my_panel'
    toolbar_button = 'my_panel/toolbar_button.html'
    sidebar = 'my_panel/panel.html'
    has_sidebar_toggle = True    # if this tool should control sidebar visibility
    scripts_after_app = [
        {'path': 'my_panel/my-panel.js', 'version': 'v=1'},
    ]
```

### Step 2 — AppConfig

```python
# my_panel/apps.py
from django.apps import AppConfig

class MyPanelConfig(AppConfig):
    name = 'my_panel'

    def ready(self):
        import my_panel.tool  # noqa: F401
```

### Step 3 — Toolbar Button

```html
<!-- templates/my_panel/toolbar_button.html -->
<button id="toggle-my-panel" class="icon-button" title="My Panel">
  <span class="material-symbols-outlined">your_icon_name</span>
</button>
```

### Step 4 — Panel HTML

The panel is included inside `#tools-sidebar` via the `sidebar` field. The template auto-includes it when iterating registered tools.

```html
<!-- templates/my_panel/panel.html -->
<div id="my-panel">
  <div id="my-panel-header">
    <span>My Panel</span>
  </div>
  <!-- panel content -->
</div>
```

### Step 5 — JavaScript Toggle

Right panels manage their own open/close. When **opening**, close other sidebars to enforce mutual exclusivity:

```js
// static/my_panel/my-panel.js

function openMyPanel() {
  // Mutual exclusivity: close the tools sidebar if open
  document.getElementById('tools-sidebar')?.classList.add('hidden');
  document.getElementById('toggle-tools')?.classList.remove('active');

  document.getElementById('my-panel').classList.remove('hidden');
  document.getElementById('toggle-my-panel').classList.add('active');
}

function closeMyPanel() {
  document.getElementById('my-panel').classList.add('hidden');
  document.getElementById('toggle-my-panel').classList.remove('active');
}

document.getElementById('toggle-my-panel')?.addEventListener('click', () => {
  document.getElementById('my-panel').classList.contains('hidden')
    ? openMyPanel()
    : closeMyPanel();
});
```

### Step 6 — Make `#tools-sidebar` Aware of Your Panel

When `#tools-sidebar` opens, it should close your panel. Add your panel to the `openRightPanel` function in `app.js`:

```js
// guesser_core/static/guesser_core/app.js — inside openRightPanel()
document.getElementById('my-panel')?.classList.add('hidden');
document.getElementById('toggle-my-panel')?.classList.remove('active');
```

That's it. No changes to `index.html`, `urls.py`, or `settings.py`.

---

## Adding a Backend API Endpoint

If your plugin needs to process data server-side, define your URL routing on the PDFTool class:

**`tool.py`** — set `url_prefix` and `url_module`:
```python
@register_tool
class MyTool(PDFTool):
    name = 'my_tool'
    url_prefix = 'my-tool/'           # routes will be prefixed: /my-tool/...
    url_module = 'my_tool.urls'       # points to your urls.py
    # ... other fields
```

**`views.py`** — write your view, returning `JsonResponse`:
```python
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def my_endpoint(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    # ... your logic ...
    return JsonResponse({'result': ...})
```

**`urls.py`** — register the route:
```python
from django.urls import path
from . import views

urlpatterns = [
    path('my-endpoint', views.my_endpoint, name='my_endpoint'),
]
```

The route is auto-discovered from `tool.url_module` — no need to edit `epstein_project/urls.py`.

> **Note for backend-only apps** (no UI, no PDFTool): Apps like `extracted_text` that only provide API endpoints can still use the legacy `AppConfig` approach with `url_prefix` and `url_module` as class attributes on the AppConfig. The URL auto-discovery falls back to AppConfig for apps without a registered PDFTool.

---

## Existing Plugins — Quick Reference

| App | Type | PDFTool class | Toggle Button ID | Bar / Panel ID |
|---|---|---|---|---|
| `text_tool` | Subtoolbar | `TextTool` | `toggle-text-tool` | `text-tool-bar` |
| `webgl_mask` | Subtoolbar | `WebglMaskTool` | `toggle-webgl` | `webgl-options-bar` |
| `embedded_text_viewer` | Subtoolbar | `EmbeddedTextViewerTool` | `toggle-embedded-viewer` | `etv-bar` |
| `tesseract_ocr` | Toolbar button | `TesseractOcrTool` | `toggle-ocr` | — |
| `redaction_matching` | Right Panel | `RedactionMatchingTool` | `toggle-tools` | `tools-sidebar` |
| `extracted_text` | Backend-only | *(none)* | — | — |
| `guesser_core` | Core (always on) | *(none)* | — | `text-options-bar` |

---

## Checklist — Adding a New Tool

1. **Create the Django app directory** (`my_tool/`)
2. **Write `my_tool/tool.py`** — subclass `PDFTool`, decorate with `@register_tool`, override only what you need
3. **Write `my_tool/apps.py`** — `ready()` does `import my_tool.tool`
4. **Create templates** — `toolbar_button.html`, `options_bar.html`, and/or `sidebar.html`
5. **Create static assets** — JS and CSS files referenced in your tool class
6. *(Optional)* If using subtoolbar: add your bar to `openSubtoolbar()` hide list in `app.js`
7. *(Optional)* If using right panel: add your panel to `openRightPanel()` hide list in `app.js`

**Zero changes needed to**: `index.html`, `epstein_project/urls.py`, `settings.py`, or any other plugin's code.

**To disable a plugin**: delete its folder. Django's dynamic discovery in `settings.py` won't find it and the app simply won't load.

---

## Best Practices

- **Never use `display: block` directly.** Always toggle the `.hidden` class. Sidebars use CSS transitions keyed on `.hidden`; bypassing it breaks animations.
- **Use optional chaining (`?.`) on all `getElementById` calls** in plugin JS. This ensures your script doesn't throw if the plugin is removed.
- **Guard `openSubtoolbar` calls** with `typeof openSubtoolbar === 'function'` when your script is in `scripts_before_viewer`. Scripts in `scripts_after_app` can reference it directly.
- **Keep plugin logic self-contained.** Views, URLs, and business logic belong in the plugin app. The only cross-plugin touchpoints are `openSubtoolbar` (subtoolbar pattern) and the two lines in `openRightPanel` (right-panel pattern).
- **Disable by deleting the folder.** `settings.py` dynamically scans for plugin directories — removing the folder is the off-switch. No manual `INSTALLED_APPS` edits needed.
- **Use tuples or lists for tool config fields.** The base class uses tuples for immutable defaults, but subclasses can safely assign lists. Both work in Django template iteration.
