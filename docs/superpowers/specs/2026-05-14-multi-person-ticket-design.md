> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# 工单多人协作功能设计

## 背景

网络维修场景中常有多人同时处理同一工单的情况，需要系统记录每个参与者的工作量用于考核统计。协作机制由线下自行协商，系统仅做记录和展示。

## 需求决策

| 决策点 | 选择 |
|--------|------|
| 协作者录入时机 | 完成时补录 |
| 完成权限 | 仅认领人可完成并录入协作者 |
| 处理中显示 | 仅显示认领人（与现状一致） |
| 完成后显示 | 显示认领人 + 所有协作者 |
| 工作量统计 | 认领人和每个协作者各计 1 个完整工单（不按人数均分） |
| 认领人自身 | 自动计入参与者，无需手动勾选 |
| 协作机制 | 线下协商，系统无邀请/审批/加入流程；每工单最多 2 名协作者 |
| 处理人列表可见性 | 处理人可看到自己认领的工单 + 作为协作者参与的所有工单 |
| 协作工单数 | 整数，每人每工单 +1（不按人数均分） |
| 排行榜显示 | 排名、处理人、认领数、协作数、总参与、平均耗时（6列），完成率不在排行榜展示 |
| 协作者查询策略 | 后端批量 JOIN，避免 N+1 |
| 处理人列表接口 | 新增 `GET /api/students`，登录处理人可调用 |

---

## 数据库设计

### 新增关联表

```sql
CREATE TABLE IF NOT EXISTS ticket_collaborators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);
```

**tickets 表不变**。`assignee_id` / `assignee_name` 仍为认领人（主处理人），`ticket_collaborators` 记录额外协作者。

### 向下兼容

已有 resolved 工单无协作者记录，查询时返回空数组 `[]`，前端正常展示为仅认领人。

### 示例

一个工单由 S001（认领人）、S002、S003 协作：

```
tickets:          id=1, assignee_id='S001', status='resolved'
ticket_collaborators: (ticket_id=1, user_id='S002', user_name='张三')
                      (ticket_id=1, user_id='S003', user_name='李四')
```

参与者总人数 = 1（认领人）+ 2（协作者）= 3 人。S001 的 `resolved_count` +1，S002 和 S003 的 `collaboration_count` 各 +1。

---

## 后端 API 变更

### 0. `GET /api/students` — 新增接口

返回所有处理人列表，供协作者多选使用。

```
GET /api/students
Response: [{ "user_id": "S001", "user_name": "运维小组" }, ...]
```

- 权限：登录即可（处理人角色可调用）
- 返回字段：`user_id`、`user_name`
- 按 `user_id` 排序

### 1. `PUT /api/tickets/<id>/complete` — 扩展参数

**Request（新增字段）：**

```json
{
  "solution": "重新配置IP地址和DNS服务器",
  "collaborator_ids": ["S002", "S003"]
}
```

**处理逻辑：**

1. 校验当前用户是该工单的 `assignee_id`
2. 校验工单状态为 `processing`
3. 更新 ticket：`status='resolved'`, `solution`, `completed_at`, `updated_at`
4. 对 `collaborator_ids` 去重、排除认领人自身、排除不存在的 user_id，写入 `ticket_collaborators`
5. 返回更新后的工单详情（含 collaborators 列表）

**错误处理：**
- `collaborator_ids` 可选，不传则仅认领人参与
- 传入超过 2 个 user_id → 400 错误
- 传入不存在的 user_id → 忽略并记录警告日志
- 重复完成（status 已非 processing）→ 400
- 非认领人尝试完成 → 403

### 2. `GET /api/tickets` — 返回数据增加协作者 + 处理人可见协作者工单

**数据格式：**

```json
{
  "id": 1,
  "assignee_id": "S001",
  "assignee_name": "运维小组",
  "collaborators": [
    { "user_id": "S002", "user_name": "张三" },
    { "user_id": "S003", "user_name": "李四" }
  ],
  "status": "resolved",
  ...
}
```

**查询策略：**

- 主查询不变（teacher/student/admin 各自的查询逻辑）
- 批量获取协作者：`SELECT tc.* FROM ticket_collaborators tc WHERE tc.ticket_id IN (...)`，在 Python 中按 ticket_id 分组挂载到对应工单上，避免 N+1
- 仅 `resolved` 状态的工单有协作者数据；`pending` 和 `processing` 返回空数组 `[]`

**处理人查询扩展：**

当前处理人查询为 `pending`（所有待接单）+ `claimed`（`WHERE assignee_id = ?`）。扩展为三部分 UNION：

```python
pending  = SELECT * FROM tickets WHERE status = 'pending'
claimed  = SELECT * FROM tickets WHERE assignee_id = ?
collab   = SELECT t.* FROM tickets t
           INNER JOIN ticket_collaborators tc ON tc.ticket_id = t.id
           WHERE tc.user_id = ? AND tc.user_id != t.assignee_id AND t.status = 'resolved'
rows = pending + claimed + collab  # 互不重叠，无需额外去重
```

### 3. `GET /api/stats/rankings` — 统计字段重新设计

| 字段 | 含义 | 计算方式 |
|------|------|----------|
| `claimed_count` | 认领工单数 | `COUNT(tickets WHERE assignee_id = user AND status IN ('processing','resolved'))` |
| `resolved_count` | 认领且已解决 | `COUNT(tickets WHERE assignee_id = user AND status = 'resolved')`（整数） |
| `collaboration_count` | 协作工单数 | `COUNT(tickets WHERE 该用户在 ticket_collaborators 中 AND user != ticket.assignee_id AND ticket.status = 'resolved')`（整数） |
| `completion_rate` | 完成率 | `resolved_count / claimed_count`；claimed_count = 0 时返回 null（前端显示 N/A） |
| `avg_process_time` | 平均处理时间 | 不变，仅统计认领工单 |

**SQL 核心逻辑：**

```sql
-- 协作工单数（每人各计 1，无权重）
SELECT tc.user_id,
       COUNT(*) AS collaboration_count
FROM ticket_collaborators tc
JOIN tickets t ON t.id = tc.ticket_id AND t.status = 'resolved'
WHERE tc.user_id != t.assignee_id
GROUP BY tc.user_id
```

**日期筛选：** 前端 FilterBar 传入 `start_date` / `end_date` 时，`claimed_count` 和 `resolved_count` 按 `t.created_at` 过滤；`collaboration_count` 按 `t.completed_at` 过滤（协作在完成时产生）。

### 4. `GET /api/tickets/export` — CSV 增加协作者列

CSV 在 `assignee_name` 列后增加一列 `collaborators`：

```
id,reporter_name,...,assignee_name,collaborators,solution,...
1,张同事,...,运维小组,"张三、李四","重新配置...",
2,张同事,...,王芳,"","更换网线...",
```

### 5. `DELETE /api/users/<id>` — 清理协作者记录

删除用户时，除现有逻辑（将认领工单转给 S001）外，增加：

```sql
DELETE FROM ticket_collaborators WHERE user_id = ?
```

---

## 前端变更

### 类型定义（`types/index.ts`）

```typescript
interface Collaborator {
  user_id: string;
  user_name: string;
}

interface Ticket {
  // ...现有字段...
  collaborators?: Collaborator[];
}

// RankingData 新增字段
interface RankingData {
  // ...现有字段...
  collaboration_count: number;
}

// RankingSortKey 新增排序键
export type RankingSortKey = 'claimed_count' | 'resolved_count' | 'collaboration_count' | 'avg_process_time';
```

### 新增 API（`api/index.ts`）

```typescript
getStudents: () => api.get<{ user_id: string; user_name: string }[]>('/students')
```

### SolutionModal（完成弹窗）

| 区域 | 内容 |
|------|------|
| 处理方案输入框 **上方** | 新增"协作者"多选下拉 |
| 数据源 | `GET /api/students` 返回的处理人列表，排除认领人自己 |
| 交互 | 搜索 + 多选，最多选 2 人，选满后禁用其余选项 |
| 默认 | 空（不选任何协作者 = 仅认领人参与） |
| 占位提示 | "可选最多 2 人，选择一同处理的同事" |

### TicketCard（工单卡片）

- `pending`：不变
- `processing`：不变，仅显示认领人
- `resolved`：处理人显示 **"认领人"**（无协作者）或 **"认领人 + 协作者1、协作者2"**（有协作者）

### TicketModal（工单详情）

- `resolved` 工单：详情字段中增加"协作者"行，列出所有协作者姓名
- `pending` / `processing`：不显示协作者区域

### StudentRanking（排行榜）

新增第 4 列 **"协作数"**，第 5 列 **"总参与"** 替代原"已解决"列。移除"完成率"列。

最终 6 列：**排名 | 处理人 | 认领数 | 协作数 | 总参与 | 平均耗时**

| 排名 | 处理人 | 认领数 | 协作数 | 总参与 | 平均耗时 |
|------|------|--------|--------|--------|----------|
| 1 | 张三 | 15 | 3 | 17 | 3.2h |

- `总参与 = resolved_count + collaboration_count`
- `resolved_count` 和 `completion_rate` 后端仍计算，前端排行榜不展示
- `collaboration_count` 为整数
- 支持按认领数、协作数、总参与、平均耗时排序

### 状态管理（`useStore.ts`）

- `completeTicket(ticketId, solution, collaboratorIds: string[])` — 扩展参数
- `fetchTickets()` — 适配返回的 `collaborators` 字段
- Mock 模式同步支持

### 测试脚本（`scripts/generate_test_tickets.py`）

为 `resolved` 状态的工单随机生成 0~2 个协作者（从处理人列表中选取，排除认领人），写入 `ticket_collaborators` 表。

---

## 涉及文件清单

| 层 | 文件 | 变更 |
|----|------|------|
| 数据库 | `backend/models.py` | 新增 `ticket_collaborators` 建表 |
| 后端 | `backend/routes/tickets.py` | `complete` 扩展参数；`GET` 附带 collaborators + 处理人列表含协作者工单；`export` 增加列 |
| 后端 | `backend/routes/stats.py` | `rankings` 增加 `collaboration_count` 字段 |
| 后端 | `backend/routes/users.py` | `GET /api/students` 新接口；删除用户时清理协作者记录 |
| 前端 | `app/src/types/index.ts` | 新增 `Collaborator` 类型；`Ticket` 增加 `collaborators`；`RankingData` 增加 `collaboration_count` |
| 前端 | `app/src/api/index.ts` | 新增 `getStudents()` |
| 前端 | `app/src/hooks/useStore.ts` | `completeTicket` 增加参数；`fetchTickets` 适配 |
| 前端 | `app/src/components/SolutionModal.tsx` | 处理方案上方增加协作者多选 |
| 前端 | `app/src/components/TicketCard.tsx` | `resolved` 工单显示多人 |
| 前端 | `app/src/components/TicketModal.tsx` | `resolved` 工单显示协作者 |
| 前端 | `app/src/components/StudentRanking.tsx` | 新增协作贡献列 |
| 前端 | `app/src/data/mockData.ts` | Mock 数据适配 |
| 脚本 | `scripts/generate_test_tickets.py` | resolved 工单随机生成协作者 |

---

## 部署顺序

```
1. backend/models.py    → CREATE TABLE ticket_collaborators
2. backend/routes/      → stats (+collaboration_count), tickets (complete+collab+export), users (students+cleanup)
3. 验证后端 API          → curl 确认新字段返回
4. app/src/types/        → 类型更新（Collaborator, optional协作字段）
5. app/src/components/   → SolutionModal, TicketCard, TicketModal, StudentRanking
6. app/src/hooks/        → useStore resolveTicket + mock
7. npm run build         → 前端构建部署
```

新增字段均使用 optional（`?`），确保后端先部署时前端不报错。

---

## 不做的事情

- 不在认领时选择多人
- 不增加"邀请""审批""加入处理"等协作工作流
- 处理中工单 UI 不变
- 不修改认领接口 `/tickets/<id>/claim`
- 不支持工单完成后编辑协作者（不可逆操作）
