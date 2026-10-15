# 管理员数据统计功能设计文档

## 1. 功能概述

在管理员界面中新增「数据统计」页面，包含两个子视图：

- **处理人排名统计**：多指标综合排名（接单数、完成数、完成率、平均处理时长），支持列头点击切换排序，Top 3 奖牌卡片样式，**不显示头像**
- **工单统计**：故障分类饼图 + 时间趋势柱状图/折线图 + 分类明细表格，支持日期范围筛选

## 2. 架构决策

**数据计算由前端改为后端聚合**（因大数据量下前端 JS 遍历性能不足）：

- 后端（Flask + SQLite）新增 3 个统计接口，使用 SQL GROUP BY + 聚合函数
- 前端不再从 `tickets`/`users` 数组做 `useMemo` 计算，改为直接调用 API 获取预计算结果
- 前端 Tab 懒加载：进入页面只请求当前 Tab 数据，切换时按需请求，已加载数据缓存

## 3. 页面结构

```
┌──────────────────────────────────────────────────────┐
│  Header（导航栏）                                      │
│  [logo] 网络故障报修系统    [管理员 ▼]           │
│                                   ┌──────────────┐   │
│                                   │ 用户管理       │   │
│                                   │ 分类管理       │   │
│                                   │ 数据统计  ← 新增│   │
│                                   │ 退出登录       │   │
│                                   └──────────────┘   │
├──────────────────────────────────────────────────────┤
│  main                                                │
│  ┌────────────────────────────────────────────────┐  │
│  │  日期范围筛选（复用 FilterBar）                   │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Tab 切换： [处理人排名] [工单统计]            │  │
│  ├────────────────────────────────────────────────┤  │
│  │  当前 Tab 内容区（数据来自后端 API）              │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## 4. 后端 API 设计

### 4.1 处理人排名接口

```
GET /api/stats/rankings?start_date=2026-04-01&end_date=2026-05-13
Authorization: Bearer <token>

Response:
[
  {
    "user_id": "S001",
    "name": "王芳",
    "claimed_count": 12,
    "resolved_count": 10,
    "completion_rate": 83,
    "avg_process_time": 145
  },
  ...
]
```

**SQL 逻辑：**
```sql
SELECT u.user_id, u.name,
  COUNT(CASE WHEN t.status IN ('processing','resolved') THEN 1 END) AS claimed_count,
  COUNT(CASE WHEN t.status = 'resolved' THEN 1 END) AS resolved_count,
  CASE WHEN COUNT(...) > 0
    THEN CAST(COUNT(CASE WHEN t.status='resolved' THEN 1 END)*100.0/COUNT(...) AS INTEGER)
    ELSE 0 END AS completion_rate,
  COALESCE(CAST(AVG(CASE WHEN t.status='resolved'
    THEN (julianday(t.completed_at)-julianday(t.created_at))*1440 END) AS INTEGER), 0) AS avg_process_time
FROM users u
LEFT JOIN tickets t ON t.assignee_id = u.user_id
WHERE u.role = 'handler' AND t.created_at BETWEEN ? AND ?
GROUP BY u.user_id
ORDER BY resolved_count DESC;
```

### 4.2 故障分类统计接口

```
GET /api/stats/categories?start_date=2026-04-01&end_date=2026-05-13
Authorization: Bearer <token>

Response:
[
  {
    "category": "网络不通",
    "count": 45,
    "percentage": 38,
    "pending": 5,
    "processing": 12,
    "resolved": 28
  },
  ...
]
```

**SQL 逻辑：**
```sql
SELECT category,
  COUNT(*) AS count,
  COUNT(CASE WHEN status='pending' THEN 1 END) AS pending,
  COUNT(CASE WHEN status='processing' THEN 1 END) AS processing,
  COUNT(CASE WHEN status='resolved' THEN 1 END) AS resolved
FROM tickets
WHERE created_at BETWEEN ? AND ?
GROUP BY category
ORDER BY count DESC;
```

percentage 在后端用 `Math.round(count / totalCount * 100)` 计算。

### 4.3 工单趋势接口

```
GET /api/stats/trends?start_date=2026-04-01&end_date=2026-05-13&view=month
Authorization: Bearer <token>

Response:
[
  { "period": "2026-04", "total": 35, "resolved": 28 },
  { "period": "2026-05", "total": 22, "resolved": 15 }
]
```

**SQL 逻辑（按月）：**
```sql
SELECT substr(created_at, 1, 7) AS period,
  COUNT(*) AS total,
  COUNT(CASE WHEN status='resolved' THEN 1 END) AS resolved
FROM tickets
WHERE created_at BETWEEN ? AND ?
GROUP BY period
ORDER BY period;
```

按周：后端用 Python datetime 计算 ISO 周，或在 SQLite 中用 `strftime('%W', created_at)`。

### 4.4 权限

三个接口均为 `@login_required` + `@require_role('admin')`。

## 5. 前端数据结构

```ts
// API 返回类型
export interface RankingResponse {
  user_id: string;
  name: string;
  claimed_count: number;
  resolved_count: number;
  completion_rate: number;
  avg_process_time: number;  // 分钟
}

export interface CategoryStatResponse {
  category: string;
  count: number;
  percentage: number;
  pending: number;
  processing: number;
  resolved: number;
}

export interface TrendResponse {
  period: string;
  total: number;
  resolved: number;
}
```

前端不再需要 `HandlerRankingItem`、`CategoryStatItem`、`TrendDataPoint` 等类型（保留用于组件内部，但不再用 useMemo 从原始数据聚合）。

## 6. 前端数据流

```
AdminStatsPage
  ├── 日期筛选 state（filterStart, filterEnd, appliedStart, appliedEnd）
  ├── 数据 state（rankings, categoryStats, trendData）
  ├── 加载状态 state（loadingRankings, loadingStats）
  │
  ├── Tab = 'ranking' → 首次: fetchStats('rankings') → setRankings
  │                     已缓存: 直接用 rankings
  │                     render HandlerRanking({ data: rankings })
  │
  └── Tab = 'stats'   → 首次: fetchStats('categories') + fetchStats('trends')
  │                     已缓存: 直接用 categoryStats + trendData
  │                     render TicketStats({ categoryStats, trendData })
  │
  └── 点击「筛选」→ appliedStart/End 更新 → 清空缓存 → 重新请求当前 Tab 数据
```

## 7. 组件接口变更

### HandlerRanking
- **旧**: `{ tickets: Ticket[], users: User[] }`
- **新**: `{ data: RankingResponse[] }`
- 移除头像渲染，紧凑化布局：`[奖牌/序号] [姓名] [接单数] [完成数] [完成率] [平均处理]`

### TicketStats
- **旧**: `{ tickets: Ticket[], categories: Category[] }`
- **新**: `{ categoryStats: CategoryStatResponse[], trendData: TrendResponse[] }`
- 移除内部 useMemo 聚合，直接渲染传入数据
- 保留趋势图按月/按周切换（切换时重新请求 API）

## 8. 新增/修改文件清单

| 文件路径 | 用途 | 类型 |
|----------|------|------|
| `backend/routes/stats.py` | 3 个统计 API 端点 | 新增 |
| `backend/app.py` | 注册 stats blueprint | 修改 |
| `app/src/api/index.ts` | 新增 stats API 调用方法 | 修改 |
| `app/src/components/HandlerRanking.tsx` | 去除头像，改为接收 API 返回数据 | 修改 |
| `app/src/components/TicketStats.tsx` | 改为接收预计算数据，趋势切换重新请求 | 修改 |
| `app/src/pages/AdminStatsPage.tsx` | 管理 API 请求 + 缓存 + 懒加载 | 修改 |
| `app/src/hooks/useStore.ts` | 新增 stats 相关 fetch 方法（可选） | 修改 |
| `app/src/types/index.ts` | 清理不再需要的类型，新增 API 响应类型 | 修改 |

## 9. UI 设计说明（更新）

### 排名卡片（去除头像后紧凑化）

```
┌─────────────────────────────────────────────────┐
│  🥇  第1名    王芳      接单12  完成10  83%  2h30m │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  ④          李四      接单8   完成6   75%  1h15m  │
└─────────────────────────────────────────────────┘
```

- Top 3：奖牌 emoji + 排名文字 + 姓名 + 4 项指标内联显示
- 其余：蓝色圆形序号 + 姓名 + 指标
- 卡片高度从之前的 p-4 缩短为 py-3 px-4
- 桌面端指标与姓名同行（flex），移动端指标换行

### 空状态 + 加载状态

- **加载中**：Tab 内容区显示 spinner（与现有 `PageLoading` 组件一致）
- **无数据**：与原有空状态一致（居中图标 + 文字）
- **请求失败**：Toast 提示错误信息

## 10. 交互流程（更新）

### 页面加载
1. 管理员点击「数据统计」
2. 跳转 `/admin/stats`，懒加载 AdminStatsPage
3. 默认 Tab：「处理人排名」
4. 发起 `GET /api/stats/rankings?start_date=...&end_date=...`
5. 显示 loading → 渲染排名列表

### Tab 切换
1. 点击「工单统计」
2. 检查 `categoryStats` 是否已有缓存
3. 无缓存 → 发起 `GET /api/stats/categories` + `GET /api/stats/trends`
4. 有缓存 → 直接渲染（不重复请求）

### 日期筛选
1. 修改日期 → 点击「筛选」
2. `appliedStart/End` 更新
3. **清空所有缓存**（三个数据 state 置空）
4. 重新请求当前 Tab 的数据

### 趋势图按月/按周切换
1. 点击「按周」
2. 发起 `GET /api/stats/trends?view=week&...`
3. 更新趋势图（不重新请求分类数据）
