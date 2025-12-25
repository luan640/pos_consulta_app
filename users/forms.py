from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm, PasswordResetForm
from django.core.exceptions import ValidationError

class LoginForm(AuthenticationForm):
    username = forms.EmailField(label="E-mail")


class PasswordResetEmailForm(PasswordResetForm):
    def clean_email(self):
        email = (self.cleaned_data.get('email') or '').strip()
        UserModel = get_user_model()
        if not UserModel.objects.filter(email__iexact=email, is_active=True).exists():
            raise ValidationError('E-mail nao encontrado.')
        return email
