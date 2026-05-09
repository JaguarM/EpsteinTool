from guesser_core.base import PDFTool
from guesser_core.registry import register_tool


@register_tool
class WebglMaskTool(PDFTool):
    name = 'webgl_mask'
    url_prefix = ''
    url_module = 'webgl_mask.urls'
    toolbar_button = 'webgl_mask/toolbar_button.html'
    options_bar = 'webgl_mask/options_bar.html'
    scripts_before_viewer = [{'path': 'webgl_mask/webgl-mask.js', 'version': ''}]
