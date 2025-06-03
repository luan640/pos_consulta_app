from django.db import models


class Paciente(models.Model):
    nombre = models.CharField(max_length=100)
    edad = models.PositiveIntegerField()

    def __str__(self) -> str:
        return self.nombre
