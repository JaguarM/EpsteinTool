from django.urls import path
from . import views

urlpatterns = [
    path('api/extract-spans', views.extract_spans, name='etv-extract-spans'),
]

# Kept as fallback only — canonical /widths and /fonts-list are served by text_tool
root_urlpatterns = [
    path('widths', views.calculate_widths, name='calculate_widths_fallback'),
    path('fonts-list', views.list_fonts, name='list_fonts_fallback'),
]
