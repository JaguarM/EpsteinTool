from guesser_core.base import PDFTool
from guesser_core.registry import register_tool


@register_tool
class TextTool(PDFTool):
    name = 'text_tool'
    url_prefix = ''
    url_module = 'text_tool.urls'
    styles = [{'path': 'text_tool/styles.css'}]
    toolbar_button = 'text_tool/toolbar_button.html'
    options_bar = 'text_tool/options_bar.html'
    shows_text_options_bar = True
    scripts_after_app = [
        {'path': 'text_tool/unified-text-box.js', 'version': 'v=3'},
        {'path': 'text_tool/svg-renderer.js', 'version': 'v=3'},
        {'path': 'text_tool/drag-resize.js', 'version': 'v=3'},
        {'path': 'text_tool/toolbar.js', 'version': 'v=3'},
        {'path': 'text_tool/micro-typo.js', 'version': 'v=3'},
        {'path': 'text_tool/inline-edit.js', 'version': 'v=3'},
        {'path': 'text_tool/text-tool.js', 'version': 'v=3'},
    ]
