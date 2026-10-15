# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify, g
from auth import login_required, require_role
from models import get_db, dict_from_row, dicts_from_rows, sanitize
from i18n import t

categories_bp = Blueprint('categories', __name__)


@categories_bp.route('/categories', methods=['GET'])
def list_categories():
    db = get_db()
    rows = db.execute("SELECT id, name FROM categories ORDER BY id").fetchall()
    db.close()
    return jsonify(dicts_from_rows(rows))


@categories_bp.route('/categories', methods=['POST'])
@login_required
@require_role('admin')
def create_category():
    data = request.get_json()
    name = sanitize(data.get('name', '')) if data else ''
    if not name:
        return jsonify({'error': '\u8bf7\u8f93\u5165\u6545\u969c\u7c7b\u578b\u540d\u79f0'}), 400
    if len(name) > 50:
        return jsonify({'error': '\u540d\u79f0\u4e0d\u80fd\u8d85\u8fc750\u4e2a\u5b57\u7b26'}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM categories WHERE name = ?", (name,)).fetchone()
    if existing:
        db.close()
        return jsonify({'error': '\u8be5\u6545\u969c\u7c7b\u578b\u5df2\u5b58\u5728'}), 400

    cursor = db.execute("INSERT INTO categories (name) VALUES (?)", (name,))
    db.commit()
    cat = db.execute("SELECT id, name FROM categories WHERE id = ?", (cursor.lastrowid,)).fetchone()
    db.close()
    return jsonify(dict_from_row(cat)), 201


@categories_bp.route('/categories/<int:cat_id>', methods=['DELETE'])
@login_required
@require_role('admin')
def delete_category(cat_id):
    db = get_db()
    cat = db.execute("SELECT * FROM categories WHERE id = ?", (cat_id,)).fetchone()
    if not cat:
        db.close()
        return jsonify({'error': '\u6545\u969c\u7c7b\u578b\u4e0d\u5b58\u5728'}), 404

    # Check if any tickets use this category
    used = db.execute("SELECT COUNT(*) FROM tickets WHERE category = ?", (cat['name'],)).fetchone()[0]
    if used > 0:
        db.close()
        return jsonify({'error': f'\u8be5\u7c7b\u578b\u6709{used}\u6761\u5de5\u5355\u5728\u7528\uff0c\u65e0\u6cd5\u5220\u9664'}), 400

    db.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})
