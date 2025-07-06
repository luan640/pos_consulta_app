from django.urls import path
from . import views

urlpatterns = [
    path('home/', views.home, name='home'),
    path('', views.home, name='home'),
]

urlpatterns += [
    path('api/pacientes/', views.listar_pacientes_com_consultas, name='api_pacientes'),
    path('api/pacientes/novo/', views.cadastrar_paciente, name='api_cadastrar_paciente'),
    path('api/registrar-contato/', views.registrar_contato, name='api_resistrar_contato'),
    path('api/paciente/<int:pk>/', views.paciente_detalhe, name='paciente_detalhe'),
    
    path('api/regras/<int:pk>/', views.regras_list_create, name='regras_list_create'),
    path('api/regras/update/<int:pk_regra>/<int:pk_grupo>/', views.regras_detail_update, name='regras_detail_update'),
    path('api/regras/<int:pk_regra>/<int:pk_grupo>/mover-up/', views.regra_mover_up, name='regra_mover_up'),
    path('api/regras/<int:pk_regra>/<int:pk_grupo>/mover-down/', views.regra_mover_down, name='regra_mover_down'),

    path('api/grupo-regras/', views.grupo_regras_list_create, name='grupo_regras_list_create'),
    path('api/grupo-regras/update/<int:pk>/', views.grupo_regras_update, name='grupo_regras_update'),
    path('api/excluir-grupo-regra/<int:pk>/', views.excluir_grupo_regra, name='excluir_grupo_regra'),

    path('api/atribuir-grupo/<int:pk_grupo>/<int:pk_paciente>/', views.atribuir_grupo, name='atribuir_grupo'),

    path('api/cards-home/', views.atualizar_cards, name='atualizar_cards'),
    path('api/status-lembrete/<int:pk>/', views.status_lembrete, name='status_lembrete'),
    path('api/status-paciente/<int:pk>/', views.status_paciente, name='status_paciente'),
    path('api/registrar-consulta-retorno/<int:pk>/', views.registrar_consulta_retorno, name='registrar_consulta_retorno'),

    path('api/materiais/', views.buscar_materiais, name='buscar_materiais'),
    path('api/materiais/<int:pk>/', views.materiais, name='materiais'),

    path('api/historico-consulta/<int:pk>/', views.historico_consulta, name='historico_consulta'),
    path('api/historico-contatos/<int:pk>/', views.historico_contatos, name='historico_contatos'),
    path('api/editar-paciente/<int:pk>/', views.atualizar_paciente, name='atualizar_paciente'),

    path('api/verificar-cadastro/', views.verifica_se_tem_cadastrado, name='verifica_se_tem_cadastrado'),
    
]