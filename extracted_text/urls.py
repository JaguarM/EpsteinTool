from django.urls import path
from . import views

urlpatterns = [
    path('api/extract-spans', views.extract_spans, name='etv-extract-spans'),
    path('api/calibrate', views.calibrate_document_api, name='etv-calibrate'),
    path('api/compare', views.compare_geometry, name='etv-compare'),
]

root_urlpatterns = [
    path('widths', views.calculate_widths, name='calculate_widths'),
    path('fonts-list', views.list_fonts, name='list_fonts'),
]
