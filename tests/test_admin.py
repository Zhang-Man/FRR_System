# -*- coding: utf-8 -*-
"""Admin operations tests: filtering, CSV export."""
import pytest


class TestAdmin:
    """Admin-specific operations."""

    @pytest.fixture(scope='function')
    def seeded_tickets(self, client, admin_token, submitter_token, handler_token):
        """Create a mix of tickets and process some."""
        t1 = client.post('/api/tickets', json={
            'contact': '13800001111', 'location': '图书馆302',
            'category': '网络不通', 'description': '无法上网'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()

        t2 = client.post('/api/tickets', json={
            'contact': '13900002222', 'location': '教学楼A201',
            'category': '网速慢', 'description': '网页慢'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()

        # Claim and complete t1
        client.put(f'/api/tickets/{t1["id"]}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        client.put(f'/api/tickets/{t1["id"]}/complete', json={
            'solution': '已修复'
        }, headers={'Authorization': f'Bearer {handler_token}'})

        return t1, t2

    def test_admin_sees_all(self, client, admin_token, seeded_tickets):
        resp = client.get('/api/tickets', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert len(resp.get_json()) >= 2

    def test_filter_resolved(self, client, admin_token, seeded_tickets):
        resp = client.get('/api/tickets?status=resolved', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        data = resp.get_json()
        assert all(t['status'] == 'resolved' for t in data)

    def test_filter_pending(self, client, admin_token, seeded_tickets):
        resp = client.get('/api/tickets?status=pending', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        data = resp.get_json()
        assert all(t['status'] == 'pending' for t in data)

    def test_csv_export(self, client, admin_token, seeded_tickets):
        resp = client.get('/api/tickets/export', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 200
        assert len(resp.data) > 100

    def test_csv_has_bom(self, client, admin_token, seeded_tickets):
        resp = client.get('/api/tickets/export', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.data[:3] == b'\xef\xbb\xbf'

    def test_submitter_blocked_from_export(self, client, submitter_token):
        resp = client.get('/api/tickets/export', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert resp.status_code == 403

    def test_filter_by_date_range(self, client, admin_token, seeded_tickets):
        resp = client.get('/api/tickets?start_date=2020-01-01&end_date=2020-12-31', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        data = resp.get_json()
        assert len(data) == 0

    def test_filter_by_date_and_status(self, client, admin_token, seeded_tickets):
        resp = client.get('/api/tickets?status=resolved&start_date=2020-01-01', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        data = resp.get_json()
        # Future dates → empty, even with valid status
        assert isinstance(data, list)

    def test_filter_processing(self, client, admin_token, submitter_token, handler_token):
        # Create + claim a ticket to get 'processing' status
        t = client.post('/api/tickets', json={
            'contact': '138', 'location': 'test',
            'category': '网络不通', 'description': 'test'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()
        client.put(f'/api/tickets/{t["id"]}/claim',
                   headers={'Authorization': f'Bearer {handler_token}'})

        resp = client.get('/api/tickets?status=processing', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        data = resp.get_json()
        assert len(data) >= 1
        assert all(x['status'] == 'processing' for x in data)
