from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_pacientes, name='paciente_list'),
    path('nuevo/', views.crear_paciente, name='paciente_crear'),
]
