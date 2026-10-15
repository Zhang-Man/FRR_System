# -*- coding: utf-8 -*-
import jwt
import datetime
import logging
from functools import wraps
from flask import request, jsonify, g
from models import get_db, dict_from_row
from i18n import t

logger = logging.getLogger('frr.auth')
SECRET = 'dev-secret-change-me'  # overridden by init_app


def init_secret():
    global SECRET
    import os
    SECRET = os.environ.get('SECRET_KEY', SECRET)


def generate_token(user_id, name, role):
    payload = {
        'user_id': user_id,
        'name': name,
        'role': role,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET, algorithm='HS256')


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            logger.warning('Missing/invalid Authorization header from %s', request.remote_addr)
            return jsonify({'error': t('not_logged_in')}), 401
        try:
            token = auth_header.split(' ')[1]
            payload = jwt.decode(token, SECRET, algorithms=['HS256'])
            g.current_user = payload
        except jwt.ExpiredSignatureError:
            logger.info('Expired token from %s', request.remote_addr)
            return jsonify({'error': t('token_expired')}), 401
        except jwt.InvalidTokenError:
            logger.warning('Invalid token from %s', request.remote_addr)
            return jsonify({'error': t('invalid_token')}), 401
        return f(*args, **kwargs)
    return decorated


def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if g.current_user.get('role') not in roles:
                logger.warning(
                    'Role check failed: user=%s role=%s needed=%s',
                    g.current_user.get('user_id'), g.current_user.get('role'), roles
                )
                return jsonify({'error': t('no_permission')}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


def init_app(app):
    init_secret()

    @app.route('/api/auth/login', methods=['POST'])
    def login():
        data = request.get_json()
        if not data:
            logger.info('Login attempt with no body from %s', request.remote_addr)
            return jsonify({'error': t('missing_data')}), 400
        user_id = data.get('user_id', '').strip()
        if not user_id:
            logger.info('Login attempt with empty user_id from %s', request.remote_addr)
            return jsonify({'error': t('missing_user_id')}), 400

        db = get_db()
        user = db.execute(
            "SELECT * FROM users WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        db.close()

        if not user:
            logger.info('Login failed: unknown user_id=%s from %s', user_id, request.remote_addr)
            return jsonify({'error': t('user_not_found')}), 401

        user = dict_from_row(user)
        token = generate_token(user['user_id'], user['name'], user['role'])
        logger.info('Login success: user=%s role=%s', user['user_id'], user['role'])
        return jsonify({
            'token': token,
            'user': {
                'user_id': user['user_id'],
                'name': user['name'],
                'role': user['role']
            }
        })
