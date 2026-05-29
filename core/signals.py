from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

from .models import Chamado, DashboardChamados
from .management.commands.sync_leitura import tempo_resolucao


@receiver(post_save, sender=Chamado)
def atualizar_leitura(sender, instance, created, **kwargs):
    """
    Sincronização incremental SQL Server -> SQLite (consistência eventual).
    Preserva o id (1:1 com o SQL Server) e copia categoria/tempo de resolução.
    Nunca derruba a operação principal (SQL Server) se o SQLite falhar.
    """
    try:
        DashboardChamados.objects.using('leitura').update_or_create(
            id=instance.id,
            defaults={
                'titulo': instance.titulo,
                'status_atual': instance.status,
                'categoria': instance.categoria,
                'tempo_resolucao': tempo_resolucao(
                    instance.data_abertura, instance.data_fim, instance.status
                ),
                'data': instance.data_abertura.date() if instance.data_abertura else timezone.localdate(),
            },
        )
    except Exception as e:
        print(f"[SIGNAL WARNING] Falha ao sincronizar chamado {instance.id} com SQLite: {e}")


@receiver(post_delete, sender=Chamado)
def remover_leitura(sender, instance, **kwargs):
    """Mantém o SQLite alinhado quando um chamado é apagado no SQL Server."""
    try:
        DashboardChamados.objects.using('leitura').filter(id=instance.id).delete()
    except Exception as e:
        print(f"[SIGNAL WARNING] Falha ao remover chamado {instance.id} do SQLite: {e}")
