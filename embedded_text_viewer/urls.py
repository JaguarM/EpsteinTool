from django.urls import path
from . import views

urlpatterns = [
    path('api/extract-spans', views.extract_spans, name='etv-extract-spans'),
]

# Root-level routes (keep same URLs that text_tool used to serve)
root_urlpatterns = [
    path('widths', views.calculate_widths, name='calculate_widths'),
    path('fonts-list', views.list_fonts, name='list_fonts'),
]
