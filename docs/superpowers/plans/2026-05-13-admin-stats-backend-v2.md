> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# 管理员数据统计 - 后端聚合 + 前端优化 实现计划 v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 将统计计算从前端 useMemo 迁移到后端 SQL 聚合，3 个新 API + 前端去除头像 + 紧凑化

**Architecture:** Flask SQLite 后端新增 `routes/stats.py`，3 个 SQL GROUP BY 端点；前端移除聚合逻辑改为 API 调用 + Tab 懒加载缓存

**Tech Stack:** Python Flask + SQLite / React 19 + TypeScript + Tailwind + Recharts + react-router v7

---

### Task 1: 创建后端 stats 路由 + 3 个 API 端点

**Files:**
- Create: `backend/routes/stats.py`
- Modify: `backend/app.py` (register blueprint)

- [ ] **Step 1: 创建 `backend/routes/stats.py`**

```python
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
                THEN (julianday(t.completed_at)-julianday(t.created_at))*1440 END) AS INTEGER), 0) AS avg_process_time
        FROM users u
        LEFT JOIN tickets t ON t.assignee_id = u.user_id
        WHERE u.role = 'student'
    '''
    params = []
    if start:
        query += " AND t.created_at >= ?"
        params.append(start + ' 00:00:00')
    if end:
        query += " AND t.created_at <= ?"
        params.append(end + ' 23:59:59')
    query += " GROUP BY u.user_id ORDER BY resolved_count DESC"

    rows = db.execute(query, params).fetchall()
    db.close()
    return jsonify(dicts_from_rows(rows))


@stats_bp.route('/stats/categories', methods=['GET'])
@login_required
@require_role('admin')
def category_stats():
    start = request.args.get('start_date', '')
    end = request.args.get('end_date', '')
    db = get_db()

    # Get total count for percentage
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
        period_expr = '''
            strftime('%Y', created_at) || '-W' ||
            substr('0' || ((strftime('%j', created_at) - 1) / 7 + 1), -2, 2)
        '''
    else:
        period_expr = "substr(created_at, 1, 7)"

    query = f'''
        SELECT {period_expr} AS period,
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
```

- [ ] **Step 2: 在 `backend/app.py` 注册 blueprint**

在 `from routes.tickets import tickets_bp` 之后添加：
```python
from routes.stats import stats_bp
```
在 `app.register_blueprint(categories_bp, url_prefix='/api')` 之后添加：
```python
app.register_blueprint(stats_bp, url_prefix='/api')
```

- [ ] **Step 3: 启动后端验证接口**

```powershell
cd backend; python app.py
# 另开终端测试
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/stats/rankings
```

- [ ] **Step 4: Commit**

```bash
git add backend/routes/stats.py backend/app.py
git commit -m "feat: add 3 stats API endpoints (rankings, categories, trends)"
```

---

### Task 2: 更新前端类型定义

**Files:**
- Modify: `app/src/types/index.ts`

- [ ] **Step 1: 清理旧类型，新增 API 响应类型**

移除 `StudentRankingItem`、`CategoryStatItem`、`TrendDataPoint`、`RankingSortKey`（保留排序用）。

新增：
```ts
export interface RankingData {
  user_id: string;
  name: string;
  claimed_count: number;
  resolved_count: number;
  completion_rate: number;
  avg_process_time: number;
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

export type RankingSortKey = 'claimed_count' | 'resolved_count' | 'completion_rate' | 'avg_process_time';
```

- [ ] **Step 2: 编译检查并 commit**

---

### Task 3: 更新 API 层

**Files:**
- Modify: `app/src/api/index.ts`

- [ ] **Step 1: 在 api 对象中新增 stats 方法**

```ts
stats: {
  rankings: (params?: Record<string, string>) =>
    api.get<RankingData[]>('/stats/rankings', { params }),
  categories: (params?: Record<string, string>) =>
    api.get<CategoryStatData[]>('/stats/categories', { params }),
  trends: (params?: Record<string, string>) =>
    api.get<TrendData[]>('/stats/trends', { params }),
},
```

注意 `stats` 对象需要放在 `api` 常量内部，返回的 `api` 对象中新增该属性。

- [ ] **Step 2: Commit**

---

### Task 4: 重写 StudentRanking（去头像 + 新 props）

**Files:**
- Modify: `app/src/components/StudentRanking.tsx`

- [ ] **Step 1: 重写组件**

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
        <button onClick={() => handleSort('claimed_count')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'claimed_count' ? 'text-[#0066cc]' : ''}`}>接单数{sortArrow('claimed_count')}</button>
        <button onClick={() => handleSort('resolved_count')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'resolved_count' ? 'text-[#0066cc]' : ''}`}>完成数{sortArrow('resolved_count')}</button>
        <button onClick={() => handleSort('completion_rate')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'completion_rate' ? 'text-[#0066cc]' : ''}`}>完成率{sortArrow('completion_rate')}</button>
        <button onClick={() => handleSort('avg_process_time')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'avg_process_time' ? 'text-[#0066cc]' : ''}`}>平均处理时长{sortArrow('avg_process_time')}</button>
      </div>

      <div className="space-y-2">
        {sorted.map((item, index) => {
          const rank = index + 1;
          const isTop3 = rank <= 3;
          const style = medalStyle(rank);

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
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{item.resolved_count}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{item.completion_rate}%</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{formatTime(item.avg_process_time)}</span>
                <div className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#86868b]">
                  <span>接单 {item.claimed_count}</span><span>完成 {item.resolved_count}</span>
                  <span>完成率 {item.completion_rate}%</span><span>平均 {formatTime(item.avg_process_time)}</span>
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

- [ ] **Step 2: 编译检查并 commit**

---

### Task 5: 重写 TicketStats（接收预计算数据）

**Files:**
- Modify: `app/src/components/TicketStats.tsx`

- [ ] **Step 1: 重写组件**

Props 从 `{ tickets, categories }` 改为 `{ categoryStats, trendData, onTrendViewChange }`。移除 useMemo 聚合。趋势切换通过 `onTrendViewChange` 回调触发父组件重新请求。

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import type { CategoryStatData, TrendData } from '@/types';

interface TicketStatsProps {
  categoryStats: CategoryStatData[];
  trendData: TrendData[];
  trendView: 'month' | 'week';
  onTrendViewChange: (view: 'month' | 'week') => void;
}

const PIE_COLORS = ['#0066cc', '#34c759', '#ff9500', '#af52de', '#5ac8fa', '#ff3b30', '#ffcc02', '#5856d6', '#0a84ff', '#8e8e93'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white rounded-lg border border-[#e5e5ea] px-3 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      <p className="text-[12px] font-medium text-[#1d1d1f] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-[12px] text-[#86868b]">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }} />
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function TicketStats({ categoryStats, trendData, trendView, onTrendViewChange }: TicketStatsProps) {
  const nonEmptyStats = categoryStats.filter(c => c.count > 0);
  const barData = categoryStats.filter(c => c.count > 0).map(c => ({ name: c.category, 数量: c.count }));

  if (categoryStats.length === 0 && trendData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#d2d2d7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-[16px] font-medium text-[#86868b]">暂无工单统计数据</p>
        <p className="text-[13px] text-[#d2d2d7] mt-1">当前日期范围内没有工单数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pie Chart */}
      {nonEmptyStats.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f] mb-4">故障分类占比</h3>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="w-full lg:w-1/2" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={nonEmptyStats} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="count" nameKey="category">
                    {nonEmptyStats.map((cat, i) => (
                      <Cell key={cat.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {nonEmptyStats.map((cat, i) => (
                <div key={cat.category} className="flex items-center gap-2 text-[13px]">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[#1d1d1f] font-medium truncate">{cat.category}</span>
                  <span className="text-[#86868b] ml-auto flex-shrink-0">{cat.count} ({cat.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {barData.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f] mb-4">各分类工单数量</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#86868b' }} axisLine={{ stroke: '#e5e5ea' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="数量" fill="#0066cc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Line Chart */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-semibold text-[#1d1d1f]">时间趋势</h3>
            <div className="flex gap-1 bg-[#f5f5f7] rounded-full p-0.5">
              <button onClick={() => onTrendViewChange('month')} className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${trendView === 'month' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#86868b]'}`}>按月</button>
              <button onClick={() => onTrendViewChange('week')} className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${trendView === 'week' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#86868b]'}`}>按周</button>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={{ stroke: '#e5e5ea' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="total" name="工单总量" stroke="#0066cc" strokeWidth={2} dot={{ r: 3, fill: '#0066cc' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="resolved" name="已解决" stroke="#34c759" strokeWidth={2} dot={{ r: 3, fill: '#34c759' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detail Table */}
      {categoryStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <h3 className="px-5 py-4 text-[16px] font-semibold text-[#1d1d1f] border-b border-[#f5f5f7]">分类明细</h3>
          <div className="hidden sm:flex px-5 py-3 text-[12px] font-semibold text-[#86868b] border-b border-[#f5f5f7] gap-2">
            <span className="flex-[2] min-w-0">故障分类</span>
            <span className="flex-1 min-w-0 text-center">数量</span>
            <span className="flex-1 min-w-0 text-center">占比</span>
            <span className="flex-1 min-w-0 text-center">待处理</span>
            <span className="flex-1 min-w-0 text-center">处理中</span>
            <span className="flex-1 min-w-0 text-center">已解决</span>
          </div>
          {categoryStats.map((cat, i) => (
            <div key={cat.category} className={`flex flex-col sm:flex-row sm:items-center px-5 py-3 gap-1 sm:gap-2 hover:bg-[#f5f5f7] transition-colors text-[14px] ${i < categoryStats.length - 1 ? 'border-b border-[#f5f5f7]' : ''}`}>
              <span className="font-medium text-[#1d1d1f] sm:flex-[2] sm:min-w-0 truncate">{cat.category}</span>
              <div className="flex sm:hidden gap-3 text-[12px] text-[#86868b]">
                <span>数量 {cat.count}</span><span>占比 {cat.percentage}%</span>
                <span>待处理 {cat.pending}</span><span>处理中 {cat.processing}</span><span>已解决 {cat.resolved}</span>
              </div>
              <span className="hidden sm:block flex-1 min-w-0 text-center text-[#1d1d1f] font-medium">{cat.count}</span>
              <span className="hidden sm:block flex-1 min-w-0 text-center text-[#86868b]">{cat.percentage}%</span>
              <span className="hidden sm:block flex-1 min-w-0 text-center"><span className="text-[#ff9500] font-medium">{cat.pending}</span></span>
              <span className="hidden sm:block flex-1 min-w-0 text-center"><span className="text-[#af52de] font-medium">{cat.processing}</span></span>
              <span className="hidden sm:block flex-1 min-w-0 text-center"><span className="text-[#34c759] font-medium">{cat.resolved}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 编译检查并 commit**

---

### Task 6: 重写 AdminStatsPage（API 请求 + 缓存 + 懒加载）

**Files:**
- Modify: `app/src/pages/AdminStatsPage.tsx`

- [ ] **Step 1: 重写页面容器**

加入数据 state、加载状态、缓存逻辑、API 调用。移除 `tickets/users/categories` props（不再需要）。

```tsx
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { FilterBar } from '@/components/FilterBar';
import { StudentRanking } from '@/components/StudentRanking';
import { TicketStats } from '@/components/TicketStats';
import api from '@/api';
import type { TicketStatus, RankingData, CategoryStatData, TrendData } from '@/types';

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const fmt = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };
  return { start: fmt(start), end: fmt(end) };
}

export function AdminStatsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ranking' | 'stats'>('ranking');
  const [filterStart, setFilterStart] = useState(defaultDateRange().start);
  const [filterEnd, setFilterEnd] = useState(defaultDateRange().end);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('');
  const [appliedStart, setAppliedStart] = useState(defaultDateRange().start);
  const [appliedEnd, setAppliedEnd] = useState(defaultDateRange().end);

  const [rankings, setRankings] = useState<RankingData[] | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStatData[] | null>(null);
  const [trendData, setTrendData] = useState<TrendData[] | null>(null);
  const [trendView, setTrendView] = useState<'month' | 'week'>('month');
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  const dateParams = useCallback(() => {
    const p: Record<string, string> = {};
    if (appliedStart) p.start_date = appliedStart;
    if (appliedEnd) p.end_date = appliedEnd;
    return p;
  }, [appliedStart, appliedEnd]);

  const fetchRankings = useCallback(async () => {
    setLoadingRankings(true);
    try {
      const res = await api.stats.rankings(dateParams());
      setRankings(res.data);
    } catch { /* toast handled by caller */ }
    finally { setLoadingRankings(false); }
  }, [dateParams]);

  const fetchCategoryStats = useCallback(async () => {
    const res = await api.stats.categories(dateParams());
    setCategoryStats(res.data);
  }, [dateParams]);

  const fetchTrendData = useCallback(async (view: 'month' | 'week') => {
    const res = await api.stats.trends({ ...dateParams(), view });
    setTrendData(res.data);
  }, [dateParams]);

  const fetchAllStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      await Promise.all([fetchCategoryStats(), fetchTrendData(trendView)]);
    } catch { /* ignore */ }
    finally { setLoadingStats(false); }
  }, [fetchCategoryStats, fetchTrendData, trendView]);

  // Fetch rankings on mount and when date changes
  useEffect(() => { fetchRankings(); }, [fetchRankings]);

  // Switch tab: lazy load stats if not yet loaded
  useEffect(() => {
    if (activeTab === 'stats' && categoryStats === null && trendData === null) {
      fetchAllStats();
    }
  }, [activeTab, categoryStats, trendData, fetchAllStats]);

  const handleApplyFilter = () => {
    setAppliedStart(filterStart);
    setAppliedEnd(filterEnd);
    // Clear cache to force re-fetch
    setRankings(null);
    setCategoryStats(null);
    setTrendData(null);
  };

  const handleTrendViewChange = (view: 'month' | 'week') => {
    setTrendView(view);
    setTrendData(null);
    fetchTrendData(view);
  };

  const loadingSpinner = (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin')} className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#e5e5ea] transition-colors cursor-pointer flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>数据统计</h2>
      </div>

      <FilterBar
        startDate={filterStart}
        endDate={filterEnd}
        status={filterStatus}
        onStartChange={setFilterStart}
        onEndChange={setFilterEnd}
        onStatusChange={setFilterStatus}
        onApply={handleApplyFilter}
      />

      <div className="flex gap-1 bg-[#f5f5f7] rounded-full p-1 mb-6 w-fit">
        <button onClick={() => setActiveTab('ranking')} className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all cursor-pointer ${activeTab === 'ranking' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#86868b]'}`}>处理人排名</button>
        <button onClick={() => setActiveTab('stats')} className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all cursor-pointer ${activeTab === 'stats' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#86868b]'}`}>工单统计</button>
      </div>

      {activeTab === 'ranking' ? (
        loadingRankings ? loadingSpinner :
        rankings ? <StudentRanking data={rankings} /> : null
      ) : (
        loadingStats ? loadingSpinner :
        (categoryStats && trendData) ? (
          <TicketStats
            categoryStats={categoryStats}
            trendData={trendData}
            trendView={trendView}
            onTrendViewChange={handleTrendViewChange}
          />
        ) : null
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

---

### Task 7: 更新 App.tsx 路由（移除旧 props）

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 1: 简化 AdminStatsPage 路由**

AdminStatsPage 现在不需要 props，改为内部自行获取数据。替换路由中的：
```tsx
<AdminStatsPage
  tickets={store.tickets}
  users={store.userList}
  categories={store.categories}
/>
```
为：
```tsx
<AdminStatsPage />
```

- [ ] **Step 2: 编译检查并 commit**

---

### Task 8: 最终验证

- [ ] **Step 1: 运行 TypeScript + ESLint**

```powershell
cd app; npx tsc --noEmit; npx eslint src/
```

- [ ] **Step 2: 运行 Vite build**

```powershell
cd app; npm run build
```

- [ ] **Step 3: 启动后端 + 前端，手动验证**

```powershell
# Terminal 1
cd backend; python app.py

# Terminal 2
cd app; npm run dev
```

验证：管理员登录 → 数据统计 → 排名加载 → 工单统计加载 → 日期筛选 → 趋势按月/周切换。
