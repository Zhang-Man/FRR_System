# -*- coding: utf-8 -*-
"""Category management tests."""
import pytest


class TestCategories:
    """Category CRUD operations."""

    def test_public_list(self, client):
        resp = client.get('/api/categories')
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) >= 4

    def test_default_categories(self, client):
        resp = client.get('/api/categories')
        names = [c['name'] for c in resp.get_json()]
        # Check Chinese category names
        assert any('网络不通' in str(names) for _ in [1]) or \
               any('\u7f51\u7edc\u4e0d\u901a' in str(names) for _ in [1])

    def test_add_category(self, client, admin_token):
        resp = client.post('/api/categories', json={'name': '打印机故障'}, headers={
            'Authorization': f'Bearer {admin_token}'
        })
        data = resp.get_json()
        assert resp.status_code == 201
        assert data['name'] == '打印机故障'

    def test_add_duplicate(self, client, admin_token):
        client.post('/api/categories', json={'name': '打印机故障'}, headers={
            'Authorization': f'Bearer {admin_token}'
        })
        resp = client.post('/api/categories', json={'name': '打印机故障'}, headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 400

    def test_add_xss_sanitized(self, client, admin_token):
        resp = client.post('/api/categories', json={'name': '<script>x</script>test'}, headers={
            'Authorization': f'Bearer {admin_token}'
        })
        if resp.status_code == 201:
            assert 'script' not in resp.get_json().get('name', '')

    def test_submitter_blocked_from_add(self, client, submitter_token):
        resp = client.post('/api/categories', json={'name': 'test'}, headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert resp.status_code == 403

    def test_delete_category_in_use(self, client, admin_token, submitter_token):
        # Create a ticket using '网络不通'
        resp = client.post('/api/tickets', json={
            'contact': '13800001111',
            'location': '测试教室',
            'category': '网络不通',
            'description': '测试'
        }, headers={'Authorization': f'Bearer {submitter_token}'})
        assert resp.status_code == 201

        # Try to delete '网络不通'
        cats = client.get('/api/categories').get_json()
        cat_used = next(c for c in cats if c['name'] == '网络不通')
        resp = client.delete(f'/api/categories/{cat_used["id"]}', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 400

    def test_delete_unused_category(self, client, admin_token):
        client.post('/api/categories', json={'name': '测试分类删除'}, headers={
            'Authorization': f'Bearer {admin_token}'
        })
        cats = client.get('/api/categories').get_json()
        target = next(c for c in cats if c['name'] == '测试分类删除')
        resp = client.delete(f'/api/categories/{target["id"]}', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.get_json()['ok'] is True
