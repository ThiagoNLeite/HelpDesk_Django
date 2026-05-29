import os
import sys

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        import core.signals  # registra a sincronização incremental (signal)

        # Sincronização total no startup: SÓ quando subimos o servidor.
        # - 'runserver' presente em argv  -> é o servidor de desenvolvimento
        # - RUN_MAIN == 'true'            -> processo filho do autoreloader
        #   (evita rodar duas vezes; o processo pai tem RUN_MAIN ausente)
        # Não roda em migrate, shell, testes, etc.
        is_runserver = 'runserver' in sys.argv
        is_reload_child = os.environ.get('RUN_MAIN') == 'true'

        if is_runserver and is_reload_child:
            self._sync_leitura_startup()

    def _sync_leitura_startup(self):
        try:
            from django.core.management import call_command
            call_command('sync_leitura', quiet=True)
        except Exception as e:
            # Nunca deixa o servidor falhar por causa da sincronização.
            print(f"[STARTUP] Sincronização do SQLite não executada: {e}")
