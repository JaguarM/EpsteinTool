from django.apps import AppConfig


class ExtractedTextConfig(AppConfig):
    name = 'extracted_text'
    url_prefix = 'embedded-text-viewer/'
    url_module = 'extracted_text.urls'
