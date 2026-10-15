> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# 企业网络故障报修系统 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个内网部署的企业网络故障报修接单系统，提交人报修、处理人接单处理、管理员导出记录。

**Architecture:** Flask REST API (后端) + Vue 3 SPA (前端) + SQLite 数据库。前端通过 axios 异步调用所有接口，无密码登录（仅校验工号/工号），JWT token 认证。

**Tech Stack:** Python 3.8+ / Flask / PyJWT / sqlite3 | Vue 3 (CDN-free, Vite build) / Vue Router / axios

**Design System:** 遵循 Apple 设计语言 —— 单一蓝色主调(#0066cc)，卡片式布局，大留白，SF-style 字体栈，pill 按钮，subtle 阴影，无渐变。

---
## File Structure

```
network-repair-system/
├── backend/
│   ├── app.py              # Flask 入口, CORS, 注册蓝图
│   ├── models.py           # SQLite 初始化, get_db
│   ├── auth.py             # 登录接口 + JWT 工具 + 装饰器
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── tickets.py      # 工单 CRUD + CSV 导出
│   │   └── users.py        # 批量导入用户
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── router/index.js
│       ├── api/index.js        # axios 实例 + 拦截器
│       ├── stores/auth.js      # 登录状态 composable
│       ├── assets/style.css    # Apple 设计令牌
│       ├── views/
│       │   ├── LoginPage.vue
│       │   ├── TeacherPage.vue
│       │   ├── StudentPage.vue
│       │   └── AdminPage.vue
│       └── components/
│           ├── AppHeader.vue
│           ├── TicketCard.vue
│           └── TicketForm.vue
```

---

### Task 1: Backend Project Scaffolding

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app.py`

- [ ] **Step 1: Create requirements.txt**

```
flask==3.1.1
flask-cors==5.0.1
pyjwt==2.10.1
```

- [ ] **Step 2: Create app.py with Flask factory and CORS**

```python
from flask import Flask
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    import os
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from routes.tickets import tickets_bp
    from routes.users import users_bp
    app.register_blueprint(tickets_bp, url_prefix='/api')
    app.register_blueprint(users_bp, url_prefix='/api')

    # register auth routes directly on app
    import auth
    auth.init_app(app)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
```

- [ ] **Step 3: Create routes/__init__.py**

```python
```

- [ ] **Step 4: Verify backend starts**

Run: `cd backend && python app.py`
Expected: Flask running on port 5000, no import errors.

- [ ] **Step 5: Commit (if git initialized)**

---

### Task 2: Database Models

**Files:**
- Create: `backend/models.py`

- [ ] **Step 1: Create models.py**

```python
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('teacher','student','admin')),
            phone TEXT DEFAULT '',
            department TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_id TEXT NOT NULL,
            reporter_name TEXT NOT NULL,
            contact TEXT NOT NULL,
            location TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('network_down','slow_speed','device_fault','other')),
            description TEXT NOT NULL DEFAULT '',
            assignee_id TEXT,
            assignee_name TEXT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','resolved')),
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            completed_at TEXT
        );
    ''')

    # seed default admin if not exists
    existing = conn.execute("SELECT id FROM users WHERE user_id = 'admin'").fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO users (user_id, name, role) VALUES (?, ?, ?)",
            ('admin', '系统管理员', 'admin')
        )
    conn.commit()
    conn.close()

def dict_from_row(row):
    if row is None:
        return None
    return dict(row)

def dicts_from_rows(rows):
    return [dict(r) for r in rows]
```

- [ ] **Step 2: Update app.py to call init_db on startup**

Add after `app = Flask(__name__)`:
```python
from models import init_db
with app.app_context():
    init_db()
```

- [ ] **Step 3: Verify database creation**

Run: `cd backend && python -c "from models import init_db; init_db(); import os; print('DB created:', os.path.exists('data.db'))"`
Expected: `DB created: True`

- [ ] **Step 4: Commit**

---

### Task 3: Authentication Backend

**Files:**
- Create: `backend/auth.py`

- [ ] **Step 1: Create auth.py with JWT utilities**

```python
import jwt
import datetime
from functools import wraps
from flask import request, jsonify, g
from models import get_db, dict_from_row

SECRET = os.environ.get('SECRET_KEY', 'dev-secret-change-me')

def generate_token(user_id, name, role):
    payload = {
        'user_id': user_id,
        'name': name,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET, algorithm='HS256')

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': '未登录'}), 401
        try:
            token = auth_header.split(' ')[1]
            payload = jwt.decode(token, SECRET, algorithms=['HS256'])
            g.current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({'error': '登录已过期'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': '无效的登录凭证'}), 401
        return f(*args, **kwargs)
    return decorated

def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if g.current_user.get('role') not in roles:
                return jsonify({'error': '无权限'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def init_app(app):
    @app.route('/api/auth/login', methods=['POST'])
    def login():
        data = request.get_json()
        if not data:
            return jsonify({'error': '请提供登录信息'}), 400
        user_id = data.get('user_id', '').strip()
        role = data.get('role', '').strip()
        if not user_id or not role:
            return jsonify({'error': '工号/工号和身份不能为空'}), 400
        if role not in ('teacher', 'student', 'admin'):
            return jsonify({'error': '无效的身份类型'}), 400

        db = get_db()
        user = db.execute(
            "SELECT * FROM users WHERE user_id = ? AND role = ?",
            (user_id, role)
        ).fetchone()
        db.close()

        if not user:
            return jsonify({'error': '工号/工号不存在或身份不匹配'}), 401

        user = dict_from_row(user)
        token = generate_token(user['user_id'], user['name'], user['role'])
        return jsonify({
            'token': token,
            'user': {
                'user_id': user['user_id'],
                'name': user['name'],
                'role': user['role']
            }
        })
```

- [ ] **Step 2: Verify login endpoint**

Run: `cd backend && python app.py` (in background), then:
```
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"user_id\":\"admin\",\"role\":\"admin\"}"
```
Expected: returns token and user object.

- [ ] **Step 3: Commi**t

---

### Task 4: Ticket API Backend

**Files:**
- Create: `backend/routes/tickets.py`

- [ ] **Step 1: Create routes/tickets.py**

```python
import csv
import io
from datetime import datetime
from flask import Blueprint, request, jsonify, g, Response
from auth import login_required, require_role
from models import get_db, dict_from_row, dicts_from_rows

tickets_bp = Blueprint('tickets', __name__)

CATEGORY_MAP = {
    'network_down': '网络不通',
    'slow_speed': '网速慢',
    'device_fault': '设备故障',
    'other': '其他'
}


@tickets_bp.route('/tickets', methods=['POST'])
@login_required
@require_role('teacher')
def create_ticket():
    data = request.get_json()
    if not data:
        return jsonify({'error': '请填写报修信息'}), 400

    contact = data.get('contact', '').strip()
    location = data.get('location', '').strip()
    category = data.get('category', '').strip()
    description = data.get('description', '').strip()

    if not contact or not location or not category:
        return jsonify({'error': '联系方式、位置和故障类型为必填项'}), 400
    if category not in CATEGORY_MAP:
        return jsonify({'error': '无效的故障类型'}), 400

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
    return jsonify(dict_from_row(ticket)), 201


@tickets_bp.route('/tickets', methods=['GET'])
@login_required
def list_tickets():
    user = g.current_user
    db = get_db()

    if user['role'] == 'teacher':
        rows = db.execute(
            "SELECT * FROM tickets WHERE reporter_id = ? ORDER BY created_at DESC",
            (user['user_id'],)
        ).fetchall()
    elif user['role'] == 'student':
        pending = db.execute(
            "SELECT * FROM tickets WHERE status = 'pending' ORDER BY created_at DESC"
        ).fetchall()
        claimed = db.execute(
            "SELECT * FROM tickets WHERE assignee_id = ? ORDER BY updated_at DESC",
            (user['user_id'],)
        ).fetchall()
        rows = pending + claimed
    else:
        # admin: all tickets with optional filters
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

    db.close()
    return jsonify(dicts_from_rows(rows))


@tickets_bp.route('/tickets/<int:ticket_id>/claim', methods=['PUT'])
@login_required
@require_role('student')
def claim_ticket(ticket_id):
    db = get_db()
    ticket = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    if not ticket:
        db.close()
        return jsonify({'error': '工单不存在'}), 404
    if ticket['status'] != 'pending':
        db.close()
        return jsonify({'error': '该工单已被接单或已完成'}), 400

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db.execute(
        "UPDATE tickets SET assignee_id = ?, assignee_name = ?, status = 'processing', updated_at = ? WHERE id = ?",
        (g.current_user['user_id'], g.current_user['name'], now, ticket_id)
    )
    db.commit()
    updated = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    db.close()
    return jsonify(dict_from_row(updated))


@tickets_bp.route('/tickets/<int:ticket_id>/complete', methods=['PUT'])
@login_required
@require_role('student')
def complete_ticket(ticket_id):
    db = get_db()
    ticket = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    if not ticket:
        db.close()
        return jsonify({'error': '工单不存在'}), 404
    if ticket['assignee_id'] != g.current_user['user_id']:
        db.close()
        return jsonify({'error': '只能完成自己接单的工单'}), 403
    if ticket['status'] != 'processing':
        db.close()
        return jsonify({'error': '该工单未在处理中'}), 400

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db.execute(
        "UPDATE tickets SET status = 'resolved', completed_at = ?, updated_at = ? WHERE id = ?",
        (now, now, ticket_id)
    )
    db.commit()
    updated = db.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    db.close()
    return jsonify(dict_from_row(updated))


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
    db.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['工单号', '报修人', '联系方式', '位置', '故障类型', '描述', '接单人', '提交时间', '完成时间', '状态'])
    status_map = {'pending': '待接单', 'processing': '处理中', 'resolved': '已解决'}
    for r in rows:
        writer.writerow([
            r['id'],
            r['reporter_name'],
            r['contact'],
            r['location'],
            CATEGORY_MAP.get(r['category'], r['category']),
            r['description'],
            r['assignee_name'] or '-',
            r['created_at'],
            r['completed_at'] or '-',
            status_map.get(r['status'], r['status'])
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=tickets_{datetime.now().strftime("%Y%m%d")}.csv'}
    )
```

- [ ] **Step 2: Test ticket creation**

Run backend, then:
```
curl -X POST http://localhost:5000/api/tickets -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d "{\"contact\":\"13800138000\",\"location\":\"会议室302\",\"category\":\"network_down\",\"description\":\"完全无法上网\"}"
```
Expected: 201 with ticket JSON.

- [ ] **Step 3: Test ticket listing, claiming, completing**

Test each endpoint with appropriate tokens.

- [ ] **Step 4: Test CSV export**

```
curl http://localhost:5000/api/tickets/export -H "Authorization: Bearer <admin_token>"
```
Expected: CSV download.

- [ ] **Step 5: Commit**

---

### Task 5: User Import API

**Files:**
- Create: `backend/routes/users.py`

- [ ] **Step 1: Create routes/users.py**

```python
from flask import Blueprint, request, jsonify, g
from auth import login_required, require_role
from models import get_db

users_bp = Blueprint('users', __name__)


@users_bp.route('/users/import', methods=['POST'])
@login_required
@require_role('admin')
def import_users():
    data = request.get_json()
    if not data or 'users' not in data:
        return jsonify({'error': '请提供用户数据'}), 400

    users = data['users']
    if not isinstance(users, list) or len(users) == 0:
        return jsonify({'error': '用户数据不能为空'}), 400

    db = get_db()
    # clear all users except admin
    db.execute("DELETE FROM users WHERE user_id != 'admin'")

    success_count = 0
    errors = []
    for u in users:
        user_id = u.get('user_id', '').strip()
        name = u.get('name', '').strip()
        role = u.get('role', '').strip()
        if not user_id or not name or role not in ('teacher', 'student', 'admin'):
            errors.append(f'{user_id or "?"}: 信息不完整')
            continue
        try:
            db.execute(
                "INSERT OR REPLACE INTO users (user_id, name, role, phone, department) VALUES (?, ?, ?, ?, ?)",
                (user_id, name, role, u.get('phone', ''), u.get('department', ''))
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
```

- [ ] **Step 2: Test user import**

```
curl -X POST http://localhost:5000/api/users/import -H "Content-Type: application/json" -H "Authorization: Bearer <admin_token>" -d "{\"users\":[{\"user_id\":\"T001\",\"name\":\"张同事\",\"role\":\"teacher\"},{\"user_id\":\"S001\",\"name\":\"李同事\",\"role\":\"student\"}]}"
```
Expected: `{"imported": 2, "errors": []}`

- [ ] **Step 3: Commit**

---

### Task 6: Frontend Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.js`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/router/index.js`
- Create: `frontend/src/api/index.js`
- Create: `frontend/src/stores/auth.js`
- Create: `frontend/src/assets/style.css`
- Create: `frontend/src/components/AppHeader.vue`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "network-repair-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.9.0",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "vite": "^6.3.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`

- [ ] **Step 3: Create vite.config.js**

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>企业内网络故障报修</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23e1f5fe'/%3E%3Ctext x='50' y='68' font-size='60' font-weight='bold' font-family='system-ui, sans-serif' text-anchor='middle' fill='%231a73e8'%3E修%3C/text%3E%3C/svg%3E">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create src/main.js**

```javascript
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/style.css'

createApp(App).use(router).mount('#app')
```

- [ ] **Step 6: Create src/App.vue**

```vue
<template>
  <div class="app-shell">
    <AppHeader v-if="auth.user" />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useAuth } from './stores/auth'
import AppHeader from './components/AppHeader.vue'
const auth = useAuth()
</script>
```

- [ ] **Step 7: Create src/router/index.js**

```javascript
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'Login', component: () => import('../views/LoginPage.vue') },
  { path: '/teacher', name: 'Teacher', component: () => import('../views/TeacherPage.vue') },
  { path: '/student', name: 'Student', component: () => import('../views/StudentPage.vue') },
  { path: '/admin', name: 'Admin', component: () => import('../views/AdminPage.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = sessionStorage.getItem('token')
  const publicPages = ['/login']
  if (!token && !publicPages.includes(to.path)) {
    return next('/login')
  }
  if (token && to.path === '/login') {
    const role = sessionStorage.getItem('role')
    const roleRoutes = { teacher: '/teacher', student: '/student', admin: '/admin' }
    return next(roleRoutes[role] || '/login')
  }
  next()
})

export default router
```

- [ ] **Step 8: Create src/api/index.js**

```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      sessionStorage.clear()
      window.location.hash = '#/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

- [ ] **Step 9: Create src/stores/auth.js**

```javascript
import { reactive } from 'vue'

const state = reactive({
  user: JSON.parse(sessionStorage.getItem('user') || 'null'),
  token: sessionStorage.getItem('token') || '',
})

export function useAuth() {
  function login(userData, token) {
    state.user = userData
    state.token = token
    sessionStorage.setItem('token', token)
    sessionStorage.setItem('user', JSON.stringify(userData))
    sessionStorage.setItem('role', userData.role)
  }

  function logout() {
    state.user = null
    state.token = ''
    sessionStorage.clear()
  }

  return { user: state, login, logout }
}
```

- [ ] **Step 10: Create src/assets/style.css** (Apple Design Tokens)

```css
:root {
  --primary: #0066cc;
  --primary-hover: #0077dd;
  --primary-light: #e8f4fd;
  --surface: #ffffff;
  --surface-alt: #f5f5f7;
  --text: #1d1d1f;
  --text-secondary: #86868b;
  --text-muted: #6e6e73;
  --border: #d2d2d7;
  --border-soft: #f0f0f0;
  --success: #34c759;
  --success-light: #e8f8ed;
  --warning: #ff9500;
  --warning-light: #fff4e5;
  --danger: #ff3b30;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-pill: 9999px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 20px rgba(0,0,0,0.08);
  --transition: 0.2s ease;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: var(--surface-alt);
  color: var(--text);
  font-size: 17px;
  line-height: 1.47;
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  min-height: 100vh;
}

.main-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.card {
  background: var(--surface);
  padding: 24px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  margin-bottom: 20px;
  border: 1px solid var(--border-soft);
}

h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
  letter-spacing: -0.28px;
}

h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 24px;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}

.btn:active { transform: scale(0.97); }

.btn-primary {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,102,204,0.3);
}

.btn-primary:hover { background: var(--primary-hover); }

.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
}

.btn-outline:hover { background: var(--primary-light); }

.btn-success {
  background: var(--success);
  color: #fff;
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-ghost:hover { background: var(--surface-alt); }

.btn-sm {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
}

.btn-block { width: 100%; }

input, textarea, select {
  width: 100%;
  height: 44px;
  font-size: 16px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  transition: border-color var(--transition);
}

input:focus, textarea:focus, select:focus {
  border-color: var(--primary);
}

textarea {
  height: 100px;
  padding: 12px 16px;
  resize: vertical;
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%2386868b'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
  padding-right: 40px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.status-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
}

.status-pending { background: #f5f5f7; color: var(--text-secondary); }
.status-processing { background: var(--primary-light); color: var(--primary); }
.status-resolved { background: var(--success-light); color: #248a3d; }

.role-btn {
  flex: 1;
  height: 56px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  font-size: 17px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text);
  transition: all var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.role-btn:hover { border-color: var(--primary); }
.role-btn.active {
  border-color: var(--primary);
  background: var(--primary-light);
  color: var(--primary);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 15px;
}

.divider {
  height: 1px;
  background: var(--border-soft);
  margin: 20px 0;
}

@media (max-width: 600px) {
  .main-content { padding: 12px; }
  .card { padding: 16px; border-radius: var(--radius-md); }
  h2 { font-size: 20px; }
}
```

- [ ] **Step 11: Create src/components/AppHeader.vue**

```vue
<template>
  <header class="app-header">
    <div class="header-inner">
      <span class="header-logo">企业内网络报修</span>
      <div class="header-right">
        <span class="header-user" v-if="user.user">{{ user.user.name }} ({{ roleLabel }})</span>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">退出</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useAuth } from '../stores/auth'
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const auth = useAuth()
const router = useRouter()
const user = auth.user

const roleLabel = computed(() => {
  const map = { teacher: '提交人', student: '处理人', admin: '管理员' }
  return map[user.value?.role] || ''
})

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.app-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border-soft);
  padding: 0 20px;
  height: 52px;
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: saturate(180%) blur(20px);
  background: rgba(255,255,255,0.8);
}
.header-inner {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-logo {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-user {
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
```

- [ ] **Step 12: Verify frontend dev starts**

Run: `cd frontend && npm run dev`
Expected: Vite dev server on port 3000, no errors.

- [ ] **Step 13: Commit**

---

### Task 7: Login Page

**Files:**
- Create: `frontend/src/views/LoginPage.vue`

- [ ] **Step 1: Create LoginPage.vue**

```vue
<template>
  <div class="login-page">
    <div class="login-card card">
      <h2>企业内网络故障报修系统</h2>
      <p class="login-desc">请选择您的身份并输入工号/工号登录</p>

      <div class="role-select">
        <button
          v-for="r in roles"
          :key="r.value"
          class="role-btn"
          :class="{ active: selectedRole === r.value }"
          @click="selectedRole = r.value"
        >
          <span class="role-icon">{{ r.icon }}</span>
          {{ r.label }}
        </button>
      </div>

      <div class="form-group" style="margin-top: 20px;">
        <label>{{ selectedRole === 'student' ? '工号' : '工号' }}</label>
        <input
          v-model="userId"
          :placeholder="selectedRole === 'student' ? '请输入工号' : '请输入工号'"
          @keyup.enter="handleLogin"
        />
      </div>

      <p class="login-error" v-if="error">{{ error }}</p>

      <button class="btn btn-primary btn-block" @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import api from '../api'

const router = useRouter()
const auth = useAuth()

const roles = [
  { value: 'teacher', label: '提交人', icon: '👨‍🏫' },
  { value: 'student', label: '处理人', icon: '🔧' },
  { value: 'admin', label: '管理员', icon: '⚙️' },
]

const selectedRole = ref('teacher')
const userId = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  if (!userId.value.trim()) {
    error.value = '请输入工号/工号'
    return
  }
  loading.value = true
  try {
    const res = await api.post('/auth/login', {
      user_id: userId.value.trim(),
      role: selectedRole.value
    })
    auth.login(res.data.user, res.data.token)
    const roleRoutes = { teacher: '/teacher', student: '/student', admin: '/admin' }
    router.push(roleRoutes[res.data.user.role] || '/login')
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-alt);
}
.login-card {
  width: 100%;
  max-width: 400px;
}
.login-desc {
  text-align: center;
  color: var(--text-secondary);
  font-size: 15px;
  margin-bottom: 24px;
}
.role-select {
  display: flex;
  gap: 10px;
}
.role-icon {
  font-size: 20px;
}
.login-error {
  color: var(--danger);
  font-size: 14px;
  text-align: center;
  margin-bottom: 12px;
}
</style>
```

- [ ] **Step 2: Verify login flow**

Run: `cd frontend && npm run dev`, then start backend. Login as admin/teacher/student.
Expected: redirects to correct page, header shows user info.

- [ ] **Step 3: Commit**

---

### Task 8: Teacher Page

**Files:**
- Create: `frontend/src/views/TeacherPage.vue`
- Create: `frontend/src/components/TicketForm.vue`
- Create: `frontend/src/components/TicketCard.vue`

- [ ] **Step 1: Create TicketForm.vue**

```vue
<template>
  <div class="card">
    <h3>提交报修</h3>
    <div class="form-group">
      <label>联系方式 *</label>
      <input v-model="form.contact" placeholder="手机号或座机号" />
    </div>
    <div class="form-group">
      <label>楼栋房间号 *</label>
      <input v-model="form.location" placeholder="例如：会议室302" />
    </div>
    <div class="form-group">
      <label>故障类型 *</label>
      <select v-model="form.category">
        <option value="">请选择故障类型</option>
        <option value="network_down">网络不通</option>
        <option value="slow_speed">网速慢</option>
        <option value="device_fault">设备故障</option>
        <option value="other">其他</option>
      </select>
    </div>
    <div class="form-group">
      <label>故障描述</label>
      <textarea v-model="form.description" placeholder="请描述故障现象..."></textarea>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <button class="btn btn-primary btn-block" @click="submit" :disabled="submitting">
      {{ submitting ? '提交中...' : '提交报修' }}
    </button>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import api from '../api'

const emit = defineEmits(['submitted'])

const form = reactive({
  contact: '',
  location: '',
  category: '',
  description: ''
})

const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  if (!form.contact.trim() || !form.location.trim() || !form.category) {
    error.value = '请填写联系方式、位置和故障类型'
    return
  }
  submitting.value = true
  try {
    await api.post('/tickets', { ...form })
    form.contact = ''
    form.location = ''
    form.category = ''
    form.description = ''
    emit('submitted')
  } catch (e) {
    error.value = e.response?.data?.error || '提交失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-error {
  color: var(--danger);
  font-size: 14px;
  margin-bottom: 12px;
}
</style>
```

- [ ] **Step 2: Create TicketCard.vue**

```vue
<template>
  <div class="ticket-item">
    <div class="ticket-left">
      <div class="ticket-id">#{{ ticket.id }}</div>
      <div class="ticket-meta">
        <span class="ticket-category">{{ categoryLabel }}</span>
        <span class="ticket-location">{{ ticket.location }}</span>
      </div>
      <div class="ticket-desc" v-if="ticket.description">{{ ticket.description }}</div>
      <div class="ticket-time">{{ ticket.created_at }}</div>
      <div class="ticket-assignee" v-if="ticket.assignee_name">
        接单人：{{ ticket.assignee_name }}
      </div>
    </div>
    <div class="ticket-right">
      <span class="status-tag" :class="'status-' + ticket.status">{{ statusLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  ticket: { type: Object, required: true }
})

const categoryMap = {
  network_down: '网络不通',
  slow_speed: '网速慢',
  device_fault: '设备故障',
  other: '其他'
}

const statusMap = {
  pending: '待接单',
  processing: '处理中',
  resolved: '已解决'
}

const categoryLabel = computed(() => categoryMap[props.ticket.category] || props.ticket.category)
const statusLabel = computed(() => statusMap[props.ticket.status] || props.ticket.status)
</script>

<style scoped>
.ticket-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  margin: 10px 0;
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--border-soft);
  transition: all var(--transition);
}
.ticket-item:hover {
  box-shadow: var(--shadow-sm);
}
.ticket-left {
  flex: 1;
  min-width: 0;
}
.ticket-id {
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  margin-bottom: 4px;
}
.ticket-meta {
  display: flex;
  gap: 10px;
  margin-bottom: 4px;
}
.ticket-category {
  font-size: 13px;
  color: var(--primary);
  background: var(--primary-light);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}
.ticket-location {
  font-size: 13px;
  color: var(--text-secondary);
}
.ticket-desc {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 4px;
  word-break: break-all;
}
.ticket-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}
.ticket-assignee {
  font-size: 13px;
  color: var(--primary);
  margin-top: 4px;
  font-weight: 500;
}
.ticket-right {
  flex-shrink: 0;
  margin-left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
```

- [ ] **Step 3: Create TeacherPage.vue**

```vue
<template>
  <div class="teacher-page">
    <TicketForm @submitted="fetchTickets" />
    <div class="card">
      <h3>我的报修记录</h3>
      <div v-if="tickets.length === 0" class="empty-state">暂无报修记录</div>
      <TicketCard v-for="t in tickets" :key="t.id" :ticket="t" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import TicketForm from '../components/TicketForm.vue'
import TicketCard from '../components/TicketCard.vue'

const tickets = ref([])

async function fetchTickets() {
  try {
    const res = await api.get('/tickets')
    tickets.value = res.data
  } catch (e) {
    console.error(e)
  }
}

onMounted(fetchTickets)
</script>
```

- [ ] **Step 4: Verify teacher flow**

Login as teacher (need to have a teacher user imported). Submit a ticket, verify it appears in the list.

- [ ] **Step 5: Commit**

---

### Task 9: Student Page

**Files:**
- Create: `frontend/src/views/StudentPage.vue`

- [ ] **Step 1: Create StudentPage.vue**

```vue
<template>
  <div class="student-page">
    <div class="card">
      <h3>待接单故障</h3>
      <div v-if="pending.length === 0" class="empty-state">当前没有待处理的报修</div>
      <div v-for="t in pending" :key="t.id" class="ticket-item action-item">
        <div class="ticket-left">
          <div class="ticket-id">#{{ t.id }}</div>
          <div class="ticket-meta">
            <span class="ticket-category">{{ catMap[t.category] }}</span>
            <span class="ticket-location">{{ t.location }}</span>
          </div>
          <div class="ticket-desc" v-if="t.description">{{ t.description }}</div>
          <div class="ticket-meta2">
            <span>报修人：{{ t.reporter_name }}</span>
            <span>联系方式：{{ t.contact }}</span>
          </div>
          <div class="ticket-time">{{ t.created_at }}</div>
        </div>
        <button class="btn btn-primary btn-sm" @click="claimTicket(t.id)">接单</button>
      </div>
    </div>

    <div class="card">
      <h3>我的工单</h3>
      <div v-if="claimed.length === 0" class="empty-state">暂无接单记录</div>
      <div v-for="t in claimed" :key="t.id" class="ticket-item" :class="{ 'processing-item': t.status === 'processing' }">
        <div class="ticket-left">
          <div class="ticket-id">#{{ t.id }}</div>
          <div class="ticket-meta">
            <span class="ticket-category">{{ catMap[t.category] }}</span>
            <span class="ticket-location">{{ t.location }}</span>
          </div>
          <div class="ticket-desc" v-if="t.description">{{ t.description }}</div>
          <div class="ticket-meta2">
            <span>报修人：{{ t.reporter_name }}</span>
            <span>联系方式：{{ t.contact }}</span>
          </div>
          <div class="ticket-time">{{ t.created_at }}</div>
        </div>
        <div class="ticket-right">
          <span class="status-tag" :class="'status-' + t.status">{{ statusMap[t.status] }}</span>
          <button
            v-if="t.status === 'processing'"
            class="btn btn-success btn-sm"
            @click="completeTicket(t.id)"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const pending = ref([])
const claimed = ref([])

const catMap = {
  network_down: '网络不通', slow_speed: '网速慢',
  device_fault: '设备故障', other: '其他'
}

const statusMap = { pending: '待接单', processing: '处理中', resolved: '已解决' }

async function fetchTickets() {
  try {
    const res = await api.get('/tickets')
    const all = res.data
    pending.value = all.filter(t => t.status === 'pending')
    claimed.value = all.filter(t => t.assignee_id)
  } catch (e) {
    console.error(e)
  }
}

async function claimTicket(id) {
  try {
    await api.put(`/tickets/${id}/claim`)
    fetchTickets()
  } catch (e) {
    alert(e.response?.data?.error || '接单失败')
  }
}

async function completeTicket(id) {
  try {
    await api.put(`/tickets/${id}/complete`)
    fetchTickets()
  } catch (e) {
    alert(e.response?.data?.error || '操作失败')
  }
}

onMounted(fetchTickets)
</script>

<style scoped>
.action-item { border-left: 4px solid var(--primary); }
.processing-item { border-left: 4px solid var(--warning); }
.ticket-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  margin: 10px 0;
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--border-soft);
  gap: 12px;
}
.ticket-left {
  flex: 1;
  min-width: 0;
}
.ticket-id { font-weight: 600; font-size: 15px; color: var(--text); margin-bottom: 4px; }
.ticket-meta { display: flex; gap: 10px; margin-bottom: 4px; }
.ticket-category {
  font-size: 13px; color: var(--primary); background: var(--primary-light);
  padding: 2px 8px; border-radius: var(--radius-pill);
}
.ticket-location { font-size: 13px; color: var(--text-secondary); }
.ticket-desc { font-size: 14px; color: var(--text-muted); margin-top: 4px; word-break: break-all; }
.ticket-meta2 {
  font-size: 13px; color: var(--text-secondary); margin-top: 4px;
  display: flex; gap: 16px;
}
.ticket-time { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.ticket-right {
  flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
}
</style>
```

- [ ] **Step 2: Verify student flow**

Import a student user, login, verify pending tickets show, claim one, then complete it.
Each action should update the lists.

- [ ] **Step 3: Commit**

---

### Task 10: Admin Page

**Files:**
- Create: `frontend/src/views/AdminPage.vue`

- [ ] **Step 1: Create AdminPage.vue**

```vue
<template>
  <div class="admin-page">
    <div class="card">
      <h3>筛选条件</h3>
      <div class="filter-row">
        <div class="form-group">
          <label>开始日期</label>
          <input type="date" v-model="filters.start" />
        </div>
        <div class="form-group">
          <label>结束日期</label>
          <input type="date" v-model="filters.end" />
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="filters.status">
            <option value="">全部</option>
            <option value="pending">待接单</option>
            <option value="processing">处理中</option>
            <option value="resolved">已解决</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" @click="fetchTickets" style="align-self: flex-end;">筛选</button>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <h3>全部工单 ({{ tickets.length }})</h3>
        <div class="toolbar-actions">
          <button class="btn btn-outline btn-sm" @click="exportCSV">导出CSV</button>
          <button class="btn btn-ghost btn-sm" @click="showImport = !showImport">导入人员</button>
        </div>
      </div>

      <div v-if="showImport" class="import-section">
        <p class="import-hint">粘贴 JSON 格式的人员数据：[{"user_id":"T001","name":"张同事","role":"teacher"}]</p>
        <textarea v-model="importData" placeholder="[{'user_id': 'T001', 'name': '张同事', 'role': 'teacher'}]" rows="5"></textarea>
        <div class="import-actions">
          <button class="btn btn-primary btn-sm" @click="importUsers" :disabled="importing">
            {{ importing ? '导入中...' : '确认导入' }}
          </button>
          <span class="import-result" v-if="importResult">{{ importResult }}</span>
        </div>
      </div>

      <div v-if="tickets.length === 0" class="empty-state">暂无工单数据</div>

      <div class="ticket-table" v-else>
        <div class="table-header">
          <span class="col-id">工单号</span>
          <span class="col-reporter">报修人</span>
          <span class="col-location">位置</span>
          <span class="col-category">类型</span>
          <span class="col-assignee">接单人</span>
          <span class="col-status">状态</span>
          <span class="col-time">提交时间</span>
        </div>
        <div v-for="t in tickets" :key="t.id" class="table-row">
          <span class="col-id">#{{ t.id }}</span>
          <span class="col-reporter">{{ t.reporter_name }}</span>
          <span class="col-location">{{ t.location }}</span>
          <span class="col-category">{{ catMap[t.category] }}</span>
          <span class="col-assignee">{{ t.assignee_name || '-' }}</span>
          <span class="col-status">
            <span class="status-tag" :class="'status-' + t.status">{{ statusMap[t.status] }}</span>
          </span>
          <span class="col-time">{{ t.created_at }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const tickets = ref([])
const filters = ref({ start: '', end: '', status: '' })
const showImport = ref(false)
const importData = ref('')
const importing = ref(false)
const importResult = ref('')

const catMap = {
  network_down: '网络不通', slow_speed: '网速慢',
  device_fault: '设备故障', other: '其他'
}
const statusMap = { pending: '待接单', processing: '处理中', resolved: '已解决' }

async function fetchTickets() {
  try {
    const params = {}
    if (filters.value.start) params.start_date = filters.value.start
    if (filters.value.end) params.end_date = filters.value.end
    if (filters.value.status) params.status = filters.value.status
    const res = await api.get('/tickets', { params })
    tickets.value = res.data
  } catch (e) {
    console.error(e)
  }
}

async function exportCSV() {
  try {
    const params = {}
    if (filters.value.start) params.start_date = filters.value.start
    if (filters.value.end) params.end_date = filters.value.end
    const res = await api.get('/tickets/export', { params, responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `工单导出_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败')
  }
}

async function importUsers() {
  importResult.value = ''
  if (!importData.value.trim()) {
    importResult.value = '请输入用户数据'
    return
  }
  importing.value = true
  try {
    const users = JSON.parse(importData.value)
    const res = await api.post('/users/import', { users })
    importResult.value = `成功导入 ${res.data.imported} 人`
    if (res.data.errors.length > 0) {
      importResult.value += `，${res.data.errors.length} 条错误`
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      importResult.value = 'JSON 格式错误'
    } else {
      importResult.value = e.response?.data?.error || '导入失败'
    }
  } finally {
    importing.value = false
  }
}

onMounted(fetchTickets)
</script>

<style scoped>
.filter-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.filter-row .form-group { flex: 1; min-width: 140px; margin-bottom: 0; }
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar h3 { margin-bottom: 0; }
.toolbar-actions { display: flex; gap: 8px; }
.import-section {
  background: var(--surface-alt);
  padding: 16px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}
.import-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.import-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.import-result {
  font-size: 14px;
  color: var(--success);
}
.ticket-table {
  overflow-x: auto;
}
.table-header {
  display: flex;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-soft);
}
.table-row {
  display: flex;
  padding: 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-soft);
  align-items: center;
}
.table-row:hover { background: var(--surface-alt); }
.col-id { width: 70px; flex-shrink: 0; }
.col-reporter { width: 90px; flex-shrink: 0; }
.col-location { flex: 1; min-width: 100px; }
.col-category { width: 90px; flex-shrink: 0; }
.col-assignee { width: 90px; flex-shrink: 0; }
.col-status { width: 80px; flex-shrink: 0; }
.col-time { width: 150px; flex-shrink: 0; font-size: 13px; color: var(--text-secondary); }
@media (max-width: 700px) {
  .table-header, .table-row { font-size: 12px; }
  .col-id { width: 50px; }
  .col-reporter, .col-category, .col-assignee { width: 60px; }
  .col-status { width: 60px; }
  .col-time { width: 120px; font-size: 11px; }
}
</style>
```

- [ ] **Step 2: Verify admin page**

Login as admin, verify tickets show in table, filters work, CSV export works, user import works.

- [ ] **Step 3: Commit**

---

## Verification Checklist

After all tasks complete, verify end-to-end:

1. Login as admin, import teacher and student users
2. Login as teacher, submit 2-3 ticket reports
3. Login as student, see pending tickets, claim one
4. Teacher sees status change to "xxx处理中"
5. Student marks ticket as complete
6. Teacher sees status change to "已解决"
7. Login as admin, filter by date/status, export CSV
8. CSV file opens correctly with proper columns
