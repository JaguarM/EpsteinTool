from django.contrib import admin
from django.urls import path, include
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('guesser_core.urls')),
]

if 'text_tool' in settings.INSTALLED_APPS:
    urlpatterns += [path('', include('text_tool.urls'))]  # /widths, /fonts-list (canonical)

if 'webgl_mask' in settings.INSTALLED_APPS:
    urlpatterns += [path('', include('webgl_mask.urls'))]

if 'extracted_text' in settings.INSTALLED_APPS:
    # app-level endpoints only; root /widths and /fonts-list now served by text_tool
    urlpatterns += [path('embedded-text-viewer/', include('extracted_text.urls'))]

if 'embedded_text_viewer' in settings.INSTALLED_APPS:
    urlpatterns += [path('embedded-text-viewer/', include('embedded_text_viewer.urls'))]

if 'tesseract_ocr' in settings.INSTALLED_APPS:
    urlpatterns += [path('tesseract-ocr/', include('tesseract_ocr.urls'))]
