from django.urls import path
from . import views

urlpatterns = [
    path('home/', views.home, name='home'),
]

urlpatterns += [
    path('api/pacientes/', views.listar_pacientes_com_consultas, name='api_pacientes'),
    path('api/pacientes/novo/', views.cadastrar_paciente, name='api_cadastrar_paciente'),
    path('api/materiais/', views.listar_materiais, name='api_listar_materiais'),
]