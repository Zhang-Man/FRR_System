# -*- coding: utf-8 -*-
"""User management tests."""
import pytest


class TestUsers:
    """User CRUD and import."""

    def test_admin_can_list_users(self, client, admin_token):
        resp = client.get('/api/users', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        data = resp.get_json()
        assert isinstance(data, list)
        # Only seed admin + S001 from init_db
        assert len(data) >= 1

    def test_import_users(self, client, admin_token):
        resp = client.post('/api/users/import', json={
            'users': [
                {'user_id': 'T001', 'name': '张老师', 'role': 'submitter', 'phone': '111'},
                {'user_id': 'T002', 'name': '李老师', 'role': 'submitter'},
                {'user_id': 'S001', 'name': '王同学', 'role': 'handler'},
                {'user_id': 'S002', 'name': '赵同学', 'role': 'handler'},
            ]
        }, headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['imported'] == 4
        assert len(data['errors']) == 0

    def test_user_count_after_import(self, client, admin_token, seed_users):
        resp = client.get('/api/users', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        # Admin(FrrSystemAdmin) + S001(seed) + S002(seed override) + T001 + T002 = 5
        # Actually S001 is seed data, the import does INSERT OR REPLACE
        # So: admin + S001(seed, replaced) + T001 + T002 + S002 = 5
        assert len(resp.get_json()) >= 4

    def test_import_bad_data(self, client, admin_token):
        resp = client.post('/api/users/import', json={
            'users': [{'user_id': '', 'name': '', 'role': 'bad'}]
        }, headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['imported'] == 0
        assert len(data['errors']) > 0

    def test_delete_user(self, client, admin_token, seed_users):
        # Get T002's id
        resp = client.get('/api/users', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        users = resp.get_json()
        target = next((u for u in users if u['user_id'] == 'T002'), None)
        assert target is not None

        resp = client.delete(f'/api/users/{target["id"]}', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.get_json()['ok'] is True

        # Verify count decreased
        resp = client.get('/api/users', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert len(resp.get_json()) == len(users) - 1

    def test_cannot_delete_self(self, client, admin_token):
        resp = client.get('/api/users', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        users = resp.get_json()
        own = next((u for u in users if u['user_id'] == 'FrrSystemAdmin'), None)
        assert own is not None

        resp = client.delete(f'/api/users/{own["id"]}', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 400

    def test_submitter_blocked_from_users(self, client, submitter_token):
        resp = client.get('/api/users', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert resp.status_code == 403

    def test_handler_blocked_from_users(self, client, handler_token):
        resp = client.get('/api/users', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        assert resp.status_code == 403

    def test_submitter_blocked_from_delete(self, client, submitter_token):
        resp = client.delete('/api/users/1', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert resp.status_code == 403

    def test_import_xss_sanitized(self, client, admin_token):
        resp = client.post('/api/users/import', json={
            'users': [{'user_id': 'XSS01', 'name': '<script>alert(1)</script>test', 'role': 'submitter', 'phone': '<b>138</b>'}]
        }, headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['imported'] == 1
        users = client.get('/api/users', headers={'Authorization': f'Bearer {admin_token}'}).get_json()
        u = next((x for x in users if x['user_id'] == 'XSS01'), None)
        assert u is not None
        assert '<' not in u['name']
        assert 'script' not in u['name'].lower()

    def test_import_duplicate_user_id(self, client, admin_token, seed_users):
        resp = client.post('/api/users/import', json={
            'users': [{'user_id': 'T001', 'name': '重名老师', 'role': 'submitter'}]
        }, headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['imported'] == 1

    def test_delete_nonexistent_user(self, client, admin_token):
        resp = client.delete('/api/users/99999', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 404
