# -*- coding: utf-8 -*-
"""Authentication tests."""
import pytest


class TestAuth:
    """Login and token validation."""

    def test_login_unknown_user(self, client):
        resp = client.post('/api/auth/login', json={'user_id': 'X99999'})
        assert resp.status_code == 401
        assert 'error' in resp.get_json()

    def test_login_empty_user_id(self, client):
        resp = client.post('/api/auth/login', json={'user_id': ''})
        assert resp.status_code == 400

    def test_login_empty_body(self, client):
        resp = client.post('/api/auth/login', json={})
        assert resp.status_code == 400

    def test_login_no_body(self, client):
        resp = client.post('/api/auth/login')
        # Flask returns 415 or 400 for POST without JSON body
        assert resp.status_code in (400, 415)

    def test_admin_login(self, client):
        resp = client.post('/api/auth/login', json={'user_id': 'FrrSystemAdmin'})
        data = resp.get_json()
        assert 'token' in data
        assert data['user']['role'] == 'admin'
        assert data['user']['user_id'] == 'FrrSystemAdmin'

    def test_no_token_rejected(self, client):
        resp = client.get('/api/tickets')
        assert resp.status_code == 401

    def test_invalid_token_rejected(self, client):
        resp = client.get('/api/tickets', headers={
            'Authorization': 'Bearer invalid_token_xyz'
        })
        assert resp.status_code == 401

    def test_submitter_login_after_import(self, client, seed_users):
        resp = client.post('/api/auth/login', json={'user_id': 'T001'})
        data = resp.get_json()
        assert data['user']['role'] == 'submitter'
        assert data['user']['name'] == '张老师'

    def test_handler_login_after_import(self, client, seed_users):
        resp = client.post('/api/auth/login', json={'user_id': 'S001'})
        data = resp.get_json()
        assert data['user']['role'] == 'handler'
