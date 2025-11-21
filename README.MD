Para rodar o celery (disparo de mensagens whatsapp)

Console 1: python manage.py runserver
Console 2: celery -A app_pos worker -l info -P solo (windows)
Console 3: celery -A app_pos beat -l info
