from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required

from .models import Paciente
from .forms import PacienteForm


@login_required
def list_pacientes(request):
    pacientes = Paciente.objects.all()
    return render(request, 'paciente/lista.html', {'pacientes': pacientes})


@login_required
def crear_paciente(request):
    if request.method == 'POST':
        form = PacienteForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('paciente_list')
    else:
        form = PacienteForm()
    return render(request, 'paciente/crear.html', {'form': form})
