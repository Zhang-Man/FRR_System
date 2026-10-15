# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify, g
from auth import login_required, require_role
from models import get_db, dicts_from_rows, sanitize
from i18n import t

users_bp = Blueprint('users', __name__)


@users_bp.route('/users', methods=['GET'])
@login_required
@require_role('admin')
def list_users():
    db = get_db()
    rows = db.execute("SELECT id, user_id, name, role, phone, department FROM users ORDER BY role, user_id").fetchall()
    db.close()
    return jsonify(dicts_from_rows(rows))


@users_bp.route('/handlers', methods=['GET'])
@login_required
def list_handlers():
    db = get_db()
    rows = db.execute(
        "SELECT user_id, name AS user_name FROM users WHERE role = 'handler' ORDER BY user_id"
    ).fetchall()
    db.close()
    return jsonify(dicts_from_rows(rows))


@users_bp.route('/users/<int:user_id>', methods=['DELETE'])
@login_required
@require_role('admin')
def delete_user(user_id):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        db.close()
        return jsonify({'error': t('user_not_found')}), 404
    if user['user_id'] == g.current_user['user_id']:
        db.close()
        return jsonify({'error': '\u4e0d\u80fd\u5220\u9664\u81ea\u5df1'}), 400

    # 将被删用户的所有工单转给 S001
    deleted_uid = user['user_id']
    s001 = db.execute("SELECT user_id, name FROM users WHERE user_id = 'S001'").fetchone()
    if s001 and deleted_uid != 'S001':
        db.execute(
            "UPDATE tickets SET assignee_id = ?, assignee_name = ? WHERE assignee_id = ?",
            ('S001', s001['name'], deleted_uid)
        )

    db.execute("DELETE FROM ticket_collaborators WHERE user_id = ?", (deleted_uid,))

    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})


@users_bp.route('/users/import', methods=['POST'])
@login_required
@require_role('admin')
def import_users():
    data = request.get_json()
    if not data or 'users' not in data:
        return jsonify({'error': t('provide_users')}), 400

    users = data['users']
    if not isinstance(users, list) or len(users) == 0:
        return jsonify({'error': t('empty_users')}), 400

    db = get_db()

    success_count = 0
    errors = []
    for u in users:
        user_id = sanitize(u.get('user_id', '')).strip()
        name = sanitize(u.get('name', '')).strip()
        role = sanitize(u.get('role', '')).strip()
        phone = sanitize(u.get('phone', ''))
        department = sanitize(u.get('department', ''))
        if not user_id or not name or role not in ('submitter', 'handler', 'admin'):
            errors.append(f'{user_id or "?"}: {t("incomplete_user")}')
            continue
        try:
            db.execute(
                "INSERT OR REPLACE INTO users (user_id, name, role, phone, department) VALUES (?, ?, ?, ?, ?)",
                (user_id, name, role, phone, department)
            )
            success_count += 1
        except Exception as e:
            errors.append(f'{user_id}: {str(e)}')

    db.commit()
    db.close()
    return jsonify({
        'imported': success_count,
        'errors': errors
    })
