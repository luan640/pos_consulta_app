from django.contrib.auth.views import LoginView
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.shortcuts import render
from django.core.mail import send_mail
from django.conf import settings
import json

from .forms import LoginForm
from .models import AccessRequest


class CustomLoginView(LoginView):
    authentication_form = LoginForm
    template_name = 'users/login.html'


def landing_page(request):
    """
    Página institucional aberta exibindo o produto para visitantes.
    """
    return render(request, 'home/landing.html')


@require_POST
def solicitar_acesso(request):
    """
    Recebe nome, e-mail e WhatsApp informados no login, persiste no banco e envia aviso ao time.
    """
    try:
        payload = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'Formato inválido.'}, status=400)

    nome = (payload.get('nome') or '').strip()
    email = (payload.get('email') or '').strip()
    whatsapp = (payload.get('whatsapp') or '').strip()

    if not nome or not email or not whatsapp:
        return JsonResponse({'erro': 'Informe nome, e-mail e WhatsApp.'}, status=400)

    AccessRequest.objects.create(nome=nome, email=email, whatsapp=whatsapp)

    mensagem = (
        'Novo pedido de acesso recebido:\n'
        f'Nome: {nome}\n'
        f'E-mail: {email}\n'
        f'WhatsApp: {whatsapp}'
    )

    send_mail(
        subject='Novo pedido de acesso - LembraPro',
        message=mensagem,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'lembrapro@gmail.com'),
        recipient_list=[getattr(settings, 'SUPPORT_EMAIL', 'lembrapro@gmail.com')],
        fail_silently=True,
    )

    return JsonResponse({'mensagem': 'Recebemos seus dados! Em breve entraremos em contato.'})
