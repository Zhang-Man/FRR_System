# -*- coding: utf-8 -*-
"""Shared pytest fixtures for FRR System tests."""
import os
import sys
import tempfile
import pytest

# Ensure backend is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


@pytest.fixture(scope='function')
def test_db():
    """Create a temporary SQLite database file for tests."""
    fd, path = tempfile.mkstemp(suffix='.db', prefix='frr_test_')
    os.close(fd)
    os.environ['DB_PATH'] = path
    os.environ['SECRET_KEY'] = 'test-secret-key'
    os.environ['CORS_ORIGINS'] = '*'
    os.environ['LOG_LEVEL'] = 'WARNING'
    yield path
    try:
        os.unlink(path)
    except (OSError, PermissionError):
        pass  # Windows may still hold the file


@pytest.fixture(scope='function')
def app(test_db):
    """Create Flask app with test database."""
    from app import create_app
    application = create_app()
    application.config['TESTING'] = True
    return application


@pytest.fixture(scope='function')
def client(app):
    """Flask test client."""
    return app.test_client()


# ── Token / user fixtures ──

@pytest.fixture(scope='function')
def admin_token(client):
    resp = client.post('/api/auth/login', json={'user_id': 'FrrSystemAdmin'})
    data = resp.get_json()
    return data['token']


@pytest.fixture(scope='function')
def seed_users(client, admin_token):
    """Import test users: T001(submitter), T002(submitter), S001(handler), S002(handler)."""
    resp = client.post('/api/users/import', json={
        'users': [
            {'user_id': 'T001', 'name': '张老师', 'role': 'submitter', 'phone': '111'},
            {'user_id': 'T002', 'name': '李老师', 'role': 'submitter'},
            {'user_id': 'S001', 'name': '王同学', 'role': 'handler'},
            {'user_id': 'S002', 'name': '赵同学', 'role': 'handler'},
        ]
    }, headers={'Authorization': f'Bearer {admin_token}'})
    return resp.get_json()


@pytest.fixture(scope='function')
def submitter_token(client, seed_users):
    resp = client.post('/api/auth/login', json={'user_id': 'T001'})
    return resp.get_json()['token']


@pytest.fixture(scope='function')
def handler_token(client, seed_users):
    resp = client.post('/api/auth/login', json={'user_id': 'S001'})
    return resp.get_json()['token']


@pytest.fixture(scope='function')
def handler2_token(client, seed_users):
    resp = client.post('/api/auth/login', json={'user_id': 'S002'})
    return resp.get_json()['token']
