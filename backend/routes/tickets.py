# -*- coding: utf-8 -*-
import csv
import io
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, g, Response
from auth import login_required, require_role
from models import get_db, dict_from_row, dicts_from_rows, sanitize
from i18n import t

logger = logging.getLogger('frr.tickets')
tickets_bp = Blueprint('tickets', __name__)

STATUS_MAP_DISPLAY = {
    'pending': t('status_pending'),
    'processing': t('status_processing'),
    'resolved': t('status_resolved')
}


@tickets_bp.route('/tickets', methods=['POST'])
@login_required
@require_role('submitter')
def create_ticket():
    data = request.get_json()
    if not data:
        return jsonify({'error': t('missing_fields')}), 400

    contact = sanitize(data.get('contact', ''))
    location = sanitize(data.get('location', ''))
    category = sanitize(data.get('category', ''))
    description = sanitize(data.get('description', ''))

    if not contact or not location or not category:
        return jsonify({'error': t('missing_fields')}), 400
    if len(contact) > 100 or len(location) > 200 or len(description) > 500:
        return jsonify({'error': '\u8f93\u5165\u5185\u5bb9\u8d85\u8fc7\u957f\u5ea6\u9650\u5236'}), 400

    db = get_db()
    # validate category exists
    valid = db.execute("SELECT id FROM categories WHERE name = ?", (category,)).fetchone()
    if not valid:
        db.close()
        return jsonify({'error': t('invalid_category')}), 400

    db = get_db()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor = db.execute(
        '''INSERT INTO tickets (reporter_id, reporter_name, contact, location, category, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (g.current_user['user_id'], g.current_user['name'], contact, location, category, description, now, now)
    )
    ticket_id = cursor.lastrowid
    db.commit()

    ticket = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    db.close()
    logger.info('Ticket #%d created by %s, category=%s', ticket_id, g.current_user['user_id'], category)
    return jsonify(dict_from_row(ticket)), 201


def _attach_collaborators(db, tickets_list):
    """Batch-fetch collaborators for resolved tickets, avoiding N+1 queries."""
    resolved_ids = [t['id'] for t in tickets_list if t['status'] == 'resolved']
    if not resolved_ids:
        return
    placeholders = ','.join('?' * len(resolved_ids))
    collab_rows = db.execute(
        f"SELECT ticket_id, user_id, user_name FROM ticket_collaborators WHERE ticket_id IN ({placeholders})",
        resolved_ids
    ).fetchall()
    grouped = {}
    for c in collab_rows:
        grouped.setdefault(c['ticket_id'], []).append(
            {'user_id': c['user_id'], 'user_name': c['user_name']}
        )
    for t in tickets_list:
        t['collaborators'] = grouped.get(t['id'], [])


@tickets_bp.route('/tickets', methods=['GET'])
@login_required
def list_tickets():
    user = g.current_user
    db = get_db()

    if user['role'] == 'submitter':
        rows = db.execute(
            "SELECT * FROM tickets WHERE reporter_id = ? ORDER BY created_at DESC",
            (user['user_id'],)
        ).fetchall()
    elif user['role'] == 'handler':
        pending = db.execute(
            "SELECT * FROM tickets WHERE status = 'pending' ORDER BY created_at DESC"
        ).fetchall()
        claimed = db.execute(
            "SELECT * FROM tickets WHERE assignee_id = ? ORDER BY updated_at DESC",
            (user['user_id'],)
        ).fetchall()
        collab = db.execute(
            """SELECT t.* FROM tickets t
               INNER JOIN ticket_collaborators tc ON tc.ticket_id = t.id
               WHERE tc.user_id = ? AND tc.user_id != t.assignee_id AND t.status = 'resolved'
               ORDER BY t.updated_at DESC""",
            (user['user_id'],)
        ).fetchall()
        rows = pending + claimed + collab
    else:
        query = "SELECT * FROM tickets WHERE 1=1"
        params = []
        start = request.args.get('start_date')
        end = request.args.get('end_date')
        status = request.args.get('status')
        if start:
            query += " AND created_at >= ?"
            params.append(start + ' 00:00:00')
        if end:
            query += " AND created_at <= ?"
            params.append(end + ' 23:59:59')
        if status and status in ('pending', 'processing', 'resolved'):
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC"
        rows = db.execute(query, params).fetchall()

    ticket_list = dicts_from_rows(rows)
    _attach_collaborators(db, ticket_list)
    db.close()
    return jsonify(ticket_list)


@tickets_bp.route('/tickets/<int:ticket_id>/claim', methods=['PUT'])
@login_required
@require_role('handler')
def claim_ticket(ticket_id):
    db = get_db()
    ticket = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    if not ticket:
        db.close()
        return jsonify({'error': t('ticket_not_found')}), 404
    if ticket['status'] != 'pending':
        db.close()
        return jsonify({'error': t('ticket_already_claimed')}), 400

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db.execute(
        "UPDATE tickets SET assignee_id = ?, assignee_name = ?, status = 'processing', updated_at = ? WHERE id = ?",
        (g.current_user['user_id'], g.current_user['name'], now, ticket_id)
    )
    db.commit()
    updated = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    db.close()
    logger.info('Ticket #%d claimed by %s', ticket_id, g.current_user['user_id'])
    return jsonify(dict_from_row(updated))


@tickets_bp.route('/tickets/<int:ticket_id>/complete', methods=['PUT'])
@login_required
@require_role('handler')
def complete_ticket(ticket_id):
    db = get_db()
    ticket = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    if not ticket:
        db.close()
        return jsonify({'error': t('ticket_not_found')}), 404
    if ticket['assignee_id'] != g.current_user['user_id']:
        db.close()
        return jsonify({'error': t('not_your_ticket')}), 403
    if ticket['status'] != 'processing':
        db.close()
        return jsonify({'error': t('ticket_not_processing')}), 400

    data = request.get_json() or {}
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    solution = sanitize(data.get('solution', ''))

    db.execute(
        "UPDATE tickets SET status = 'resolved', solution = ?, completed_at = ?, updated_at = ? WHERE id = ?",
        (solution, now, now, ticket_id)
    )

    collaborator_ids = data.get('collaborator_ids', [])
    if not isinstance(collaborator_ids, list):
        db.close()
        return jsonify({'error': 'collaborator_ids must be a list'}), 400
    if len(collaborator_ids) > 2:
        db.close()
        return jsonify({'error': '\u6700\u591a\u9009\u62e9 2 \u540d\u534f\u4f5c\u8005'}), 400

    seen = set()
    for uid in collaborator_ids:
        if not isinstance(uid, str) or not uid.strip():
            continue
        uid = uid.strip()
        if uid == g.current_user['user_id']:
            continue
        if uid in seen:
            continue
        seen.add(uid)
        collab_user = db.execute(
            "SELECT user_id, name FROM users WHERE user_id = ? AND role = 'handler'",
            (uid,)
        ).fetchone()
        if collab_user:
            db.execute(
                "INSERT INTO ticket_collaborators (ticket_id, user_id, user_name) VALUES (?, ?, ?)",
                (ticket_id, collab_user['user_id'], collab_user['name'])
            )

    db.commit()
    updated = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    result = dict_from_row(updated)
    collabs = db.execute(
        "SELECT user_id, user_name FROM ticket_collaborators WHERE ticket_id = ?",
        (ticket_id,)
    ).fetchall()
    result['collaborators'] = [{'user_id': c['user_id'], 'user_name': c['user_name']} for c in collabs]
    db.close()
    logger.info('Ticket #%d completed by %s with %d collaborators', ticket_id, g.current_user['user_id'], len(collabs))
    return jsonify(result)


@tickets_bp.route('/tickets/export', methods=['GET'])
@login_required
@require_role('admin')
def export_csv():
    db = get_db()
    query = "SELECT * FROM tickets WHERE 1=1"
    params = []
    start = request.args.get('start_date')
    end = request.args.get('end_date')
    if start:
        query += " AND created_at >= ?"
        params.append(start + ' 00:00:00')
    if end:
        query += " AND created_at <= ?"
        params.append(end + ' 23:59:59')
    query += " ORDER BY created_at DESC"
    rows = db.execute(query, params).fetchall()
    ticket_list = dicts_from_rows(rows)
    _attach_collaborators(db, ticket_list)
    db.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(t('csv_header'))
    for r in ticket_list:
        collab_names = '、'.join(c['user_name'] for c in r.get('collaborators', []))
        writer.writerow([
            r['id'],
            r['reporter_name'],
            r['reporter_id'] or '-',
            r['contact'],
            r['location'],
            r['category'],
            r['description'],
            r['assignee_name'] or '-',
            collab_names or '-',
            r['assignee_id'] or '-',
            r['solution'] or '-',
            r['created_at'],
            r['completed_at'] or '-',
            STATUS_MAP_DISPLAY.get(r['status'], r['status'])
        ])

    output.seek(0)
    return Response(
        output.getvalue().encode('utf-8-sig'),
        mimetype='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename=tickets_{datetime.now().strftime("%Y%m%d")}.csv'}
    )
