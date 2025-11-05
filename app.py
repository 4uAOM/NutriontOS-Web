from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import os, json, hashlib, time, binascii

import config

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.secret_key = config.FLASK_SECRET_KEY

# CORS
if config.CORS_ALLOW_ORIGINS is None:
    CORS(app, supports_credentials=True)
else:
    CORS(app, origins=config.CORS_ALLOW_ORIGINS, supports_credentials=True)

# Ensure storage dir exists
os.makedirs(config.STORAGE_DIR, exist_ok=True)

# Ensure users db exists
if not os.path.exists(config.USERS_DB):
    with open(config.USERS_DB, 'w', encoding='utf-8') as f:
        json.dump({}, f)

def load_users():
    with open(config.USERS_DB, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_users(u):
    with open(config.USERS_DB, 'w', encoding='utf-8') as f:
        json.dump(u, f, indent=2, ensure_ascii=False)

def sha256_hex(s):
    return hashlib.sha256(s.encode('utf-8')).hexdigest()

def login_required(fn):
    from functools import wraps
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if 'username' not in session:
            return jsonify({'error':'authentication required'}), 401
        return fn(*args, **kwargs)
    return wrapped

@app.route('/')
def root():
    return app.send_static_file('index.html')

# STATIC PAGES (index, add, show, edit)
@app.route('/index.html')
def index_html():
    return app.send_static_file('index.html')

@app.route('/add.html')
def add_html():
    return app.send_static_file('add.html')

@app.route('/show.html')
def show_html():
    return app.send_static_file('show.html')

@app.route('/edit.html')
def edit_html():
    return app.send_static_file('edit.html')

# ---- AUTH: register / login / logout ----

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error':'invalid json'}), 400
    username = data.get('username','').strip()
    password = data.get('password','')
    magic_hash = data.get('magic_hash','')
    if not username or not password or not magic_hash:
        return jsonify({'error':'missing fields'}), 400

    # validate magic hash against server config
    if not hashlib.compare_digest(magic_hash, config.MAGIC_PHRASE_HASH):
        return jsonify({'error':'invalid magic phrase'}), 403

    users = load_users()
    if username in users:
        return jsonify({'error':'user exists'}), 400

    users[username] = generate_password_hash(password)
    save_users(users)

    # create user's folder
    user_dir = os.path.join(config.STORAGE_DIR, username)
    os.makedirs(user_dir, exist_ok=True)

    # auto-login after register
    session['username'] = username
    return jsonify({'status':'ok'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error':'invalid json'}), 400
    username = data.get('username','').strip()
    password = data.get('password','')
    if not username or not password:
        return jsonify({'error':'missing fields'}), 400

    users = load_users()
    if username not in users or not check_password_hash(users[username], password):
        return jsonify({'error':'invalid credentials'}), 401

    session['username'] = username
    return jsonify({'status':'ok'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('username', None)
    return jsonify({'status':'ok'})

# ---- Save encrypted payload ----
@app.route('/api/save_encrypted', methods=['POST'])
@login_required
def save_encrypted():
    data = request.get_json()
    if not data:
        return jsonify({'error':'invalid json'}), 400

    # required fields from client (ciphertext, iv, salt)
    required = ['ciphertext','iv','salt','kdf']
    for r in required:
        if r not in data:
            return jsonify({'error':f'missing {r}'}), 400

    username = session['username']
    user_dir = os.path.join(config.STORAGE_DIR, username)
    os.makedirs(user_dir, exist_ok=True)

    # sanitize optional filename
    fname_hint = data.get('filename')
    if fname_hint:
        fname = ''.join(ch for ch in fname_hint if ch.isalnum() or ch in '._-')
    else:
        fname = f"trening_{int(time.time())}_{binascii.b2a_hex(os.urandom(6)).decode()}.json"

    payload = {
        'owner': username,
        'createdAtServer': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'payload': {
            'ciphertext': data['ciphertext'],
            'iv': data['iv'],
            'salt': data['salt'],
            'kdf': data['kdf'],
            'meta': data.get('meta', None)
        }
    }

    fullpath = os.path.join(user_dir, fname)
    with open(fullpath, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    return jsonify({'status':'ok','file': f"{username}/{fname}"})

# ---- List files for logged-in user ----
@app.route('/api/list_encrypted', methods=['GET'])
@login_required
def list_encrypted():
    username = session['username']
    user_dir = os.path.join(config.STORAGE_DIR, username)
    if not os.path.exists(user_dir):
        return jsonify([])
    files = [f for f in os.listdir(user_dir) if os.path.isfile(os.path.join(user_dir,f))]
    files_info = []
    for f in sorted(files, reverse=True):
        stat = os.stat(os.path.join(user_dir,f))
        files_info.append({'file': f, 'mtime': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(stat.st_mtime))})
    return jsonify(files_info)

# ---- Get encrypted file content (raw payload) ----
@app.route('/api/get_encrypted', methods=['POST'])
@login_required
def get_encrypted():
    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({'error':'missing filename'}), 400
    username = session['username']
    filename = ''.join(ch for ch in data['filename'] if ch.isalnum() or ch in '._-')
    path = os.path.join(config.STORAGE_DIR, username, filename)
    if not os.path.exists(path):
        return jsonify({'error':'not found'}), 404
    with open(path, 'r', encoding='utf-8') as f:
        content = json.load(f)
    return jsonify(content)

# ---- Static file serving for convenience ----
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
