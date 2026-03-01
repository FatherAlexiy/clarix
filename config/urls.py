from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from .views import spa

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/notes/', include('apps.notes.urls')),
    re_path(r'^(?!static/).*$', spa, name='spa'),
] + static(settings.STATIC_URL, document_root=settings.BASE_DIR / 'static')
