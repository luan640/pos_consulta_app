from django.contrib import admin
from .models import Paciente, Consulta, ContatoNutricionista, AnotacaoContato, RegraLembrete, Lembrete, Material, GrupoLembrete
from django import forms
from datetime import timedelta
from django.utils import timezone

@admin.register(RegraLembrete)
class RegraLembreteAdmin(admin.ModelAdmin):
    list_display = ('nome', 'nutricionista', 'dias_apos')
    list_filter = ('nutricionista','ordem')
    search_fields = ('nome', 'descricao','nutricionista__email')
    ordering = ('nutricionista', 'dias_apos')

    fieldsets = (
        (None, {
            'fields': ('nome','descricao')
        }),
        ('Configuração da Regra', {
            'fields': ('dias_apos','nutricionista','ordem')
        }),
    )

class PacienteAdminForm(forms.ModelForm):
    data_primeira_consulta = forms.DateField(
        required=True,
        label='Data da Primeira Consulta',
        initial=timezone.now().date()
    )

    class Meta:
        model = Paciente
        fields = ['nome', 'telefone', 'dono']

class PacienteAdmin(admin.ModelAdmin):
    form = PacienteAdminForm
    list_display = ('nome', 'telefone', 'dono')

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

        data_consulta = form.cleaned_data['data_primeira_consulta']
        Consulta.objects.create(paciente=obj, data_consulta=data_consulta)

        regras = RegraLembrete.objects.filter(nutricionista=obj.dono, ordem=0)
        for regra in regras:
            data_lembrete = data_consulta + timedelta(days=regra.dias_apos)
            Lembrete.objects.create(
                paciente=obj,
                regra=regra,
                data_lembrete=data_lembrete,
                texto=regra.descricao
            )

admin.site.register(Paciente, PacienteAdmin)
admin.site.register(Consulta)
admin.site.register(ContatoNutricionista)
admin.site.register(AnotacaoContato)
admin.site.register(Material)
admin.site.register(GrupoLembrete)
admin.site.register(Lembrete)
