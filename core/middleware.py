from django.http import JsonResponse
from .firebase_config import verify_token, initialize_firebase

class FirebaseAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        initialize_firebase()

    def __call__(self, request):
        # Lista de rotas ou métodos que exigem autenticação
        if request.method in ['POST', 'PUT', 'DELETE']:
            auth_header = request.headers.get('Authorization')

            if not auth_header or not auth_header.startswith('Bearer '):
                return JsonResponse({'error': 'Token não fornecido'}, status=401)

            token = auth_header.split(' ')[1]
            decoded_user = verify_token(token)

            if not decoded_user:
                return JsonResponse({'error': 'Token inválido ou expirado'}, status=401)

            # Salva os dados do usuário no request para usar na View depois
            request.firebase_user = decoded_user

        return self.get_response(request)