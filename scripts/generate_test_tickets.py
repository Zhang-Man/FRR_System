# -*- coding: utf-8 -*-
"""Generate 800 test tickets directly into SQLite database.

Usage: python scripts/generate_test_tickets.py
- Uses the same DB_PATH as the backend (default: backend/data.db)
- All tickets submitted by T001; pending tickets unassigned, others assigned to random handler ops members
- Dates spread across last 3 months, mixed statuses
"""
import os
import sys
import sqlite3
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DB_PATH', os.path.join(os.path.dirname(__file__), '..', 'backend', 'data.db'))

from models import get_db, init_db

# 示例处理人小组成员。请替换为贵机构真实的工号/姓名后再运行。
handlers = [
    ('S001', '张三'),
    ('S002', '李四'),
    ('S003', '王五'),
    ('S004', '赵六'),
    ('S005', '钱七'),
    ('S006', '孙八'),
    ('S007', '周九'),
    ('S008', '吴十'),
    ('S009', '郑一'),
    ('S010', '冯二'),
]

CATEGORIES = ['网络不通', '网速慢', 'WiFi信号弱', '设备故障', '其他']

LOCATIONS = [
    '教学楼A 305办公室', '教学楼B 201教室', '教学楼C 102实验室',
    '图书馆 三楼阅览区', '图书馆 二楼电子阅览室',
    '实验楼 401机房', '实验楼 205实验室',
    '行政楼 308办公室', '行政楼 一楼大厅',
    '员工宿舍1栋 512', '员工宿舍2栋 308', '员工宿舍3栋 201',
    '体育馆 器材室', '食堂 二楼', '信息中心 机房A', '信息中心 机房B',
]

DESCRIPTIONS = [
    '网络完全无法连接，已经尝试重启路由器无效',
    '打开网页非常缓慢，ping外网延迟超过2000ms',
    'WiFi信号时断时续，2.4G和5G频段都无法正常使用',
    '电脑开机后显示网络电缆被拔出',
    '校园网认证页面无法打开，提示连接超时',
    '网络不稳定，每隔10分钟左右就会断线一次',
    '下载速度仅为几十KB/s，严重影响课件下载',
    '局域网内无法访问共享打印机',
    'IP地址获取失败，显示169.254.x.x',
    'DNS解析失败，能ping通IP但打不开网页',
    '教室多媒体设备无法连接校园网',
    '办公室交换机指示灯异常闪烁',
    '网线接口松动，频繁断连',
    '新装系统后无法获取校园网IP地址',
    'VPN连接后无法访问校内资源',
]

SOLUTIONS = [
    '重新配置IP地址和DNS服务器',
    '更换故障网线并重新绑定端口',
    '重启交换机后网络恢复正常',
    '重新安装网卡驱动程序',
    '调整路由器信道，避免信号干扰',
    '修复认证服务器配置参数',
    '更换千兆端口模块',
    '清理DNS缓存并刷新路由表',
    '重新插拔网线并固定接口',
    '重置网络适配器设置',
]


def ensure_users(db):
    """Ensure T001 submitter and all handlers exist."""
    existing = {r['user_id']: r for r in db.execute("SELECT * FROM users").fetchall()}

    if 'T001' not in existing:
        db.execute(
            "INSERT INTO users (user_id, name, role, phone, department) VALUES (?, ?, ?, ?, ?)",
            ('T001', '张老师', 'submitter', '13800001111', '计算机系')
        )
        print('  Created submitter: T001 张老师')

    for uid, name in handlers:
        if uid not in existing:
            db.execute(
                "INSERT INTO users (user_id, name, role, phone, department) VALUES (?, ?, ?, ?, ?)",
                (uid, name, 'handler', '', '网络运维组')
            )
    db.commit()

    # Print counts
    counts = db.execute(
        "SELECT role, COUNT(*) as cnt FROM users GROUP BY role"
    ).fetchall()
    for row in counts:
        print(f'  Users - {row["role"]}: {row["cnt"]}')


def ensure_categories(db):
    """Ensure all categories exist."""
    existing = {r['name'] for r in db.execute("SELECT name FROM categories").fetchall()}
    for cat in CATEGORIES:
        if cat not in existing:
            db.execute("INSERT INTO categories (name) VALUES (?)", (cat,))
    db.commit()


def generate_tickets(db, count=800):
    """Generate count tickets."""
    ensure_users(db)
    ensure_categories(db)

    now = datetime.now()
    start_date = now - timedelta(days=90)

    # Delete existing tickets for clean data
    existing = db.execute("SELECT COUNT(*) as cnt FROM tickets").fetchone()['cnt']
    if existing > 0:
        db.execute("DELETE FROM tickets")
        db.commit()
        print(f'  Deleted {existing} existing tickets.')

    tickets = []
    for i in range(count):
        # Random date in last 90 days
        days_ago = random.randint(0, 90)
        hours = random.randint(8, 20)
        minutes = random.randint(0, 59)
        created = now - timedelta(days=days_ago, hours=(24-hours), minutes=minutes)
        created_str = created.strftime('%Y-%m-%d %H:%M:%S')

        category = random.choice(CATEGORIES)
        location = random.choice(LOCATIONS)
        description = random.choice(DESCRIPTIONS)

        # Status distribution: 30% pending, 30% processing, 40% resolved
        r = random.random()
        if r < 0.3:
            status = 'pending'
            assignee_id = None
            assignee_name = None
            solution = ''
            completed_at = None
        elif r < 0.6:
            status = 'processing'
            assignee_id, assignee_name = random.choice(handlers)
            solution = ''
            completed_at = None
        else:
            status = 'resolved'
            assignee_id, assignee_name = random.choice(handlers)
            solution = random.choice(SOLUTIONS)
            resolve_hours = random.randint(1, 48)
            completed = created + timedelta(hours=resolve_hours)
            completed_at = completed.strftime('%Y-%m-%d %H:%M:%S')

        tickets.append((
            'T001', '张老师', '13800001111', location, category, description,
            assignee_id, assignee_name, status, solution,
            created_str, created_str, completed_at
        ))

    db.executemany('''
        INSERT INTO tickets
        (reporter_id, reporter_name, contact, location, category, description,
         assignee_id, assignee_name, status, solution, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', tickets)
    db.commit()

    # Stats
    total = db.execute("SELECT COUNT(*) as cnt FROM tickets").fetchone()['cnt']
    status_counts = db.execute(
        "SELECT status, COUNT(*) as cnt FROM tickets GROUP BY status"
    ).fetchall()

    print(f'\n  Generated {count} tickets (total now: {total})')
    for row in status_counts:
        print(f'    {row["status"]}: {row["cnt"]}')
    print(f'  Date range: {start_date.strftime("%Y-%m-%d")} ~ {now.strftime("%Y-%m-%d")}')

    # Generate collaborators for resolved tickets
    ticket_rows = db.execute("SELECT id, assignee_id FROM tickets WHERE status = 'resolved'").fetchall()
    collab_data = []
    for t in ticket_rows:
        available = [(uid, uname) for uid, uname in handlers if uid != t['assignee_id']]
        if not available:
            continue
        num_collabs = random.randint(0, min(2, len(available)))
        if num_collabs == 0:
            continue
        chosen = random.sample(available, num_collabs)
        for uid, uname in chosen:
            collab_data.append((t['id'], uid, uname))

    if collab_data:
        db.executemany(
            'INSERT INTO ticket_collaborators (ticket_id, user_id, user_name) VALUES (?, ?, ?)',
            collab_data
        )
        db.commit()
        print(f'  Generated {len(collab_data)} collaborator records.')


if __name__ == '__main__':
    db = get_db()
    try:
        generate_tickets(db, count=800)
    finally:
        db.close()
    print('\nDone. Start the backend and test the stats page.')
