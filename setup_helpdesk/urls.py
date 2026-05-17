from django.contrib import admin
from django.urls import path
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth / Usuários
    path('api/auth/register/', views.register_user),
    path('api/usuarios/me/', views.get_me),

    # Chamados
    path('api/chamados/', views.chamados),
    path('api/chamados/<int:chamado_id>/', views.chamado_detail),

    # Dashboard
    path('api/dashboard/stats/', views.dashboard_stats),
]
