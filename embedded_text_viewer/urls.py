from django.urls import path
from . import views

urlpatterns = [
    path('api/charpos', views.charpos, name='etv-charpos'),
]
