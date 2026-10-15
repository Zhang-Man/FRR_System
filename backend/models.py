# -*- coding: utf-8 -*-
import sqlite3
import os
import html
import re


def _db_path():
    return os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'data.db'))


def sanitize(text):
    """Strip HTML tags and limit length to prevent injection."""
    if not text:
        return ''
    text = re.sub(r'<[^>]*>', '', str(text))
    text = html.unescape(text)
    return text.strip()[:500]

def get_db():
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA encoding = 'UTF-8'")
    return conn

def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('submitter','handler','admin')),
            phone TEXT DEFAULT '',
            department TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_id TEXT NOT NULL,
            reporter_name TEXT NOT NULL,
            contact TEXT NOT NULL,
            location TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            assignee_id TEXT,
            assignee_name TEXT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','resolved')),
            solution TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS ticket_collaborators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        );
    ''')

    # migration: add solution column if missing
    cols = [c[1] for c in conn.execute("PRAGMA table_info(tickets)").fetchall()]
    if 'solution' not in cols:
        conn.execute("ALTER TABLE tickets ADD COLUMN solution TEXT DEFAULT ''")
        conn.commit()

    # seed default admin if not exists
    existing = conn.execute("SELECT id FROM users WHERE role = 'admin'").fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO users (user_id, name, role) VALUES (?, ?, ?)",
            (os.environ.get('ADMIN_USER_ID', 'FrrSystemAdmin'), '\u7ba1\u7406\u5458', 'admin')
        )

    # seed default handler (S001) as fallback assignee
    s001 = conn.execute("SELECT id FROM users WHERE user_id = 'S001'").fetchone()
    if not s001:
        conn.execute(
            "INSERT INTO users (user_id, name, role) VALUES (?, ?, ?)",
            ('S001', '\u8fd0\u7ef4\u5c0f\u7ec4', 'handler')
        )

    # seed default categories if empty
    cat_count = conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    if cat_count == 0:
        for name in ['\u7f51\u7edc\u4e0d\u901a', '\u7f51\u901f\u6162', '\u8bbe\u5907\u6545\u969c', '\u5176\u4ed6']:
            conn.execute("INSERT INTO categories (name) VALUES (?)", (name,))

    conn.commit()
    conn.close()

def dict_from_row(row):
    if row is None:
        return None
    return dict(row)

def dicts_from_rows(rows):
    return [dict(r) for r in rows]
