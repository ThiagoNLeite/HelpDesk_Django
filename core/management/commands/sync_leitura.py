"""
Comando de sincronização total: SQL Server (escrita) -> SQLite (leitura).

Fluxo:
1. Verifica se o SQL Server (default) está acessível, com timeout CURTO
   para não travar o startup do runserver caso o servidor esteja fora.
   - Se NÃO estiver: aborta SEM tocar no SQLite (preserva o dashboard antigo).
2. Se estiver: TRUNCA a tabela dashboard_chamados no SQLite e a recarrega
   inteira a partir dos chamados do SQL Server, preservando os IDs e
   copiando categoria (agora coluna do SQL Server) e o tempo de resolução
   calculado a partir de data_fim - data_abertura.

Uso manual:  python manage.py sync_leitura
Disparo automático no startup do runserver (ver apps.py).
"""
from django.core.management.base import BaseCommand
from django.db import connections
from django.utils import timezone


def tempo_resolucao(data_abertura, data_fim, status):
    """Texto legível do tempo de resolução (ou tempo em aberto)."""
    if not data_abertura:
        return None
    if status == 'Fechado' and data_fim:
        delta = data_fim - data_abertura
    elif status == 'Fechado':
        return "Resolvido"
    else:
        return "Em aberto"
    segundos = delta.total_seconds()
    if segundos < 0:
        return "Resolvido"
    if segundos < 3600:
        return f"{int(segundos // 60)} min"
    if segundos < 86400:
        return f"{segundos / 3600:.1f} h"
    return f"{segundos / 86400:.1f} dias"


class Command(BaseCommand):
    help = "Trunca o SQLite de leitura e o recarrega a partir do SQL Server."

    def add_arguments(self, parser):
        parser.add_argument('--quiet', action='store_true',
                            help='Silencia a saída (usado no startup automático).')

    def _log(self, msg, quiet, style=None):
        if quiet:
            return
        self.stdout.write(style(msg) if style else msg)

    def handle(self, *args, **options):
        quiet = options.get('quiet', False)

        from core.models import Chamado, DashboardChamados

        # 1) SQL Server vivo? Tenta conectar. Em caso de servidor fora, o ODBC
        #    pode demorar o timeout inteiro — por isso o startup chama com
        #    --quiet e o erro é tratado sem derrubar nada.
        try:
            connections['default'].ensure_connection()
        except Exception as e:
            self._log(
                f"[SYNC] SQL Server indisponivel. SQLite preservado. ({e})",
                quiet, self.style.WARNING
            )
            return

        # 2) Lê os chamados do SQL Server (incluindo categoria e data_fim).
        try:
            chamados = list(
                Chamado.objects.using('default').order_by('id').values(
                    'id', 'titulo', 'status', 'categoria',
                    'data_abertura', 'data_fim'
                )
            )
        except Exception as e:
            self._log(f"[SYNC] Falha ao ler chamados do SQL Server. SQLite preservado. ({e})",
                      quiet, self.style.WARNING)
            return

        # 3) TRUNCATE no SQLite + recarga preservando IDs.
        try:
            DashboardChamados.objects.using('leitura').all().delete()
            novos = []
            for c in chamados:
                data_ab = c['data_abertura']
                novos.append(DashboardChamados(
                    id=c['id'],
                    titulo=c['titulo'],
                    status_atual=c['status'],
                    categoria=c['categoria'],
                    tempo_resolucao=tempo_resolucao(data_ab, c['data_fim'], c['status']),
                    data=data_ab.date() if data_ab else timezone.localdate(),
                ))
            if novos:
                DashboardChamados.objects.using('leitura').bulk_create(novos)
        except Exception as e:
            self._log(f"[SYNC] Erro ao recarregar o SQLite: {e}",
                      quiet, self.style.ERROR)
            return

        self._log(f"[SYNC] SQLite recarregado: {len(chamados)} chamado(s) do SQL Server.",
                  quiet, self.style.SUCCESS)
