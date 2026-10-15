# 系统设计文档（Design）

本文档描述企业网络故障报修系统的整体架构、数据模型、接口与关键流程。

## 一、整体架构

```
┌──────────────────────────────────────────┐
│              浏览器（React SPA）           │
│  ┌────────┐ ┌──────────┐ ┌────────────┐  │
│  │ 提交人端│ │ 处理人端│ │  管理员端   │  │
│  └───┬────┘ └────┬─────┘ └─────┬──────┘  │
│      └───────────┼─────────────┘          │
│            fetch / axios + token          │
└──────────────────┼───────────────────────┘
                   │  /api/*  (JSON)
┌──────────────────┼───────────────────────┐
│           Flask REST API（Backend）        │
│   /api/auth  /api/tickets  /api/users     │
│   /api/categories  /api/stats             │
│                   │                        │
│              SQLite (data.db)              │
└──────────────────────────────────────────┘
```

- **前端**：React 19 + TypeScript + Vite 7，单页应用，所有数据异步加载；开发模式通过 Vite 代理 `/api`。
- **后端**：Flask，RESTful JSON API，blueprint 分模块（auth/tickets/users/categories/stats）。
- **数据库**：SQLite 单文件，零配置。
- **认证**：JWT（HS256），无密码，仅校验工号/工号存在性，token 有效期 24 小时。

## 二、数据模型

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| user_id | TEXT UNIQUE | 工号或工号 |
| name | TEXT | 姓名 |
| role | TEXT | submitter / handler / admin |
| phone | TEXT | 联系电话（可选） |
| department | TEXT | 部门/班级（可选） |

### categories 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| name | TEXT UNIQUE | 故障类型名称 |

默认类型：网络不通、网速慢、设备故障、其他。

### tickets 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| reporter_id | TEXT | 报修人工号 |
| reporter_name | TEXT | 报修人姓名（冗余） |
| contact | TEXT | 联系方式 |
| location | TEXT | 楼栋 + 房间号 |
| category | TEXT | 故障类型 |
| description | TEXT | 故障描述 |
| assignee_id | TEXT | 接单处理人工号（NULL=待接单） |
| assignee_name | TEXT | 接单处理人姓名（冗余） |
| solution | TEXT | 处理方案 |
| status | TEXT | pending / processing / resolved |
| created_at | TEXT | 提交时间 ISO8601 |
| updated_at | TEXT | 最后更新时间 |
| completed_at | TEXT | 完成时间（NULL=未完成） |

### ticket_collaborators 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| ticket_id | INTEGER | 关联工单 |
| user_id | TEXT | 协作者工号 |
| user_name | TEXT | 协作者姓名（冗余） |

> 协作上限：每张工单最多 2 名协作者。

## 三、API 接口

所有接口返回 JSON。需认证接口在 Header 携带 `Authorization: Bearer <token>`。

### 认证

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | /api/auth/login | 否 | body `{user_id}` → `{token, user}` |

### 工单

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | /api/tickets | submitter | 提交报修 |
| GET | /api/tickets | 全部 | 按角色返回不同范围，支持 `?start_date=&end_date=&status=` |
| PUT | /api/tickets/:id/claim | handler | 接单 |
| PUT | /api/tickets/:id/complete | handler | 完成，body `{solution, collaborator_ids?}` |
| GET | /api/tickets/export | admin | CSV 导出（UTF-8 BOM），支持日期筛选 |

`GET /api/tickets` 的角色逻辑：
- **submitter**：返回该提交人自己提交的工单
- **handler**：返回全部 `pending` 工单 + 该处理人自己接单的工单
- **admin**：返回全部工单，支持日期/状态筛选

### 用户

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | /api/users | admin | 用户列表 |
| GET | /api/handlers | handler | 处理人列表（协作者选择用） |
| POST | /api/users/import | admin | 批量添加/更新 |
| DELETE | /api/users/:id | admin | 删除用户（不能删自己） |

### 故障类型

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | /api/categories | 公开 | 类型列表 |
| POST | /api/categories | admin | 添加 |
| DELETE | /api/categories/:id | admin | 删除 |

### 统计

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | /api/stats/rankings | admin | 处理人排名（认领数/已解决/完成率/协作数/平均耗时） |
| GET | /api/stats/categories | admin | 故障类型分布（数量 + 占比） |
| GET | /api/stats/trends | admin | 报修趋势，`?interval=month\|week` |

### 错误码

| 状态码 | 含义 |
|--------|------|
| 400 | 参数错误 |
| 401 | 未登录或凭证无效 |
| 403 | 无权限 |
| 404 | 资源不存在 |

## 四、核心流程

```
提交人提交报修
  → POST /api/tickets {contact, location, category, description}
  → 后端创建工单，status=pending
        ↓
处理人浏览待接单列表 → 点击「接单」
  → PUT /api/tickets/:id/claim
  → 设置 assignee，status=processing
        ↓
处理人完成 → 填写处理方案 + 可选协作者
  → PUT /api/tickets/:id/complete
  → 写入 solution、协作者，status=resolved，completed_at=now
```

## 五、安全设计

- **认证**：JWT HS256，密钥来自环境变量；`login_required` / `require_role` 装饰器做接口级权限控制。
- **输入校验**：所有文本入库前经 `sanitize()` 剥离 HTML 标签并截断长度。
- **SQL 注入**：全部使用参数化查询。
- **XSS**：服务端 sanitize + 前端 React 自动转义双重防护。
- **CORS**：通过 `CORS_ORIGINS` 环境变量限定来源。

## 六、部署形态

- **开发**：前端 `npm run dev`（3000）+ 后端 `python app.py`（5000），Vite 代理。
- **生产（传统的）**：前端 `npm run build` → Nginx/IIS 托管 dist；后端 gunicorn（Linux）/ waitress（Windows）。详见 [Deploy.md](./Deploy.md)。
- **生产（容器化）**：单容器内 nginx + gunicorn 由 supervisord 管理，SQLite 通过 volume 持久化。详见 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)。

## 七、前端结构

- 状态管理：`app/src/hooks/useStore.ts`（含登录持久化）。
- API 客户端：`app/src/api/index.ts`（超时与错误处理）。
- 路由与布局：`app/src/App.tsx`。
- 页面：登录页、用户管理、分类管理、统计看板、提交人端、处理人端。
- 组件：`app/src/components/` 通用组件 + `app/src/components/ui/` shadcn 组件库。
- 文案：`app/src/i18n/zh.ts`。