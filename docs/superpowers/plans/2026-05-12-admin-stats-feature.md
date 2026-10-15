> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# 管理员数据统计功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在管理员界面新增「数据统计」页面，包含处理人排名统计（多指标+排序+奖牌卡片）和工单统计（图表+表格+日期筛选）

**Architecture:** 前端纯聚合方案——从现有 `tickets`、`users`、`categories` 数据用 useMemo 计算统计结果。新增 3 个组件文件 + 1 个页面文件，修改 Header（菜单项）和 App.tsx（路由）。复用 FilterBar 和现有设计令牌。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS + Recharts + lucide-react + react-router v7

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `app/src/types/index.ts` | 新增统计相关类型定义 | 修改 |
| `app/src/components/StudentRanking.tsx` | 排名卡片列表 + 排序列头 | 新建 |
| `app/src/components/TicketStats.tsx` | 图表（饼图/柱状图/折线图）+ 明细表格 | 新建 |
| `app/src/pages/AdminStatsPage.tsx` | 页面容器：日期筛选 + Tab 切换 + 子组件组合 | 新建 |
| `app/src/components/Header.tsx` | 下拉菜单新增「数据统计」选项 | 修改 |
| `app/src/App.tsx` | 新增 `/admin/stats` 路由 + lazy import | 修改 |

---

### Task 1: 新增类型定义

**Files:**
- Modify: `app/src/types/index.ts`

- [ ] **Step 1: 在 types/index.ts 末尾追加统计相关类型**

```ts
export interface StudentRankingItem {
  userId: string;
  name: string;
  avatar: string;
  claimedCount: number;
  resolvedCount: number;
  completionRate: number;
  avgProcessTime: number;
}

export interface CategoryStatItem {
  category: string;
  count: number;
  percentage: number;
  pending: number;
  processing: number;
  resolved: number;
}

export interface TrendDataPoint {
  period: string;
  total: number;
  resolved: number;
}

export type RankingSortKey = 'claimedCount' | 'resolvedCount' | 'completionRate' | 'avgProcessTime';
```

使用 Edit 工具，在 `app/src/types/index.ts` 文件末尾的 `export interface Stats { ... }` 之后追加以上类型。

- [ ] **Step 2: 运行 TypeScript 编译检查**

```powershell
npx tsc --noEmit
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat: add statistics-related TypeScript types"
```

---

### Task 2: 创建 StudentRanking 组件

**Files:**
- Create: `app/src/components/StudentRanking.tsx`

- [ ] **Step 1: 创建组件文件**

```tsx
import { useMemo, useState } from 'react';
import type { Ticket, User, StudentRankingItem, RankingSortKey } from '@/types';

interface StudentRankingProps {
  tickets: Ticket[];
  users: User[];
}

function medalStyle(rank: number) {
  if (rank === 1) return { border: 'border-[#f5a623]', bg: 'bg-[#fffbf0]', shadow: 'shadow-[0_2px_12px_rgba(245,166,35,0.2)]' };
  if (rank === 2) return { border: 'border-[#a0a0a5]', bg: 'bg-[#f8f8fa]', shadow: 'shadow-[0_2px_12px_rgba(160,160,165,0.2)]' };
  if (rank === 3) return { border: 'border-[#cd7f32]', bg: 'bg-[#fdf6f0]', shadow: 'shadow-[0_2px_12px_rgba(205,127,50,0.2)]' };
  return { border: 'border-transparent', bg: 'bg-white', shadow: '' };
}

function medalEmoji(rank: number) { return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'; }

export function StudentRanking({ tickets, users }: StudentRankingProps) {
  const [sortKey, setSortKey] = useState<RankingSortKey>('resolvedCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rankings = useMemo(() => {
    const studentUsers = users.filter(u => u.role === 'student');
    return studentUsers.map(user => {
      const userTickets = tickets.filter(t => t.assignee_id === user.user_id);
      const claimed = userTickets.filter(t => t.status === 'processing' || t.status === 'resolved');
      const resolved = userTickets.filter(t => t.status === 'resolved');
      const durationSum = resolved.reduce((sum, t) => {
        if (t.completed_at && t.created_at) {
          return sum + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime());
        }
        return sum;
      }, 0);
      return {
        userId: user.user_id || user.id,
        name: user.name,
        avatar: user.avatar,
        claimedCount: claimed.length,
        resolvedCount: resolved.length,
        completionRate: claimed.length > 0 ? Math.round((resolved.length / claimed.length) * 100) : 0,
        avgProcessTime: resolved.length > 0 ? Math.round(durationSum / resolved.length / 60000) : 0,
      };
    });
  }, [tickets, users]);

  const sortedRankings = useMemo(() => {
    const sorted = [...rankings].sort((a, b) => {
      const val = sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey];
      return val;
    });
    return sorted;
  }, [rankings, sortKey, sortDir]);

  const handleSort = (key: RankingSortKey) => {
    if (key === sortKey) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortArrow = (key: RankingSortKey) => {
    if (key !== sortKey) return '';
    return sortDir === 'desc' ? ' ▲' : ' ▼';
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  };

  if (sortedRankings.length === 0) {
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
      {/* Sort Header */}
      <div className="hidden sm:flex items-center px-4 py-3 mb-2 text-[12px] font-semibold text-[#86868b]">
        <span className="w-10 flex-shrink-0" />
        <span className="flex-[2] min-w-0">姓名</span>
        <button onClick={() => handleSort('claimedCount')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'claimedCount' ? 'text-[#0066cc]' : ''}`}>
          接单数{sortArrow('claimedCount')}
        </button>
        <button onClick={() => handleSort('resolvedCount')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'resolvedCount' ? 'text-[#0066cc]' : ''}`}>
          完成数{sortArrow('resolvedCount')}
        </button>
        <button onClick={() => handleSort('completionRate')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'completionRate' ? 'text-[#0066cc]' : ''}`}>
          完成率{sortArrow('completionRate')}
        </button>
        <button onClick={() => handleSort('avgProcessTime')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'avgProcessTime' ? 'text-[#0066cc]' : ''}`}>
          平均处理时长{sortArrow('avgProcessTime')}
        </button>
      </div>

      <div className="space-y-3">
        {sortedRankings.map((item, index) => {
          const rank = index + 1;
          const isTop3 = rank <= 3;
          const style = medalStyle(rank);

          return (
            <div
              key={item.userId}
              className={`rounded-xl p-4 border ${style.border} ${style.bg} ${style.shadow} transition-all duration-250`}
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                {isTop3 ? (
                  <span className="text-2xl flex-shrink-0 w-10 text-center">{medalEmoji(rank)}</span>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center flex-shrink-0">
                    <span className="text-[14px] font-bold text-[#0066cc]">{rank}</span>
                  </div>
                )}

                {/* Avatar + Name */}
                <div className="flex items-center gap-3 flex-[2] min-w-0">
                  <img src={item.avatar} alt={item.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  <span className="text-[15px] font-semibold text-[#1d1d1f] truncate">{item.name}</span>
                </div>

                {/* Metrics - Desktop */}
                <div className="hidden sm:flex flex-1 min-w-0 items-center">
                  <span className="text-[14px] font-medium text-[#1d1d1f]">{item.claimedCount}</span>
                </div>
                <div className="hidden sm:flex flex-1 min-w-0 items-center">
                  <span className="text-[14px] font-medium text-[#1d1d1f]">{item.resolvedCount}</span>
                </div>
                <div className="hidden sm:flex flex-1 min-w-0 items-center">
                  <span className="text-[14px] font-medium text-[#1d1d1f]">{item.completionRate}%</span>
                </div>
                <div className="hidden sm:flex flex-1 min-w-0 items-center">
                  <span className="text-[14px] font-medium text-[#1d1d1f]">{item.avgProcessTime > 0 ? formatTime(item.avgProcessTime) : '-'}</span>
                </div>

                {/* Mobile metrics row */}
                <div className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#86868b]">
                  <span>接单 {item.claimedCount}</span>
                  <span>完成 {item.resolvedCount}</span>
                  <span>完成率 {item.completionRate}%</span>
                  <span>平均 {item.avgProcessTime > 0 ? formatTime(item.avgProcessTime) : '-'}</span>
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

- [ ] **Step 2: 运行 TypeScript 编译检查**

```powershell
npx tsc --noEmit
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add app/src/components/StudentRanking.tsx
git commit -m "feat: add StudentRanking component with multi-metric sortable leaderboard"
```

---

### Task 3: 创建 TicketStats 组件

**Files:**
- Create: `app/src/components/TicketStats.tsx`

- [ ] **Step 1: 创建组件文件**

```tsx
import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import type { Ticket, Category, CategoryStatItem, TrendDataPoint } from '@/types';

interface TicketStatsProps {
  tickets: Ticket[];
  categories: Category[];
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

export function TicketStats({ tickets, categories }: TicketStatsProps) {
  const [trendView, setTrendView] = useState<'month' | 'week'>('month');

  const categoryStats: CategoryStatItem[] = useMemo(() => {
    return categories
      .map(cat => {
        const catTickets = tickets.filter(t => t.category === cat.name);
        return {
          category: cat.name,
          count: catTickets.length,
          percentage: tickets.length > 0 ? Math.round((catTickets.length / tickets.length) * 100) : 0,
          pending: catTickets.filter(t => t.status === 'pending').length,
          processing: catTickets.filter(t => t.status === 'processing').length,
          resolved: catTickets.filter(t => t.status === 'resolved').length,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [tickets, categories]);

  const trendData: TrendDataPoint[] = useMemo(() => {
    const periodMap: Record<string, { total: number; resolved: number }> = {};
    tickets.forEach(t => {
      let period: string;
      if (trendView === 'week') {
        const d = new Date(t.created_at);
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        period = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      } else {
        period = t.created_at.substring(0, 7);
      }
      if (!periodMap[period]) periodMap[period] = { total: 0, resolved: 0 };
      periodMap[period].total += 1;
      if (t.status === 'resolved') periodMap[period].resolved += 1;
    });
    return Object.entries(periodMap)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [tickets, trendView]);

  const barData = categoryStats.map(c => ({ name: c.category, 数量: c.count }));

  if (tickets.length === 0) {
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
      {/* Pie Chart - 故障分类占比 */}
      <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h3 className="text-[16px] font-semibold text-[#1d1d1f] mb-4">故障分类占比</h3>
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="w-full lg:w-1/2" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryStats.filter(c => c.count > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="category"
                >
                  {categoryStats.filter(c => c.count > 0).map((_, i) => (
                    <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categoryStats.filter(c => c.count > 0).map((cat, i) => (
              <div key={cat.category} className="flex items-center gap-2 text-[13px]">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-[#1d1d1f] font-medium truncate">{cat.category}</span>
                <span className="text-[#86868b] ml-auto flex-shrink-0">{cat.count} ({cat.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar Chart - 各分类数量 */}
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

      {/* Line Chart - 时间趋势 */}
      <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f]">时间趋势</h3>
          <div className="flex gap-1 bg-[#f5f5f7] rounded-full p-0.5">
            <button
              onClick={() => setTrendView('month')}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                trendView === 'month' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#86868b]'
              }`}
            >
              按月
            </button>
            <button
              onClick={() => setTrendView('week')}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                trendView === 'week' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#86868b]'
              }`}
            >
              按周
            </button>
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

      {/* Detail Table */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent overflow-hidden">
        <h3 className="px-5 py-4 text-[16px] font-semibold text-[#1d1d1f] border-b border-[#f5f5f7]">
          分类明细
        </h3>
        <div className="hidden sm:flex px-5 py-3 text-[12px] font-semibold text-[#86868b] border-b border-[#f5f5f7] gap-2">
          <span className="flex-[2] min-w-0">故障分类</span>
          <span className="flex-1 min-w-0 text-center">数量</span>
          <span className="flex-1 min-w-0 text-center">占比</span>
          <span className="flex-1 min-w-0 text-center">待处理</span>
          <span className="flex-1 min-w-0 text-center">处理中</span>
          <span className="flex-1 min-w-0 text-center">已解决</span>
        </div>
        {categoryStats.map((cat, i) => (
          <div
            key={cat.category}
            className={`flex flex-col sm:flex-row sm:items-center px-5 py-3 gap-1 sm:gap-2 hover:bg-[#f5f5f7] transition-colors text-[14px] ${i < categoryStats.length - 1 ? 'border-b border-[#f5f5f7]' : ''}`}
          >
            <span className="font-medium text-[#1d1d1f] sm:flex-[2] sm:min-w-0 truncate">{cat.category}</span>
            <div className="flex sm:hidden gap-3 text-[12px] text-[#86868b]">
              <span>数量 {cat.count}</span>
              <span>占比 {cat.percentage}%</span>
              <span>待处理 {cat.pending}</span>
              <span>处理中 {cat.processing}</span>
              <span>已解决 {cat.resolved}</span>
            </div>
            <span className="hidden sm:block flex-1 min-w-0 text-center text-[#1d1d1f] font-medium">{cat.count}</span>
            <span className="hidden sm:block flex-1 min-w-0 text-center text-[#86868b]">{cat.percentage}%</span>
            <span className="hidden sm:block flex-1 min-w-0 text-center">
              <span className="text-[#ff9500] font-medium">{cat.pending}</span>
            </span>
            <span className="hidden sm:block flex-1 min-w-0 text-center">
              <span className="text-[#af52de] font-medium">{cat.processing}</span>
            </span>
            <span className="hidden sm:block flex-1 min-w-0 text-center">
              <span className="text-[#34c759] font-medium">{cat.resolved}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行 TypeScript 编译检查**

```powershell
npx tsc --noEmit
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add app/src/components/TicketStats.tsx
git commit -m "feat: add TicketStats component with charts and detail table"
```

---

### Task 4: 创建 AdminStatsPage 容器页面

**Files:**
- Create: `app/src/pages/AdminStatsPage.tsx`

- [ ] **Step 1: 创建页面文件**

```tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { FilterBar } from '@/components/FilterBar';
import { StudentRanking } from '@/components/StudentRanking';
import { TicketStats } from '@/components/TicketStats';
import type { Ticket, User, Category, TicketStatus } from '@/types';

interface AdminStatsPageProps {
  tickets: Ticket[];
  users: User[];
  categories: Category[];
}

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

export function AdminStatsPage({ tickets, users, categories }: AdminStatsPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ranking' | 'stats'>('ranking');
  const [filterStart, setFilterStart] = useState(defaultDateRange().start);
  const [filterEnd, setFilterEnd] = useState(defaultDateRange().end);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('');
  const [appliedStart, setAppliedStart] = useState(defaultDateRange().start);
  const [appliedEnd, setAppliedEnd] = useState(defaultDateRange().end);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (appliedStart && t.created_at < appliedStart) return false;
      if (appliedEnd) {
        const endCompare = appliedEnd + 'T23:59:59';
        if (t.created_at > endCompare) return false;
      }
      return true;
    });
  }, [tickets, appliedStart, appliedEnd]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin')}
          className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#e5e5ea] transition-colors cursor-pointer flex-shrink-0"
        >
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
        onApply={() => { setAppliedStart(filterStart); setAppliedEnd(filterEnd); }}
      />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#f5f5f7] rounded-full p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all cursor-pointer ${
            activeTab === 'ranking'
              ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
              : 'text-[#86868b]'
          }`}
        >
          处理人排名
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
              : 'text-[#86868b]'
          }`}
        >
          工单统计
        </button>
      </div>

      {activeTab === 'ranking' ? (
        <StudentRanking tickets={filteredTickets} users={users} />
      ) : (
        <TicketStats tickets={filteredTickets} categories={categories} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 运行 TypeScript 编译检查**

```powershell
npx tsc --noEmit
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/AdminStatsPage.tsx
git commit -m "feat: add AdminStatsPage container with date filter and tab switching"
```

---

### Task 5: 修改 Header 下拉菜单

**Files:**
- Modify: `app/src/components/Header.tsx:68-74`

- [ ] **Step 1: 在 Header.tsx 中插入「数据统计」菜单项**

在「分类管理」按钮（第 69-74 行）和「退出登录」分隔线（第 75 行）之间插入：

```tsx
<button
  onClick={() => { setMenuOpen(false); navigate('/admin/stats'); }}
  className="w-full text-left px-4 py-3 text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer flex items-center gap-2"
>
  数据统计
</button>
```

使用 Edit 工具，在 `app/src/components/Header.tsx` 中匹配：

```
                    分类管理
                  </button>
                  <div className="border-t border-[#f5f5f7]">
```

替换为：

```
                    分类管理
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/admin/stats'); }}
                    className="w-full text-left px-4 py-3 text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    数据统计
                  </button>
                  <div className="border-t border-[#f5f5f7]">
```

- [ ] **Step 2: 运行 TypeScript 编译检查**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/Header.tsx
git commit -m "feat: add '数据统计' menu item to admin header dropdown"
```

---

### Task 6: 修改 App.tsx 路由

**Files:**
- Modify: `app/src/App.tsx:19-21` (lazy import)
- Modify: `app/src/App.tsx:98-99` (route between `/admin/categories` and `/*`)

- [ ] **Step 1: 新增 lazy import**

在 `App.tsx` 第 21 行之后新增：

```tsx
const AdminStatsPage = lazy(() => import('@/pages/AdminStatsPage').then(m => ({ default: m.AdminStatsPage })));
```

使用 Edit 工具，在 `app/src/App.tsx` 中匹配：

```
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
```

替换为：

```
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminStatsPage = lazy(() => import('@/pages/AdminStatsPage').then(m => ({ default: m.AdminStatsPage })));
```

- [ ] **Step 2: 新增 /admin/stats 路由**

在第 98 行 `/>`（`/admin/categories` 路由结束）和第 99 行 `{/* 默认路由 */}` 之间插入新路由。使用 Edit 工具，在 `app/src/App.tsx` 中匹配：

```
        />
        <Route
          path="/*"
```

替换为：

```
        />
        <Route
          path="/admin/stats"
          element={
            <Suspense fallback={<PageLoading />}>
              <Header
                currentRole="admin"
                currentUser={{ name: currentUser.name, role: 'admin', avatar: currentUser.avatar }}
                onLogout={handleLogout}
              />
              <AdminStatsPage
                tickets={store.tickets}
                users={store.userList}
                categories={store.categories}
              />
            </Suspense>
          }
        />
        <Route
          path="/*"
```

- [ ] **Step 3: 运行 TypeScript 编译检查**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat: add /admin/stats route with lazy loading"
```

---

### Task 7: 最终验证

**Files:** None (verification only)

- [ ] **Step 1: 运行 TypeScript 编译 + ESLint**

```powershell
npx tsc --noEmit; npx eslint app/src/
```

Expected: 无新增类型错误或 lint 错误。

- [ ] **Step 2: 运行 Vite 构建检查**

```powershell
cd app; npm run build
```

Expected: 构建成功，无错误。

- [ ] **Step 3: 启动开发服务器手动验证**

```powershell
cd app; npm run dev
```

验证清单：
1. 登录管理员账号
2. 点击 Header 头像 → 下拉菜单出现「数据统计」选项
3. 点击「数据统计」→ 跳转至 `/admin/stats`
4. 默认展示「处理人排名」Tab，Top 3 有奖牌样式，其余有序号
5. 点击列头「完成率」→ 排名切换排序，当前排序列变蓝
6. 切换到「工单统计」Tab → 饼图、柱状图、折线图正常渲染
7. 修改日期范围点击「筛选」→ 两个 Tab 数据同步更新
8. 点击「按月/按周」切换 → 折线图趋势粒度切换
9. 分类明细表格数据正确
10. 点击返回箭头 → 回到管理员仪表盘
11. 在无数据的角色下查看 → 空状态提示正常
