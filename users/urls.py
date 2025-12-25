from django.urls import path
from .views import CustomLoginView, solicitar_acesso, landing_page
from .forms import PasswordResetEmailForm
from django.contrib.auth.views import LogoutView
from django.contrib.auth import views as auth_views

# login e logout
urlpatterns = [
    path('', landing_page, name='landing'),
    path('login/', CustomLoginView.as_view(), name='login'),
    path(
        'logout/',
        LogoutView.as_view(next_page='http://127.0.0.1:8000/login/'),
        name='logout'
    ),
    path('solicitar-acesso/', solicitar_acesso, name='solicitar_acesso'),

]

# esqueci senha
urlpatterns += [
    path('senha/resetar/', auth_views.PasswordResetView.as_view(
        template_name='users/password_reset_form.html',
        form_class=PasswordResetEmailForm
    ), name='password_reset'),
    path('senha/resetar/enviado/', auth_views.PasswordResetDoneView.as_view(template_name='users/password_reset_done.html'), name='password_reset_done'),
    path('senha/resetar/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(template_name='users/password_reset_confirm.html'), name='password_reset_confirm'),
    path('senha/resetar/completo/', auth_views.PasswordResetCompleteView.as_view(template_name='users/password_reset_complete.html'), name='password_reset_complete'),
]
