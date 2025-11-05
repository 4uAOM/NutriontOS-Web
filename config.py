import os

# Ustaw tutaj sha256 (hex) Twojej Magic Phrase wygenerowany lokalnie:
# php -r "echo hash('sha256','f7z1r9bq4xk3t2m');"
MAGIC_PHRASE_HASH = 'PUT_SHA256_HEX_OF_MAGIC_PHRASE_HERE'

# Katalog do przechowywania zaszyfrowanych treningów
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, 'Treningi_encrypted')

# Plik użytkowników (username -> password_hash)
USERS_DB = os.path.join(BASE_DIR, 'users.json')

# Flask secret (ustaw długi, losowy w produkcji)
FLASK_SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', 'change_this_to_a_random_secret')

# CORS: jeśli frontend hostujesz gdzie indziej (np. GitHub Pages),
# wpisz listę dozwolonych originów lub ustaw None żeby zezwolić na wszystko (niezalecane)
CORS_ALLOW_ORIGINS = None  # e.g. ['https://yourdomain.com']
