# -*- coding: utf-8 -*-
import os
import logging
from logging.handlers import TimedRotatingFileHandler
from flask import Flask, request, g
from flask_cors import CORS

# --------------- load .env ---------------
try:
    from dotenv import load_dotenv
    _env = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(_env)
except ImportError:
    pass  # dotenv not installed, rely on system env vars

# --------------- config ---------------
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
LOG_BACKUP_COUNT = int(os.environ.get('LOG_BACKUP_COUNT', '30'))
ORG_NAME = os.environ.get('ORG_NAME', 'FRR System')
DEBUG_MODE = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

# --------------- logging ---------------
LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger('frr')
logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))

fmt = logging.Formatter(
    '%(asctime)s | %(levelname)-7s | %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Console handler
console = logging.StreamHandler()
console.setFormatter(fmt)
logger.addHandler(console)

# File handler (daily rotation)
file_handler = TimedRotatingFileHandler(
    os.path.join(LOG_DIR, 'app.log'),
    when='midnight',
    interval=1,
    backupCount=LOG_BACKUP_COUNT,
    encoding='utf-8'
)
file_handler.setFormatter(fmt)
logger.addHandler(file_handler)


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = SECRET_KEY
    app.config['JSON_AS_ASCII'] = False
    app.config['JSONIFY_MIMETYPE'] = 'application/json; charset=utf-8'

    origins = [o.strip() for o in CORS_ORIGINS.split(',') if o.strip()] if CORS_ORIGINS != '*' else '*'
    CORS(app, resources={r"/api/*": {"origins": origins}})

    # --------------- request logging ---------------
    @app.before_request
    def log_request():
        g._request_start = __import__('time').time()

    @app.after_request
    def log_response(response):
        if hasattr(g, '_request_start'):
            elapsed = (__import__('time').time() - g._request_start) * 1000
            role = g.current_user.get('role', 'anon') if hasattr(g, 'current_user') else 'anon'
            logger.info(
                '%s %s | %s | %s | %.0fms',
                request.method, request.path, response.status_code, role, elapsed
            )
        return response

    from models import init_db
    with app.app_context():
        logger.info('Initializing database...')
        init_db()

    from routes.tickets import tickets_bp
    from routes.users import users_bp
    from routes.categories import categories_bp
    from routes.stats import stats_bp
    app.register_blueprint(tickets_bp, url_prefix='/api')
    app.register_blueprint(users_bp, url_prefix='/api')
    app.register_blueprint(categories_bp, url_prefix='/api')
    app.register_blueprint(stats_bp, url_prefix='/api')

    import auth
    auth.init_app(app)

    @app.route('/health')
    def health():
        return {'status': 'ok'}

    logger.info('Flask app created (debug=%s, log=%s)', DEBUG_MODE, LOG_LEVEL)
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=DEBUG_MODE, host='0.0.0.0', port=5000)
