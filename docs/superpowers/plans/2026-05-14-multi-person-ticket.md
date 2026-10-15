> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# 工单多人协作功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multi-person collaboration on tickets — one claimer + up to 2 collaborators recorded at completion time, with equal workload counting and updated ranking display.

**Architecture:** New `ticket_collaborators` junction table links tickets to extra participants. Backend extends `complete` endpoint to accept `collaborator_ids`, enriches `GET /tickets` and rankings with collaborator data. Frontend adds multi-select in SolutionModal, displays collaborators on resolved tickets, and updates the ranking table (6 columns: 排名|处理人|认领数|协作数|总参与|平均耗时).

**Tech Stack:** Flask + SQLite backend, React 19 + TypeScript + Vite 7 frontend, react-router v7.

---

### Task 1: Database — Create `ticket_collaborators` Table

**Files:**
- Modify: `backend/models.py:27-60`

- [ ] **Step 1: Add table creation in init_db()**

In `init_db()` of `backend/models.py`, add the `ticket_collaborators` table after the `tickets` table:

```python
        CREATE TABLE IF NOT EXISTS ticket_collaborators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        );
```

The full `conn.executescript` block becomes:

```python
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('teacher','student','admin')),
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
```

- [ ] **Step 2: Verify table creation**

```bash
python -c "from backend.models import init_db; init_db(); import sqlite3,os; db=sqlite3.connect(os.path.join('backend','data.db')); cols=db.execute(\"PRAGMA table_info(ticket_collaborators)\").fetchall(); print([c[1] for c in cols])"
```

Expected: `['id', 'ticket_id', 'user_id', 'user_name']`

- [ ] **Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: add ticket_collaborators table"
```

---

### Task 2: Backend — New `GET /api/students` Endpoint

**Files:**
- Modify: `backend/routes/users.py:1-87`

- [ ] **Step 1: Add the students endpoint**

Add after the `list_users` function (after line 17):

```python
@users_bp.route('/students', methods=['GET'])
@login_required
def list_students():
    db = get_db()
    rows = db.execute(
        "SELECT user_id, name FROM users WHERE role = 'student' ORDER BY user_id"
    ).fetchall()
    db.close()
    return jsonify(dicts_from_rows(rows))
```

- [ ] **Step 2: Add collaborator cleanup in delete_user**

In `delete_user()`, add `DELETE FROM ticket_collaborators` before the user delete. After line 40 (the ticket reassignment block), before `db.execute("DELETE FROM users ...")`:

```python
    db.execute("DELETE FROM ticket_collaborators WHERE user_id = ?", (deleted_uid,))
```

- [ ] **Step 3: Verify the endpoint**

Start the backend and run:
```bash
curl -H "Authorization: Bearer <token>" http://127.0.0.1:5000/api/students
```

Expected: `[{"user_id":"S001","user_name":"运维小组"},...]`

- [ ] **Step 4: Commit**

```bash
git add backend/routes/users.py
git commit -m "feat: add GET /api/students and collaborator cleanup on user delete"
```

---

### Task 3: Backend — Extend `complete` Endpoint + Collaborator Attach

**Files:**
- Modify: `backend/routes/tickets.py:129-155`

- [ ] **Step 1: Rewrite complete_ticket to accept collaborator_ids**

Replace the `complete_ticket` function (lines 129-155) with:

```python
@tickets_bp.route('/tickets/<int:ticket_id>/complete', methods=['PUT'])
@login_required
@require_role('student')
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
            "SELECT user_id, name FROM users WHERE user_id = ? AND role = 'student'",
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
```

- [ ] **Step 2: Verify complete endpoint**

```bash
# First claim a pending ticket as S001, then complete with collaborators:
curl -X PUT http://127.0.0.1:5000/api/tickets/1/complete \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"solution":"已修复","collaborator_ids":["S002","S003"]}'
```

Expected: `{"id":1,...,"collaborators":[{"user_id":"S002","user_name":"..."},{"user_id":"S003","user_name":"..."}]}`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/tickets.py
git commit -m "feat: extend complete_ticket to accept collaborator_ids"
```

---

### Task 4: Backend — Enrich `GET /tickets` with Collaborators + Student Collab Query

**Files:**
- Modify: `backend/routes/tickets.py:64-101`

- [ ] **Step 1: Add batch collaborator attachment helper**

After the `list_tickets` line 64, replace the function body. Add this helper function above `list_tickets`:

```python
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
```

Then replace the `list_tickets` function body with:

```python
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
```

- [ ] **Step 2: Verify student sees collaborator tickets**

As S002 (who is a collaborator on ticket #1), verify the ticket appears:
```bash
curl -H "Authorization: Bearer <S002_token>" http://127.0.0.1:5000/api/tickets | python -m json.tool
```

Expected: ticket #1 appears in the list with `"collaborators":[...]`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/tickets.py
git commit -m "feat: attach collaborators to GET /tickets and add student collab query"
```

---

### Task 5: Backend — Update CSV Export with Collaborators

**Files:**
- Modify: `backend/routes/tickets.py:158-202`
- Modify: `backend/i18n.py` (check csv_header)

- [ ] **Step 1: Read i18n csv_header**

Read `backend/i18n.py` to get current `csv_header` definition.

- [ ] **Step 2: Update csv_header in i18n.py**

Add "协作者" after "接单人" in the csv_header list in `i18n.py`.

- [ ] **Step 3: Update export_csv to include collaborators column**

In `export_csv()`, after reading rows, batch-fetch collaborators:

```python
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
```

- [ ] **Step 4: Commit**

```bash
git add backend/routes/tickets.py backend/i18n.py
git commit -m "feat: add collaborators column to CSV export"
```

---

### Task 6: Backend — Add `collaboration_count` to Rankings

**Files:**
- Modify: `backend/routes/stats.py:11-44`

- [ ] **Step 1: Rewrite rankings query with collaboration_count**

Replace the `rankings` function body with:

```python
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

    collab_filter = ""
    collab_params = []
    if start:
        collab_filter += " AND t.completed_at >= ?"
        collab_params.append(start + ' 00:00:00')
    if end:
        collab_filter += " AND t.completed_at <= ?"
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
    query += " WHERE u.role = 'student'"

    params = []
    if start:
        query += " AND t.created_at >= ?"
        params.append(start + ' 00:00:00')
    if end:
        query += " AND t.created_at <= ?"
        params.append(end + ' 23:59:59')
    query += " GROUP BY u.user_id ORDER BY resolved_count DESC"

    rows = db.execute(query, params + collab_params).fetchall()
    db.close()
    return jsonify(dicts_from_rows(rows))
```

- [ ] **Step 2: Verify rankings response**

```bash
curl -H "Authorization: Bearer <admin_token>" http://127.0.0.1:5000/api/stats/rankings
```

Expected: each entry includes `collaboration_count` (integer).

- [ ] **Step 3: Commit**

```bash
git add backend/routes/stats.py
git commit -m "feat: add collaboration_count to rankings with completed_at date filter"
```

---

### Task 7: Frontend — Update TypeScript Types

**Files:**
- Modify: `app/src/types/index.ts:1-75`

- [ ] **Step 1: Add Collaborator interface and update Ticket and RankingData**

Replace the file content:

```typescript
export type UserRole = 'teacher' | 'student' | 'admin';
export type TicketStatus = 'pending' | 'processing' | 'resolved';

export interface User {
  id: string;
  user_id?: string;
  name: string;
  role: UserRole;
  avatar: string;
  phone?: string;
  department?: string;
}

export interface Collaborator {
  user_id: string;
  user_name: string;
}

export interface Ticket {
  id: number;
  reporter_id: string;
  reporter_name: string;
  contact: string;
  location: string;
  category: string;
  description: string;
  assignee_id?: string;
  assignee_name?: string;
  status: TicketStatus;
  solution?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  collaborators?: Collaborator[];
}

export interface Category {
  id: number | string;
  name: string;
  ticket_count?: number;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Stats {
  total: number;
  pending: number;
  processing: number;
  resolved: number;
  today: number;
}

export interface RankingData {
  user_id: string;
  name: string;
  claimed_count: number;
  resolved_count: number;
  completion_rate: number;
  avg_process_time: number;
  collaboration_count: number;
}

export interface CategoryStatData {
  category: string;
  count: number;
  percentage: number;
  pending: number;
  processing: number;
  resolved: number;
}

export interface TrendData {
  period: string;
  total: number;
  resolved: number;
}

export type RankingSortKey = 'claimed_count' | 'resolved_count' | 'collaboration_count' | 'avg_process_time';
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat: add Collaborator type and update Ticket, RankingData types"
```

---

### Task 8: Frontend — Add `getStudents` to API Client

**Files:**
- Modify: `app/src/api/index.ts:65-82`

- [ ] **Step 1: Add getStudents method**

In the `api` object, add after the `stats` block:

```typescript
const api = {
  get: <T = unknown>(path: string, opts?: { params?: Record<string, string>; responseType?: string }) =>
    request<T>('GET', path, undefined, opts),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>('POST', path, body),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>('PUT', path, body),
  delete: <T = unknown>(path: string) =>
    request<T>('DELETE', path),
  students: {
    list: () =>
      request<{ user_id: string; user_name: string }[]>('GET', '/students'),
  },
  stats: {
    rankings: (params?: Record<string, string>) =>
      request<RankingData[]>('GET', '/stats/rankings', undefined, { params }),
    categories: (params?: Record<string, string>) =>
      request<CategoryStatData[]>('GET', '/stats/categories', undefined, { params }),
    trends: (params?: Record<string, string>) =>
      request<TrendData[]>('GET', '/stats/trends', undefined, { params }),
  },
};
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/api/index.ts
git commit -m "feat: add students.list() API method"
```

---

### Task 9: Frontend — Update `resolveTicket` in useStore

**Files:**
- Modify: `app/src/hooks/useStore.ts:148-168`

- [ ] **Step 1: Update resolveTicket to accept collaboratorIds**

Replace lines 148-168 with:

```typescript
  const resolveTicket = useCallback(async (ticketId: number, solution: string, collaboratorIds: string[] = []) => {
    if (USE_MOCK) {
      const completedAt = formatDateTime(new Date());
      setTickets(prev => prev.map(t =>
        t.id === ticketId ? { ...t, status: 'resolved' as const, solution, completed_at: completedAt } : t
      ));
      setSolutionModalOpen(false);
      setDetailModalOpen(false);
      showToast('工单已标记为已解决');
      return;
    }
    try {
      await api.put(`/tickets/${ticketId}/complete`, { solution, collaborator_ids: collaboratorIds });
      setSolutionModalOpen(false);
      setDetailModalOpen(false);
      showToast('工单已标记为已解决');
      fetchTickets();
    } catch (e) {
      showToast(getErrorMsg(e, '处理失败'), 'error');
    }
  }, [showToast, fetchTickets]);
```

Also update the `Collaborator` import at the top of `useStore.ts` — replace line 2:

```typescript
import type { Ticket, User, ToastState, TicketStatus, Category, Stats, Collaborator } from '@/types';
```

And update the `exportToCSV` mock to include collaborators column (line 301):

```typescript
      const headers = ['ID', '报修人', '报修人工号', '电话', '位置', '故障类型', '描述', '提交时间', '状态', '处理人', '协作者', '接单人工号', '处理方案'];
      const rows = sortedTickets.map(t => [
        String(t.id), t.reporter_name, t.reporter_id || '-', t.contact, t.location, t.category,
        t.description, t.created_at, statusMap[t.status],
        t.assignee_name || '', (t.collaborators || []).map(c => c.user_name).join('、'),
        t.assignee_id || '-', t.solution || '',
      ]);
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/hooks/useStore.ts
git commit -m "feat: update resolveTicket with collaboratorIds param"
```

---

### Task 10: Frontend — Update SolutionModal with Collaborator Multi-Select

**Files:**
- Modify: `app/src/components/SolutionModal.tsx:1-77`

- [ ] **Step 1: Rewrite SolutionModal with collaborator selector**

```tsx
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '@/api';

interface StudentOption {
  user_id: string;
  user_name: string;
}

interface SolutionModalProps {
  onClose: () => void;
  onConfirm: (solution: string, collaboratorIds: string[]) => void;
  currentUserId?: string;
}

export function SolutionModal({ onClose, onConfirm, currentUserId }: SolutionModalProps) {
  const [solution, setSolution] = useState('');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.students.list().then(res => {
      setStudents(res.data.filter(s => s.user_id !== currentUserId));
    }).catch(() => {});
  }, [currentUserId]);

  const handleConfirm = () => {
    if (!solution.trim()) return;
    onConfirm(solution.trim(), selectedIds);
  };

  const toggleStudent = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : prev.length < 2
          ? [...prev, userId]
          : prev
    );
  };

  const filteredStudents = students.filter(s =>
    s.user_name.includes(searchTerm) || s.user_id.includes(searchTerm)
  );

  const isMax = selectedIds.length >= 2;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl w-full max-w-[480px] shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5ea]">
          <h2 className="text-[20px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>填写处理方案</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#e5e5ea] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Collaborator selector */}
          <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
            协作者 <span className="text-[#86868b] font-normal">(可选最多 2 人)</span>
          </label>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedIds.map(uid => {
                const s = students.find(st => st.user_id === uid);
                return s ? (
                  <span key={uid} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0f7ff] text-[#0066cc] text-[13px] font-medium">
                    {s.user_name}
                    <button
                      onClick={() => toggleStudent(uid)}
                      className="ml-0.5 text-[#0066cc] hover:text-[#ff3b30] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜索处理人姓名或工号..."
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e5e5ea] text-[13px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] transition-all duration-250 mb-2"
          />

          {searchTerm && (
            <div className="max-h-[120px] overflow-y-auto rounded-lg border border-[#e5e5ea] mb-3">
              {filteredStudents.length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-[#d2d2d7]">无匹配结果</div>
              ) : (
                filteredStudents.map(s => {
                  const isSelected = selectedIds.includes(s.user_id);
                  return (
                    <button
                      key={s.user_id}
                      onClick={() => toggleStudent(s.user_id)}
                      disabled={!isSelected && isMax}
                      className={`w-full text-left px-3 py-2 text-[13px] transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#f0f7ff] text-[#0066cc]'
                          : isMax
                            ? 'text-[#d2d2d7] cursor-not-allowed'
                            : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                      }`}
                    >
                      {s.user_name} <span className="text-[#d2d2d7]">({s.user_id})</span>
                      {isSelected && <span className="float-right text-[#34c759]">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}

          <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
            处理方案 <span className="text-[#ff3b30]">*</span>
          </label>
          <textarea
            value={solution}
            onChange={e => setSolution(e.target.value)}
            rows={5}
            className="w-full px-4 py-3 rounded-lg bg-white border border-[#e5e5ea] text-[14px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250 resize-none"
            placeholder="请描述故障原因及处理过程，例如：
- 故障原因分析
- 采取的处理措施
- 使用的工具/设备
- 后续建议"
          />
        </div>

        <div className="px-6 py-4 border-t border-[#e5e5ea] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-full bg-white border border-[#e5e5ea] text-[14px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!solution.trim()}
            className={`flex-1 h-11 rounded-full text-[14px] font-medium transition-all duration-250 cursor-pointer ${
              solution.trim()
                ? 'bg-[#0066cc] text-white shadow-[0_2px_8px_rgba(0,102,204,0.3)] hover:bg-[#0055aa]'
                : 'bg-[#e5e5ea] text-[#d2d2d7] cursor-not-allowed'
            }`}
          >
            确认解决
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/SolutionModal.tsx
git commit -m "feat: add collaborator multi-select to SolutionModal"
```

---

### Task 11: Frontend — Update App.tsx to Pass Props to SolutionModal

**Files:**
- Modify: `app/src/App.tsx:226-235`

- [ ] **Step 1: Update SolutionModal usage**

Replace the SolutionModal block in App.tsx (lines 226-235):

```tsx
              {store.solutionModalOpen && store.selectedTicket ? (
                <SolutionModal
                  onClose={() => { store.setSolutionModalOpen(false); store.setSelectedTicket(null); }}
                  onConfirm={(solution, collaboratorIds) => {
                    if (store.selectedTicket) {
                      store.resolveTicket(store.selectedTicket.id, solution, collaboratorIds);
                      store.setSelectedTicket(null);
                    }
                  }}
                  currentUserId={store.currentUser?.user_id}
                />
              ) : null}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat: pass collaboratorIds through SolutionModal to resolveTicket"
```

---

### Task 12: Frontend — Update TicketCard to Show Collaborators

**Files:**
- Modify: `app/src/components/TicketCard.tsx:59-64`

- [ ] **Step 1: Update handler display for resolved tickets with collaborators**

Replace lines 59-64:

```tsx
      {ticket.assignee_name && (
        <div className="mt-2 text-[13px] text-[#86868b]">
          处理人：{ticket.assignee_name}
          {ticket.assignee_id && <span className="text-[#d2d2d7]"> ({ticket.assignee_id})</span>}
          {isResolved && ticket.collaborators && ticket.collaborators.length > 0 && (
            <span> + {ticket.collaborators.map(c => c.user_name).join('、')}</span>
          )}
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/TicketCard.tsx
git commit -m "feat: show collaborators on resolved TicketCard"
```

---

### Task 13: Frontend — Update TicketModal to Show Collaborators

**Files:**
- Modify: `app/src/components/TicketModal.tsx:17-31`

- [ ] **Step 1: Add collaborators to detailItems**

In the `detailItems` useMemo, after the "处理人" line (line 25), add a collaborators line:

```tsx
    ...(ticket.assignee_name ? [{ label: '处理人', value: ticket.assignee_name + (ticket.assignee_id ? ` (${ticket.assignee_id})` : '') }] : []),
    ...(isResolved && ticket.collaborators && ticket.collaborators.length > 0
      ? [{ label: '协作者', value: ticket.collaborators.map(c => c.user_name + (c.user_id ? ` (${c.user_id})` : '')).join('、') }]
      : []),
    ...(isResolved
```

And update the dependency array (line 31) to include `ticket.collaborators`:

```tsx
  ], [ticket.id, ticket.reporter_name, ticket.reporter_id, ticket.contact, ticket.location, ticket.category, ticket.created_at, ticket.assignee_name, ticket.assignee_id, ticket.completed_at, ticket.collaborators, statusLabel, isResolved]);
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/TicketModal.tsx
git commit -m "feat: show collaborators on resolved TicketModal"
```

---

### Task 14: Frontend — Update StudentRanking with New Columns

**Files:**
- Modify: `app/src/components/StudentRanking.tsx:1-103`

- [ ] **Step 1: Rewrite StudentRanking with collaboration_count and total participation**

Replace the full file:

```tsx
import { useMemo, useState } from 'react';
import type { RankingData, RankingSortKey } from '@/types';

interface StudentRankingProps {
  data: RankingData[];
}

function medalStyle(rank: number) {
  if (rank === 1) return { border: 'border-[#f5a623]', bg: 'bg-[#fffbf0]', shadow: 'shadow-[0_2px_12px_rgba(245,166,35,0.2)]' };
  if (rank === 2) return { border: 'border-[#a0a0a5]', bg: 'bg-[#f8f8fa]', shadow: 'shadow-[0_2px_12px_rgba(160,160,165,0.2)]' };
  if (rank === 3) return { border: 'border-[#cd7f32]', bg: 'bg-[#fdf6f0]', shadow: 'shadow-[0_2px_12px_rgba(205,127,50,0.2)]' };
  return { border: 'border-transparent', bg: 'bg-white', shadow: '' };
}

const MEDAL_MAP: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatTime(minutes: number) {
  if (minutes <= 0) return '-';
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

export function StudentRanking({ data }: StudentRankingProps) {
  const [sortKey, setSortKey] = useState<RankingSortKey>('resolved_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const val = sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey];
      return val;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: RankingSortKey) => {
    if (key === sortKey) setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortArrow = (key: RankingSortKey) => {
    if (key !== sortKey) return '';
    return sortDir === 'desc' ? ' ▲' : ' ▼';
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#d2d2d7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-[16px] font-medium text-[#86868b]">暂无处理人数据</p>
        <p className="text-[13px] text-[#d2d2d7] mt-1">暂无处理人的工单记录</p>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden sm:flex items-center px-4 py-3 mb-2 text-[12px] font-semibold text-[#86868b]">
        <span className="w-10 flex-shrink-0" />
        <span className="flex-[2] min-w-0">姓名</span>
        <button onClick={() => handleSort('claimed_count')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'claimed_count' ? 'text-[#0066cc]' : ''}`}>认领数{sortArrow('claimed_count')}</button>
        <button onClick={() => handleSort('collaboration_count')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'collaboration_count' ? 'text-[#0066cc]' : ''}`}>协作数{sortArrow('collaboration_count')}</button>
        <span className="flex-1 min-w-0 text-left">总参与</span>
        <button onClick={() => handleSort('avg_process_time')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'avg_process_time' ? 'text-[#0066cc]' : ''}`}>平均处理时长{sortArrow('avg_process_time')}</button>
      </div>

      <div className="space-y-2">
        {sorted.map((item, index) => {
          const rank = index + 1;
          const isTop3 = rank <= 3;
          const style = medalStyle(rank);
          const totalParticipation = item.resolved_count + item.collaboration_count;

          return (
            <div key={item.user_id} className={`rounded-xl py-3 px-4 border ${style.border} ${style.bg} ${style.shadow} transition-all duration-250`}>
              <div className="flex items-center gap-3">
                {isTop3 ? (
                  <span className="text-2xl flex-shrink-0 w-10 text-center">{MEDAL_MAP[rank]}</span>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center flex-shrink-0">
                    <span className="text-[14px] font-bold text-[#0066cc]">{rank}</span>
                  </div>
                )}
                <span className="text-[15px] font-semibold text-[#1d1d1f] flex-[2] min-w-0 truncate">{item.name}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{item.claimed_count}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{item.collaboration_count}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{totalParticipation}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{formatTime(item.avg_process_time)}</span>
                <div className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#86868b]">
                  <span>认领 {item.claimed_count}</span><span>协作 {item.collaboration_count}</span>
                  <span>总参与 {totalParticipation}</span><span>平均 {formatTime(item.avg_process_time)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/StudentRanking.tsx
git commit -m "feat: update StudentRanking with collaboration_count and total participation"
```

---

### Task 15: Frontend — Update Mock Data

**Files:**
- Modify: `app/src/data/mockData.ts`

- [ ] **Step 1: Add more student users and collaborators to mock data**

Read `app/src/data/mockData.ts` and add at least 3 student users to the `users` array (S001, S002, S003). Add `collaborators` to the resolved ticket (id: 2):

```typescript
// In users array, add student users:
{ id: 's2', user_id: 'S002', name: '张三', role: 'student', avatar: '/images/avatar1.jpg' },
{ id: 's3', user_id: 'S003', name: '李四', role: 'student', avatar: '/images/avatar1.jpg' },

// On resolved ticket (id: 2), add:
collaborators: [{ user_id: 'S002', user_name: '张三' }],
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/data/mockData.ts
git commit -m "feat: update mock data with student users and collaborators"
```

---

### Task 16: Test Script — Generate Collaborators for Resolved Tickets

**Files:**
- Modify: `scripts/generate_test_tickets.py:140-164`

- [ ] **Step 1: Add collaborator generation after ticket insertion**

After the `db.executemany` for tickets (after line 172), add collaborator generation:

```python
    # Generate collaborators for resolved tickets
    collab_data = []
    for i in range(count):
        r = random.random()
        if r >= 0.6:  # resolved tickets only
            ticket_idx = i + 1  # ticket IDs start from 1 (after DELETE)
            assignee_id, _ = tickets[i][7]  # assignee_id is at index 7 in the tuple
            available = [(uid, uname) for uid, uname in STUDENTS if uid != assignee_id]
            num_collabs = random.randint(0, min(2, len(available)))
            chosen = random.sample(available, num_collabs)
            for uid, uname in chosen:
                collab_data.append((ticket_idx, uid, uname))

    if collab_data:
        db.executemany(
            'INSERT INTO ticket_collaborators (ticket_id, user_id, user_name) VALUES (?, ?, ?)',
            collab_data
        )
        db.commit()
        print(f'  Generated {len(collab_data)} collaborator records.')
```

- [ ] **Step 2: Test the script**

```bash
python scripts/generate_test_tickets.py
```

Expected: resolves tickets get 0-2 random collaborators, collaborator records printed.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate_test_tickets.py
git commit -m "feat: generate collaborators for resolved test tickets"
```

---

### Task 17: Final Verification — Full Build + Integration Test

- [ ] **Step 1: Run backend tests**

```bash
python -m pytest backend/tests/ -v
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

```bash
cd app && npx tsc --noEmit && npm run build
```

Expected: no errors, successful build.

- [ ] **Step 3: Manual smoke test**

1. Start backend and frontend
2. Login as student S001
3. Claim a pending ticket
4. Complete it, selecting 2 collaborators
5. Verify ticket card shows "处理人：S001 + 协作者1、协作者2"
6. Login as S002, verify the collaborated ticket appears in list
7. Login as admin, verify rankings show collaboration_count and total participation

- [ ] **Step 4: Commit final**

```bash
git add . && git commit -m "feat: complete multi-person collaboration feature"
```
