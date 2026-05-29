from django.db import models
from django.utils import timezone


def agora_local():
    """
    Retorna o datetime atual no fuso configurado (America/Sao_Paulo), aware.
    O problema do '+3h' acontecia porque o valor era gravado/lido como UTC.
    Aqui devolvemos o instante correto; com USE_TZ=True o Django cuida da
    conversão, e o front exibe no fuso local sem deslocamento.
    """
    return timezone.localtime(timezone.now())


# TABELAS DO BANCO 2 (SQL SERVER - CRUD)
class Usuario(models.Model):
    id_firebase = models.CharField(max_length=128, primary_key=True)
    nome = models.CharField(max_length=100)
    cargo = models.CharField(max_length=100)

    class Meta:
        db_table = 'usuarios'


class Chamado(models.Model):
    STATUS_CHOICES = [
        ('Aberto', 'Aberto'),
        ('Em andamento', 'Em andamento'),
        ('Fechado', 'Fechado'),
    ]
    titulo = models.CharField(max_length=150)
    descricao = models.TextField(max_length=255)
    status = models.CharField(max_length=60, choices=STATUS_CHOICES, default='Aberto')
    categoria = models.CharField(max_length=100, null=True, blank=True)
    # default=agora_local em vez de auto_now_add: grava o horário LOCAL correto.
    data_abertura = models.DateTimeField(default=agora_local, editable=False)
    # Preenchido quando o chamado é marcado como 'Fechado'. Permite calcular
    # o tempo de resolução real (data_fim - data_abertura).
    data_fim = models.DateTimeField(null=True, blank=True)
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario')

    class Meta:
        db_table = 'chamados'


# TABELA DO BANCO 3 (SQLITE - DATA WAREHOUSE / LEITURA)
class DashboardChamados(models.Model):
    # Esta tabela é desnormalizada para relatórios rápidos
    titulo = models.CharField(max_length=150)
    status_atual = models.CharField(max_length=60)
    tempo_resolucao = models.CharField(max_length=100, null=True, blank=True)
    categoria = models.CharField(max_length=100, null=True, blank=True)
    # Sem auto_now_add: a sincronização grava a data REAL de abertura vinda do
    # SQL Server.
    data = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'dashboard_chamados'
        managed = True  # O Django cria esta tabela no SQLite via router
