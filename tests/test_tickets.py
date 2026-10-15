# -*- coding: utf-8 -*-
"""Ticket CRUD, claim, and complete tests."""
import pytest


class TestTickets:
    """Ticket lifecycle tests."""

    def test_submitter_submit(self, client, submitter_token):
        resp = client.post('/api/tickets', json={
            'contact': '13800001111',
            'location': '图书馆302',
            'category': '网络不通',
            'description': '完全无法上网'
        }, headers={'Authorization': f'Bearer {submitter_token}'})
        data = resp.get_json()
        assert resp.status_code == 201
        assert data['status'] == 'pending'
        assert data['id'] is not None

    def test_submitter_submit_multiple(self, client, submitter_token):
        r1 = client.post('/api/tickets', json={
            'contact': '13800001111', 'location': '图书馆302',
            'category': '网络不通', 'description': '无法上网'
        }, headers={'Authorization': f'Bearer {submitter_token}'})
        r2 = client.post('/api/tickets', json={
            'contact': '13900002222', 'location': '教学楼A201',
            'category': '网速慢', 'description': '网页慢'
        }, headers={'Authorization': f'Bearer {submitter_token}'})
        assert r1.status_code == 201
        assert r2.status_code == 201

    def test_submitter_sees_own_tickets(self, client, submitter_token):
        # Submit 2 tickets first
        for _ in range(2):
            client.post('/api/tickets', json={
                'contact': '13800001111', 'location': '测试',
                'category': '网络不通', 'description': 'test'
            }, headers={'Authorization': f'Bearer {submitter_token}'})

        resp = client.get('/api/tickets', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert len(resp.get_json()) == 2

    def test_handler_sees_pending(self, client, submitter_token, handler_token):
        # submitter submits a ticket
        client.post('/api/tickets', json={
            'contact': '13800001111', 'location': '测试',
            'category': '网络不通', 'description': 'test'
        }, headers={'Authorization': f'Bearer {submitter_token}'})

        resp = client.get('/api/tickets', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        data = resp.get_json()
        pending = [t for t in data if t['status'] == 'pending']
        assert len(pending) >= 1

    def test_handler_blocked_from_submit(self, client, handler_token):
        resp = client.post('/api/tickets', json={
            'contact': '138', 'location': 'test',
            'category': '网络不通', 'description': 'test'
        }, headers={'Authorization': f'Bearer {handler_token}'})
        assert resp.status_code == 403

    def test_empty_fields_rejected(self, client, submitter_token):
        resp = client.post('/api/tickets', json={
            'contact': '', 'location': '', 'category': ''
        }, headers={'Authorization': f'Bearer {submitter_token}'})
        assert resp.status_code == 400

    def test_invalid_category_rejected(self, client, submitter_token):
        resp = client.post('/api/tickets', json={
            'contact': '1', 'location': '2', 'category': '不存在的类型'
        }, headers={'Authorization': f'Bearer {submitter_token}'})
        assert resp.status_code == 400

    def test_xss_stripped(self, client, submitter_token):
        resp = client.post('/api/tickets', json={
            'contact': '<b>138</b>',
            'location': '<script>alert(1)</script>三楼',
            'category': '网络不通',
            'description': '<img src=x onerror=alert(1)>test'
        }, headers={'Authorization': f'Bearer {submitter_token}'})
        data = resp.get_json()
        assert '<' not in str(data.get('contact', ''))
        assert 'script' not in str(data.get('location', ''))

    def test_solution_sanitized(self, client, submitter_token, handler_token):
        # Submit and claim
        resp = client.post('/api/tickets', json={
            'contact': '138', 'location': 'test',
            'category': '网络不通', 'description': 'test'
        }, headers={'Authorization': f'Bearer {submitter_token}'})
        tid = resp.get_json()['id']

        client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })

        # Complete with XSS in solution
        resp = client.put(f'/api/tickets/{tid}/complete', json={
            'solution': '<script>alert(1)</script>done'
        }, headers={'Authorization': f'Bearer {handler_token}'})
        data = resp.get_json()
        assert 'script' not in str(data.get('solution', ''))


class TestClaimComplete:
    """Claim and complete workflow."""

    @pytest.fixture(scope='function')
    def submitted_tickets(self, client, submitter_token):
        t1 = client.post('/api/tickets', json={
            'contact': '13800001111', 'location': '图书馆302',
            'category': '网络不通', 'description': '无法上网'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()
        t2 = client.post('/api/tickets', json={
            'contact': '13900002222', 'location': '教学楼A201',
            'category': '网速慢', 'description': '网页慢'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()
        return t1, t2

    def test_claim(self, client, submitted_tickets, handler_token):
        tid = submitted_tickets[0]['id']
        resp = client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        data = resp.get_json()
        assert data['status'] == 'processing'
        assert data['assignee_name'] != ''

    def test_submitter_sees_processing(self, client, submitted_tickets, handler_token, submitter_token):
        tid = submitted_tickets[0]['id']
        client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        resp = client.get('/api/tickets', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        t = next(t for t in resp.get_json() if t['id'] == tid)
        assert t['status'] == 'processing'

    def test_reclaim_rejected(self, client, submitted_tickets, handler_token):
        tid = submitted_tickets[0]['id']
        client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        resp = client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        assert resp.status_code == 400

    def test_submitter_cannot_claim(self, client, submitted_tickets, submitter_token):
        tid = submitted_tickets[1]['id']
        resp = client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert resp.status_code == 403

    def test_complete(self, client, submitted_tickets, handler_token):
        tid = submitted_tickets[0]['id']
        client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        resp = client.put(f'/api/tickets/{tid}/complete', json={
            'solution': '重插网线，重新配置IP'
        }, headers={'Authorization': f'Bearer {handler_token}'})
        data = resp.get_json()
        assert data['status'] == 'resolved'
        assert '重插网线' in data['solution']

    def test_complete_empty_solution(self, client, submitted_tickets, handler_token):
        tid = submitted_tickets[1]['id']
        client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        resp = client.put(f'/api/tickets/{tid}/complete', json={
            'solution': ''
        }, headers={'Authorization': f'Bearer {handler_token}'})
        assert resp.get_json()['status'] == 'resolved'

    def test_cannot_complete_others_ticket(self, client, submitted_tickets, handler_token, handler2_token):
        tid = submitted_tickets[0]['id']
        # S001 claims
        client.put(f'/api/tickets/{tid}/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        # S002 tries to complete
        resp = client.put(f'/api/tickets/{tid}/complete', json={
            'solution': 'done'
        }, headers={'Authorization': f'Bearer {handler2_token}'})
        assert resp.status_code == 403

    def test_claim_nonexistent_ticket(self, client, handler_token):
        resp = client.put('/api/tickets/99999/claim', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        assert resp.status_code == 404

    def test_complete_nonexistent_ticket(self, client, handler_token):
        resp = client.put('/api/tickets/99999/complete', json={
            'solution': 'done'
        }, headers={'Authorization': f'Bearer {handler_token}'})
        assert resp.status_code == 404

    def test_complete_without_claim(self, client, submitted_tickets, handler_token):
        tid = submitted_tickets[1]['id']
        resp = client.put(f'/api/tickets/{tid}/complete', json={
            'solution': 'done'
        }, headers={'Authorization': f'Bearer {handler_token}'})
        assert resp.status_code == 403
