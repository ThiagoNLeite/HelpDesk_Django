class CQRSRouter:
    """
    CQRS Router corrigido.
    - DashboardChamados (relatórios) → SQLite (leitura)
    - Usuario, Chamado e todo o resto → SQL Server (default)
    """

    def db_for_read(self, model, **hints):
        # SOMENTE o modelo de leitura/dashboard vai para o SQLite
        if model._meta.model_name == 'dashboardchamados':
            return 'leitura'
        # Todos os outros modelos (Usuario, Chamado, etc.) leem do SQL Server
        return 'default'

    def db_for_write(self, model, **hints):
        # DashboardChamados é escrito no SQLite via .using('leitura') explícito na view/signal
        # Os demais vão para o SQL Server
        if model._meta.model_name == 'dashboardchamados':
            return 'leitura'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if model_name == 'dashboardchamados':
            return db == 'leitura'
        return db == 'default'
