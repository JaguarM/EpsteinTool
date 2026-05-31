from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('analyze-pdf', views.analyze_pdf, name='analyze_pdf'),
    path('analyze-default', views.analyze_default, name='analyze_default'),
    path('refine-widths', views.analyze_refine_widths, name='analyze_refine_widths'),
]
