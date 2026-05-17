from django.db import models

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
    data_abertura = models.DateTimeField(auto_now_add=True)
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
    data = models.DateField(auto_now_add=True)

    class Meta:
        db_table = 'dashboard_chamados'
        managed = True # O Django vai criar esta tabela no SQLite via router