import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta

from .models import Usuario, Chamado, DashboardChamados


def get_firebase_user(request):
    return getattr(request, 'firebase_user', None)


# POST /api/auth/register/
@csrf_exempt
@require_http_methods(["POST"])
def register_user(request):
    firebase_user = get_firebase_user(request)
    if not firebase_user:
        return JsonResponse({'error': 'Token Firebase inválido ou não fornecido'}, status=401)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    nome = data.get('nome', '').strip()
    cargo = data.get('cargo', 'Usuário').strip()
    if not nome:
        return JsonResponse({'error': 'Campo "nome" é obrigatório'}, status=400)

    uid = firebase_user['uid']
    try:
        usuario, created = Usuario.objects.update_or_create(
            id_firebase=uid, defaults={'nome': nome, 'cargo': cargo}
        )
    except Exception:
        return JsonResponse({'error': 'Banco de escrita (SQL Server) indisponível. Cadastro temporariamente desativado.'}, status=503)
    return JsonResponse({'id_firebase': usuario.id_firebase, 'nome': usuario.nome,
                         'cargo': usuario.cargo, 'criado': created}, status=201 if created else 200)


# GET /api/usuarios/me/
@csrf_exempt
@require_http_methods(["GET"])
def get_me(request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JsonResponse({'error': 'Token não fornecido'}, status=401)
    from .firebase_config import verify_token
    token = auth_header.split(' ')[1]
    firebase_user = verify_token(token)
    if not firebase_user:
        return JsonResponse({'error': 'Token inválido'}, status=401)
    uid = firebase_user['uid']
    try:
        usuario = Usuario.objects.get(id_firebase=uid)
        return JsonResponse({'id_firebase': usuario.id_firebase, 'nome': usuario.nome, 'cargo': usuario.cargo})
    except Usuario.DoesNotExist:
        return JsonResponse({'error': 'Usuário não encontrado'}, status=404)
    except Exception:
        # SQL Server fora: não conseguimos validar o perfil, mas não derruba o app.
        return JsonResponse({'error': 'Banco de escrita indisponível', 'offline': True}, status=503)


# GET/POST /api/chamados/
@csrf_exempt
@require_http_methods(["GET", "POST"])
def chamados(request):
    if request.method == 'GET':
        # Leitura primária: SQLite. Se o SQLite cair, faz fallback para o
        # SQL Server (a LISTA de chamados pode degradar; só o DASHBOARD não).
        try:
            registros = DashboardChamados.objects.using('leitura').order_by('-id').values(
                'id', 'titulo', 'status_atual', 'tempo_resolucao', 'categoria', 'data'
            )
            return JsonResponse({'chamados': list(registros), 'fonte': 'sqlite_leitura'})
        except Exception:
            try:
                registros = Chamado.objects.using('default').select_related('id_usuario').order_by('-data_abertura').values(
                    'id', 'titulo', 'status', 'categoria', 'data_abertura', 'id_usuario__nome'
                )
                dados = [{'id': r['id'], 'titulo': r['titulo'], 'status_atual': r['status'],
                          'categoria': r['categoria'],
                          'data': r['data_abertura'].date().isoformat() if r['data_abertura'] else None,
                          'fonte': 'fallback'} for r in registros]
                return JsonResponse({'chamados': dados,
                                     'aviso': 'Banco de leitura indisponível. Usando banco transacional.',
                                     'fonte': 'fallback_sqlserver'})
            except Exception:
                return JsonResponse({'chamados': [], 'error': 'Ambos os bancos indisponíveis.'}, status=503)

    # POST -> escrita no SQL Server
    firebase_user = get_firebase_user(request)
    if not firebase_user:
        return JsonResponse({'error': 'Autenticação necessária'}, status=401)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    titulo = data.get('titulo', '').strip()
    descricao = data.get('descricao', '').strip()
    categoria = data.get('categoria', '').strip() or None
    if not titulo or not descricao:
        return JsonResponse({'error': 'Campos "titulo" e "descricao" são obrigatórios'}, status=400)

    uid = firebase_user['uid']
    try:
        usuario = Usuario.objects.get(id_firebase=uid)
    except Usuario.DoesNotExist:
        return JsonResponse({'error': 'Usuário não cadastrado. Faça o registro primeiro.'}, status=404)
    except Exception:
        return JsonResponse({'error': 'Banco de escrita (SQL Server) indisponível. Não é possível abrir chamados no momento.'}, status=503)

    try:
        chamado = Chamado.objects.create(
            titulo=titulo, descricao=descricao, status='Aberto',
            categoria=categoria, id_usuario=usuario
        )
    except Exception:
        return JsonResponse({'error': 'Banco de escrita (SQL Server) indisponível. Não é possível abrir chamados no momento.'}, status=503)

    return JsonResponse({'id': chamado.id, 'titulo': chamado.titulo, 'status': chamado.status,
                         'categoria': chamado.categoria,
                         'data_abertura': chamado.data_abertura.isoformat(), 'usuario': usuario.nome}, status=201)


# GET/PUT/DELETE /api/chamados/<id>/
@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def chamado_detail(request, chamado_id):
    if request.method == 'GET':
        try:
            c = Chamado.objects.select_related('id_usuario').get(id=chamado_id)
            return JsonResponse({'id': c.id, 'titulo': c.titulo, 'descricao': c.descricao,
                                 'status': c.status, 'categoria': c.categoria,
                                 'data_abertura': c.data_abertura.isoformat(),
                                 'data_fim': c.data_fim.isoformat() if c.data_fim else None,
                                 'usuario': c.id_usuario.nome, 'cargo': c.id_usuario.cargo})
        except Chamado.DoesNotExist:
            return JsonResponse({'error': 'Chamado não encontrado'}, status=404)
        except Exception:
            return JsonResponse({'error': 'Banco de escrita indisponível'}, status=503)

    firebase_user = get_firebase_user(request)
    if not firebase_user:
        return JsonResponse({'error': 'Autenticação necessária'}, status=401)

    try:
        chamado = Chamado.objects.get(id=chamado_id)
    except Chamado.DoesNotExist:
        return JsonResponse({'error': 'Chamado não encontrado'}, status=404)
    except Exception:
        return JsonResponse({'error': 'Banco de escrita (SQL Server) indisponível.'}, status=503)

    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'JSON inválido'}, status=400)
        novo_status = data.get('status', '').strip()
        if novo_status not in ['Aberto', 'Em andamento', 'Fechado']:
            return JsonResponse({'error': 'Status inválido'}, status=400)
        chamado.status = novo_status
        # Marca/limpa data_fim conforme o status, para o cálculo de tempo de resolução.
        if novo_status == 'Fechado' and not chamado.data_fim:
            chamado.data_fim = timezone.localtime(timezone.now()).replace(tzinfo=None)
        elif novo_status != 'Fechado':
            chamado.data_fim = None
        try:
            chamado.save()
        except Exception:
            return JsonResponse({'error': 'Banco de escrita (SQL Server) indisponível.'}, status=503)
        return JsonResponse({'id': chamado.id, 'status': chamado.status, 'mensagem': 'Status atualizado'})

    if request.method == 'DELETE':
        try:
            chamado.delete()  # post_delete signal remove do SQLite
        except Exception:
            return JsonResponse({'error': 'Banco de escrita (SQL Server) indisponível.'}, status=503)
        return JsonResponse({'mensagem': 'Chamado removido com sucesso'})


# GET /api/dashboard/stats/
@csrf_exempt
@require_http_methods(["GET"])
def dashboard_stats(request):
    """
    Dashboard lê EXCLUSIVAMENTE do SQLite (banco de leitura).
    Se o SQLite cair, NÃO faz fallback: retorna 503 para o front exibir
    uma mensagem de erro simples e zerar os números (decisão de projeto).
    """
    try:
        qs = DashboardChamados.objects.using('leitura')
        total = qs.count()
        abertos = qs.filter(status_atual='Aberto').count()
        em_andamento = qs.filter(status_atual='Em andamento').count()
        fechados = qs.filter(status_atual='Fechado').count()
        por_categoria = list(qs.exclude(categoria__isnull=True).exclude(categoria='')
                               .values('categoria').annotate(total=Count('id')).order_by('-total')[:6])
        hoje = timezone.localdate()
        ultimos_7 = []
        for i in range(6, -1, -1):
            dia = hoje - timedelta(days=i)
            ultimos_7.append({'data': dia.isoformat(), 'total': qs.filter(data=dia).count()})
        return JsonResponse({'total': total, 'abertos': abertos, 'em_andamento': em_andamento,
                             'fechados': fechados, 'por_categoria': por_categoria,
                             'ultimos_7_dias': ultimos_7, 'fonte': 'sqlite_leitura'})
    except Exception:
        return JsonResponse(
            {'error': 'Banco de leitura (SQLite) indisponível. O painel analítico está temporariamente fora do ar.',
             'leitura_offline': True},
            status=503
        )
