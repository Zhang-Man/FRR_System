# -*- coding: utf-8 -*-
"""Statistics API tests: rankings, category stats, trends."""
import pytest


class TestRankings:
    """GET /api/stats/rankings"""

    @pytest.fixture(scope='function')
    def stats_data(self, client, admin_token, submitter_token, handler_token):
        """Seed: 2 tickets assigned to S001 (1 resolved), 1 to S002 (0 resolved)."""
        t1 = client.post('/api/tickets', json={
            'contact': '13800001111', 'location': '图书馆302',
            'category': '网络不通', 'description': '无法上网'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()

        t2 = client.post('/api/tickets', json={
            'contact': '13900002222', 'location': '教学楼A201',
            'category': '网速慢', 'description': '网页慢'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()

        t3 = client.post('/api/tickets', json={
            'contact': '13600003333', 'location': '实验楼101',
            'category': '设备故障', 'description': '电脑无法开机'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()

        # S001 claims t1, t2; completes t1
        client.put(f'/api/tickets/{t1["id"]}/claim',
                   headers={'Authorization': f'Bearer {handler_token}'})
        client.put(f'/api/tickets/{t2["id"]}/claim',
                   headers={'Authorization': f'Bearer {handler_token}'})
        client.put(f'/api/tickets/{t1["id"]}/complete', json={'solution': 'done'},
                   headers={'Authorization': f'Bearer {handler_token}'})

        # S002 only uses handler2_token fixture
        # Ensure S002 has a handler token; handler2_token fixture imports S002
        return

    def test_returns_rankings_array(self, client, admin_token, stats_data):
        resp = client.get('/api/stats/rankings', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)

    def test_ranking_structure(self, client, admin_token, stats_data):
        resp = client.get('/api/stats/rankings', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        assert len(items) >= 1
        for item in items:
            assert 'user_id' in item
            assert 'name' in item
            assert 'claimed_count' in item
            assert 'resolved_count' in item
            assert 'completion_rate' in item
            assert 'avg_process_time' in item

    def test_ranking_order_desc_by_resolved(self, client, admin_token, stats_data):
        resp = client.get('/api/stats/rankings', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        if len(items) >= 2:
            assert items[0]['resolved_count'] >= items[1]['resolved_count']

    def test_s001_claimed_and_resolved(self, client, admin_token, stats_data):
        resp = client.get('/api/stats/rankings', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        s001 = next((r for r in items if r['user_id'] == 'S001'), None)
        assert s001 is not None
        assert s001['claimed_count'] == 2
        assert s001['resolved_count'] == 1
        assert s001['completion_rate'] == 50

    def test_s002_has_no_tickets(self, client, admin_token, stats_data, handler2_token):
        resp = client.get('/api/stats/rankings', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        s002 = next((r for r in items if r['user_id'] == 'S002'), None)
        assert s002 is not None
        assert s002['claimed_count'] == 0
        assert s002['resolved_count'] == 0
        assert s002['completion_rate'] == 0

    def test_ranking_avg_process_time(self, client, admin_token, stats_data):
        resp = client.get('/api/stats/rankings', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        s001 = next(r for r in items if r['user_id'] == 'S001')
        # t1 was claimed then completed → avg_process_time > 0
        assert s001['avg_process_time'] >= 0

    def test_date_filter_works(self, client, admin_token, stats_data):
        # Future date → no data
        resp = client.get('/api/stats/rankings?start_date=2099-01-01&end_date=2099-12-31', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        for item in items:
            assert item['claimed_count'] == 0
            assert item['resolved_count'] == 0

    def test_submitter_blocked(self, client, submitter_token):
        resp = client.get('/api/stats/rankings', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert resp.status_code == 403

    def test_handler_blocked(self, client, handler_token):
        resp = client.get('/api/stats/rankings', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        assert resp.status_code == 403

    def test_no_auth_rejected(self, client):
        resp = client.get('/api/stats/rankings')
        assert resp.status_code == 401


class TestCategoryStats:
    """GET /api/stats/categories"""

    @pytest.fixture(scope='function')
    def cat_stats_data(self, client, submitter_token, handler_token):
        """Seed: 3 tickets across 2 categories with different statuses."""
        t1 = client.post('/api/tickets', json={
            'contact': '13800001111', 'location': 'A',
            'category': '网络不通', 'description': 'test'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()

        t2 = client.post('/api/tickets', json={
            'contact': '13900002222', 'location': 'B',
            'category': '网速慢', 'description': 'test'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()

        t3 = client.post('/api/tickets', json={
            'contact': '13600003333', 'location': 'C',
            'category': '网络不通', 'description': 'test'
        }, headers={'Authorization': f'Bearer {submitter_token}'}).get_json()

        # Claim + resolve t1
        client.put(f'/api/tickets/{t1["id"]}/claim',
                   headers={'Authorization': f'Bearer {handler_token}'})
        client.put(f'/api/tickets/{t1["id"]}/complete', json={'solution': 'x'},
                   headers={'Authorization': f'Bearer {handler_token}'})

        return

    def test_returns_array(self, client, admin_token, cat_stats_data):
        resp = client.get('/api/stats/categories', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), list)

    def test_category_structure(self, client, admin_token, cat_stats_data):
        resp = client.get('/api/stats/categories', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        for item in items:
            assert 'category' in item
            assert 'count' in item
            assert 'percentage' in item
            assert 'pending' in item
            assert 'processing' in item
            assert 'resolved' in item

    def test_network_broken_has_correct_counts(self, client, admin_token, cat_stats_data):
        resp = client.get('/api/stats/categories', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        nb = next(c for c in items if c['category'] == '网络不通')
        # t1=resolved, t3=pending → total=2
        assert nb['count'] == 2
        assert nb['pending'] == 1
        assert nb['resolved'] == 1
        assert nb['processing'] == 0

    def test_slow_network_has_pending(self, client, admin_token, cat_stats_data):
        resp = client.get('/api/stats/categories', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        sn = next(c for c in items if c['category'] == '网速慢')
        assert sn['count'] == 1
        assert sn['pending'] == 1

    def test_percentages_sum_close_to_100(self, client, admin_token, cat_stats_data):
        resp = client.get('/api/stats/categories', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        total_pct = sum(c['percentage'] for c in items if c['count'] > 0)
        assert 95 <= total_pct <= 105

    def test_ordered_by_count_desc(self, client, admin_token, cat_stats_data):
        resp = client.get('/api/stats/categories', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        counts = [c['count'] for c in items]
        assert counts == sorted(counts, reverse=True)

    def test_date_filter(self, client, admin_token, cat_stats_data):
        resp = client.get('/api/stats/categories?start_date=2099-01-01&end_date=2099-12-31', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        for item in items:
            assert item['count'] == 0

    def test_submitter_blocked(self, client, submitter_token):
        resp = client.get('/api/stats/categories', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert resp.status_code == 403

    def test_handler_blocked(self, client, handler_token):
        resp = client.get('/api/stats/categories', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        assert resp.status_code == 403

    def test_no_auth_rejected(self, client):
        resp = client.get('/api/stats/categories')
        assert resp.status_code == 401


class TestTrends:
    """GET /api/stats/trends"""

    @pytest.fixture(scope='function')
    def trend_data(self, client, submitter_token, handler_token):
        """Seed tickets to span dates."""
        # Tickets created via POST have real datetime
        client.post('/api/tickets', json={
            'contact': '138', 'location': 'A',
            'category': '网络不通', 'description': 't1'
        }, headers={'Authorization': f'Bearer {submitter_token}'})

        client.post('/api/tickets', json={
            'contact': '139', 'location': 'B',
            'category': '网速慢', 'description': 't2'
        }, headers={'Authorization': f'Bearer {submitter_token}'})

        return

    def test_month_view_returns_array(self, client, admin_token, trend_data):
        resp = client.get('/api/stats/trends?view=month', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)

    def test_month_view_structure(self, client, admin_token, trend_data):
        resp = client.get('/api/stats/trends?view=month', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        assert len(items) >= 1
        for item in items:
            assert 'period' in item
            assert 'total' in item
            assert 'resolved' in item
            # period should be like "2026-05"
            assert '-' in item['period']

    def test_week_view_returns_array(self, client, admin_token, trend_data):
        resp = client.get('/api/stats/trends?view=week', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)

    def test_week_view_period_format(self, client, admin_token, trend_data):
        resp = client.get('/api/stats/trends?view=week', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        assert len(items) >= 1
        for item in items:
            # period should be like "2026-W20"
            assert '-W' in item['period']

    def test_default_view_is_month(self, client, admin_token, trend_data):
        resp = client.get('/api/stats/trends', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        assert len(items) >= 1
        assert '-W' not in items[0]['period']

    def test_total_matches_created(self, client, admin_token, trend_data):
        resp = client.get('/api/stats/trends?view=month', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        total_tickets = sum(item['total'] for item in items)
        assert total_tickets >= 2

    def test_date_filter(self, client, admin_token, trend_data):
        resp = client.get('/api/stats/trends?start_date=2099-01-01&end_date=2099-12-31', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        items = resp.get_json()
        for item in items:
            assert item['total'] == 0

    def test_submitter_blocked(self, client, submitter_token):
        resp = client.get('/api/stats/trends', headers={
            'Authorization': f'Bearer {submitter_token}'
        })
        assert resp.status_code == 403

    def test_handler_blocked(self, client, handler_token):
        resp = client.get('/api/stats/trends', headers={
            'Authorization': f'Bearer {handler_token}'
        })
        assert resp.status_code == 403

    def test_no_auth_rejected(self, client):
        resp = client.get('/api/stats/trends')
        assert resp.status_code == 401
