from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('analyze-pdf', views.analyze_pdf, name='analyze_pdf'),
    path('widths', views.calculate_widths, name='calculate_widths'),
    path('fonts-list', views.list_fonts, name='list_fonts'),
    path('mask/<int:page_num>', views.get_mask, name='get_mask'),
]
