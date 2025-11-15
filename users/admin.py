from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, AccessRequest
from django.forms import ModelForm

class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ('email', 'nome', 'telefone', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_active')
    ordering = ('email',)
    search_fields = ('email', 'nome', 'telefone')

    fieldsets = (
        (None, {'fields': ('email', 'nome', 'telefone', 'password')}),
        ('Permissões', {'fields': ('is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nome', 'telefone', 'password1', 'password2', 'is_staff', 'is_active')}
        ),
    )

class AccessRequestAdmin(admin.ModelAdmin):
    list_display = ('nome', 'email', 'whatsapp', 'criado_em')
    search_fields = ('nome', 'email', 'whatsapp')
    ordering = ('-criado_em',)


admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(AccessRequest, AccessRequestAdmin)
