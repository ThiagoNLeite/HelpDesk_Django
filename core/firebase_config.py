import firebase_admin
from firebase_admin import credentials, auth
import os
from django.conf import settings

# Caminho para o seu arquivo JSON
JSON_PATH = os.path.join(settings.BASE_DIR, 'firebase-key.json')

def initialize_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(JSON_PATH)
        firebase_admin.initialize_app(cred)

def verify_token(token):
    try:
        # Valida o token JWT vindo do Front-end
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception:
        return None