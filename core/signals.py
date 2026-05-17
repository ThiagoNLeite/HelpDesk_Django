from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Chamado, DashboardChamados

@receiver(post_save, sender=Chamado)
def atualizar_leitura(sender, instance, created, **kwargs):
    """
    Sincronização SQL Server → SQLite (Consistência Eventual via Django Signal).
    Dispara automaticamente toda vez que um Chamado é salvo (criado ou atualizado).
    
    CORREÇÃO: campo 'data' tem auto_now_add=True, não pode ser passado em defaults
    no update_or_create — Django levantaria ValueError ao tentar atualizar.
    Solução: passamos 'data' apenas no create (lookup_field diferente), 
    usando update_fields explícito para update.
    """
    try:
        # Tenta atualizar registro existente no SQLite
        obj = DashboardChamados.objects.using('leitura').get(id=instance.id)
        obj.titulo = instance.titulo
        obj.status_atual = instance.status
        # Não atualizamos 'data' pois auto_now_add não permite
        obj.save(using='leitura', update_fields=['titulo', 'status_atual'])
    except DashboardChamados.DoesNotExist:
        # Cria novo registro — auto_now_add vai setar 'data' automaticamente
        DashboardChamados.objects.using('leitura').create(
            id=instance.id,
            titulo=instance.titulo,
            status_atual=instance.status,
        )
    except Exception as e:
        # Loga o erro mas não deixa falhar a operação principal (SQL Server)
        print(f"[SIGNAL WARNING] Falha ao sincronizar chamado {instance.id} com SQLite: {e}")
