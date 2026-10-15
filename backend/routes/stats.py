# -*- coding: utf-8 -*-
import logging
from flask import Blueprint, request, jsonify, g
from auth import login_required, require_role
from models import get_db, dicts_from_rows

logger = logging.getLogger('frr.stats')
stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/stats/rankings', methods=['GET'])
@login_required
@require_role('admin')
def rankings():
    start = request.args.get('start_date', '')
    end = request.args.get('end_date', '')
    db = get_db()

    query = '''
        SELECT u.user_id, u.name,
            COUNT(CASE WHEN t.status IN ('processing','resolved') THEN 1 END) AS claimed_count,
            COUNT(CASE WHEN t.status = 'resolved' THEN 1 END) AS resolved_count,
            CASE WHEN COUNT(CASE WHEN t.status IN ('processing','resolved') THEN 1 END) > 0
                THEN CAST(COUNT(CASE WHEN t.status='resolved' THEN 1 END)*100.0/
                     COUNT(CASE WHEN t.status IN ('processing','resolved') THEN 1 END) AS INTEGER)
                ELSE 0 END AS completion_rate,
            COALESCE(CAST(AVG(CASE WHEN t.status='resolved'
                THEN (julianday(t.completed_at)-julianday(t.created_at))*1440 END) AS INTEGER), 0) AS avg_process_time,
            COALESCE(c.collaboration_count, 0) AS collaboration_count
        FROM users u
        LEFT JOIN tickets t ON t.assignee_id = u.user_id
    '''

    t_filter = ""
    t_params = []
    if start:
        t_filter += " AND t.created_at >= ?"
        t_params.append(start + ' 00:00:00')
    if end:
        t_filter += " AND t.created_at <= ?"
        t_params.append(end + ' 23:59:59')
    query += t_filter

    collab_filter = ""
    collab_params = []
    if start:
        collab_filter += " AND t2.completed_at >= ?"
        collab_params.append(start + ' 00:00:00')
    if end:
        collab_filter += " AND t2.completed_at <= ?"
        collab_params.append(end + ' 23:59:59')

    query += f'''
        LEFT JOIN (
            SELECT tc.user_id, COUNT(*) AS collaboration_count
            FROM ticket_collaborators tc
            JOIN tickets t2 ON t2.id = tc.ticket_id AND t2.status = 'resolved'
            WHERE tc.user_id != t2.assignee_id
            {collab_filter}
            GROUP BY tc.user_id
        ) c ON c.user_id = u.user_id
    '''
    query += " WHERE u.role = 'handler'"
    query += " GROUP BY u.user_id ORDER BY resolved_count DESC"

    rows = db.execute(query, t_params + collab_params).fetchall()
    db.close()
    return jsonify(dicts_from_rows(rows))


@stats_bp.route('/stats/categories', methods=['GET'])
@login_required
@require_role('admin')
def category_stats():
    start = request.args.get('start_date', '')
    end = request.args.get('end_date', '')
    db = get_db()

    count_query = "SELECT COUNT(*) FROM tickets WHERE 1=1"
    count_params = []
    if start:
        count_query += " AND created_at >= ?"
        count_params.append(start + ' 00:00:00')
    if end:
        count_query += " AND created_at <= ?"
        count_params.append(end + ' 23:59:59')
    total = db.execute(count_query, count_params).fetchone()[0]

    query = '''
        SELECT category,
            COUNT(*) AS count,
            COUNT(CASE WHEN status='pending' THEN 1 END) AS pending,
            COUNT(CASE WHEN status='processing' THEN 1 END) AS processing,
            COUNT(CASE WHEN status='resolved' THEN 1 END) AS resolved
        FROM tickets
        WHERE 1=1
    '''
    params = []
    if start:
        query += " AND created_at >= ?"
        params.append(start + ' 00:00:00')
    if end:
        query += " AND created_at <= ?"
        params.append(end + ' 23:59:59')
    query += " GROUP BY category ORDER BY count DESC"

    rows = db.execute(query, params).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['percentage'] = round(d['count'] * 100.0 / total) if total > 0 else 0
        result.append(d)
    db.close()
    return jsonify(result)


@stats_bp.route('/stats/trends', methods=['GET'])
@login_required
@require_role('admin')
def trends():
    start = request.args.get('start_date', '')
    end = request.args.get('end_date', '')
    view = request.args.get('view', 'month')
    db = get_db()

    if view == 'week':
        period_expr = "substr('0' || ((strftime('%j', created_at) - 1) / 7 + 1), -2, 2)"
        period_label = "strftime('%Y', created_at) || '-W' || " + period_expr
    else:
        period_label = "substr(created_at, 1, 7)"

    query = f'''
        SELECT {period_label} AS period,
            COUNT(*) AS total,
            COUNT(CASE WHEN status='resolved' THEN 1 END) AS resolved
        FROM tickets
        WHERE 1=1
    '''
    params = []
    if start:
        query += " AND created_at >= ?"
        params.append(start + ' 00:00:00')
    if end:
        query += " AND created_at <= ?"
        params.append(end + ' 23:59:59')
    query += " GROUP BY period ORDER BY period"

    rows = db.execute(query, params).fetchall()
    db.close()
    return jsonify(dicts_from_rows(rows))
