from django.urls import path
from . import views

urlpatterns = [
    path('home/', views.home, name='home'),
]

urlpatterns += [
    path('api/pacientes/', views.listar_pacientes_com_consultas, name='api_pacientes'),
    path('api/pacientes/novo/', views.cadastrar_paciente, name='api_cadastrar_paciente'),
    path('api/materiais/', views.listar_materiais, name='api_listar_materiais'),
    path('api/registrar-contato/', views.registrar_contato, name='api_resistrar_contato'),
    path('api/paciente/<int:pk>/', views.paciente_detalhe, name='paciente_detalhe'),
    
    path('api/regras/<int:pk>/', views.regras_list_create, name='regras_list_create'),
    path('api/grupo-regras/', views.grupo_regras_list_create, name='grupo_regras_list_create'),
    path('api/regras/<int:pk>/', views.regras_detail_update, name='regras_detail_update'),
    path('api/regras/<int:pk>/mover-up/', views.regra_mover_up, name='regra_mover_up'),
    path('api/regras/<int:pk>/mover-down/', views.regra_mover_down, name='regra_mover_down'),

    path('api/cards-home/', views.atualizar_cards, name='atualizar_cards'),
    path('api/status-lembrete/<int:pk>/', views.status_lembrete, name='status_lembrete'),
    path('api/status-paciente/<int:pk>/', views.status_paciente, name='status_paciente'),
    path('api/registrar-consulta-retorno/<int:pk>/', views.registrar_consulta_retorno, name='registrar_consulta_retorno')

]