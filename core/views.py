import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Usuario, Chamado, DashboardChamados
from django.db.models import Count
from datetime import date, timedelta


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
    usuario, created = Usuario.objects.update_or_create(
        id_firebase=uid,
        defaults={'nome': nome, 'cargo': cargo}
    )
    return JsonResponse({'id_firebase': usuario.id_firebase, 'nome': usuario.nome, 'cargo': usuario.cargo, 'criado': created}, status=201 if created else 200)


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


# GET/POST /api/chamados/
@csrf_exempt
@require_http_methods(["GET", "POST"])
def chamados(request):
    if request.method == 'GET':
        try:
            registros = DashboardChamados.objects.using('leitura').order_by('-id').values(
                'id', 'titulo', 'status_atual', 'tempo_resolucao', 'categoria', 'data'
            )
            return JsonResponse({'chamados': list(registros)})
        except Exception:
            registros = Chamado.objects.select_related('id_usuario').order_by('-data_abertura').values(
                'id', 'titulo', 'status', 'data_abertura', 'id_usuario__nome'
            )
            dados = [{'id': r['id'], 'titulo': r['titulo'], 'status_atual': r['status'],
                      'data': r['data_abertura'].date().isoformat() if r['data_abertura'] else None,
                      'categoria': None, 'fonte': 'fallback'} for r in registros]
            return JsonResponse({'chamados': dados, 'aviso': 'Banco de leitura indisponível. Usando banco transacional.'})

    firebase_user = get_firebase_user(request)
    if not firebase_user:
        return JsonResponse({'error': 'Autenticação necessária'}, status=401)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    titulo = data.get('titulo', '').strip()
    descricao = data.get('descricao', '').strip()
    categoria = data.get('categoria', '').strip()
    if not titulo or not descricao:
        return JsonResponse({'error': 'Campos "titulo" e "descricao" são obrigatórios'}, status=400)

    uid = firebase_user['uid']
    try:
        usuario = Usuario.objects.get(id_firebase=uid)
    except Usuario.DoesNotExist:
        return JsonResponse({'error': 'Usuário não cadastrado. Faça o registro primeiro.'}, status=404)

    chamado = Chamado.objects.create(titulo=titulo, descricao=descricao, status='Aberto', id_usuario=usuario)
    try:
        DashboardChamados.objects.using('leitura').filter(id=chamado.id).update(categoria=categoria)
    except Exception:
        pass
    return JsonResponse({'id': chamado.id, 'titulo': chamado.titulo, 'status': chamado.status,
                         'data_abertura': chamado.data_abertura.isoformat(), 'usuario': usuario.nome}, status=201)


# GET/PUT/DELETE /api/chamados/<id>/
@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def chamado_detail(request, chamado_id):
    if request.method == 'GET':
        try:
            c = Chamado.objects.select_related('id_usuario').get(id=chamado_id)
            return JsonResponse({'id': c.id, 'titulo': c.titulo, 'descricao': c.descricao,
                                 'status': c.status, 'data_abertura': c.data_abertura.isoformat(),
                                 'usuario': c.id_usuario.nome, 'cargo': c.id_usuario.cargo})
        except Chamado.DoesNotExist:
            return JsonResponse({'error': 'Chamado não encontrado'}, status=404)

    firebase_user = get_firebase_user(request)
    if not firebase_user:
        return JsonResponse({'error': 'Autenticação necessária'}, status=401)

    try:
        chamado = Chamado.objects.get(id=chamado_id)
    except Chamado.DoesNotExist:
        return JsonResponse({'error': 'Chamado não encontrado'}, status=404)

    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'JSON inválido'}, status=400)
        novo_status = data.get('status', '').strip()
        if novo_status not in ['Aberto', 'Em andamento', 'Fechado']:
            return JsonResponse({'error': 'Status inválido'}, status=400)
        chamado.status = novo_status
        chamado.save()
        return JsonResponse({'id': chamado.id, 'status': chamado.status, 'mensagem': 'Status atualizado'})

    if request.method == 'DELETE':
        cid = chamado.id
        chamado.delete()
        try:
            DashboardChamados.objects.using('leitura').filter(id=cid).delete()
        except Exception:
            pass
        return JsonResponse({'mensagem': 'Chamado removido com sucesso'})


# GET /api/dashboard/stats/
@csrf_exempt
@require_http_methods(["GET"])
def dashboard_stats(request):
    try:
        qs = DashboardChamados.objects.using('leitura')
        total = qs.count()
        abertos = qs.filter(status_atual='Aberto').count()
        em_andamento = qs.filter(status_atual='Em andamento').count()
        fechados = qs.filter(status_atual='Fechado').count()
        por_categoria = list(qs.exclude(categoria__isnull=True).exclude(categoria='')
                               .values('categoria').annotate(total=Count('id')).order_by('-total')[:6])
        hoje = date.today()
        ultimos_7 = []
        for i in range(6, -1, -1):
            dia = hoje - timedelta(days=i)
            qtd = qs.filter(data=dia).count()
            ultimos_7.append({'data': dia.isoformat(), 'total': qtd})
        return JsonResponse({'total': total, 'abertos': abertos, 'em_andamento': em_andamento,
                             'fechados': fechados, 'por_categoria': por_categoria,
                             'ultimos_7_dias': ultimos_7, 'fonte': 'sqlite_leitura'})
    except Exception:
        try:
            total = Chamado.objects.count()
            abertos = Chamado.objects.filter(status='Aberto').count()
            em_andamento = Chamado.objects.filter(status='Em andamento').count()
            fechados = Chamado.objects.filter(status='Fechado').count()
            return JsonResponse({'total': total, 'abertos': abertos, 'em_andamento': em_andamento,
                                 'fechados': fechados, 'por_categoria': [], 'ultimos_7_dias': [],
                                 'fonte': 'fallback_sqlserver', 'aviso': 'Banco de leitura indisponível.'})
        except Exception as e2:
            return JsonResponse({'error': f'Ambos os bancos indisponíveis: {str(e2)}'}, status=503)
