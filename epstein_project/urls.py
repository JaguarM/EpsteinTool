"""
URL configuration for epstein_project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('guesser_core.urls')),
]

if 'webgl_mask' in settings.INSTALLED_APPS:
    urlpatterns += [path('', include('webgl_mask.urls'))]

if 'extracted_text' in settings.INSTALLED_APPS:
    from extracted_text.urls import root_urlpatterns
    urlpatterns += root_urlpatterns  # /widths, /fonts-list
    urlpatterns += [path('embedded-text-viewer/', include('extracted_text.urls'))]  # /api/extract-spans, compare, calibrate

if 'embedded_text_viewer' in settings.INSTALLED_APPS:
    urlpatterns += [path('embedded-text-viewer/', include('embedded_text_viewer.urls'))]  # /api/charpos
