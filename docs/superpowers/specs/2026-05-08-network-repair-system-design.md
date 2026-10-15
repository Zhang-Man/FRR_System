> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# 企业网络故障报修系统 - 设计文档

## Overview

一个部署在学校内网的网络故障报修接单系统。提交人提交故障报修工单，处理人小组在线接单处理。管理员负责人员数据导入和定期导出故障记录。

参考网站 bz.5138zhuan.com 的队列接单设计模式（提交→排队→接单→标记完成）。

## Architecture

```
┌──────────────────────────────────────────┐
│          前端 Vue 3 SPA (Vite)            │
│  ┌────────┐ ┌────────┐ ┌──────────────┐  │
│  │ 提交人端 │ │处理人端│ │  管理员端     │  │
│  └───┬────┘ └───┬────┘ └──────┬───────┘  │
│      └──────────┼─────────────┘           │
│            axios + sessionStorage         │
└─────────────────┼────────────────────────┘
                  │
┌─────────────────┼────────────────────────┐
│        Flask REST API (Backend)          │
│  /api/auth  /api/tickets  /api/users     │
│                  │                        │
│              SQLite                       │
└──────────────────────────────────────────┘
```

- **前端**: Vue 3 + Vite + Vue Router (SPA, 所有数据 axios 异步加载)
- **后端**: Python Flask, RESTful JSON API, CORS 开启
- **数据库**: SQLite (单文件, 零配置)
- **认证**: 无密码登录, 输入工号/工号, 后端校验是否存在该用户, 返回 JWT token

## Database Schema

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| user_id | TEXT UNIQUE | 工号或工号 |
| name | TEXT | 姓名 |
| role | TEXT | teacher / student / admin |
| phone | TEXT | 联系电话(可选) |
| department | TEXT | 部门/班级(可选) |

### tickets 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| reporter_id | TEXT | 报修人工号 |
| reporter_name | TEXT | 报修人姓名(冗余) |
| contact | TEXT | 联系方式 |
| location | TEXT | 楼栋+房间号 |
| category | TEXT | 故障类型: network_down / slow_speed / device_fault / other |
| description | TEXT | 故障描述 |
| assignee_id | TEXT | 接单处理人工号 (NULL=待接单) |
| assignee_name | TEXT | 接单处理人姓名(冗余) |
| status | TEXT | pending / processing / resolved |
| created_at | TEXT | 提交时间 ISO8601 |
| updated_at | TEXT | 最后更新时间 |
| completed_at | TEXT | 完成时间 (NULL=未完成) |

## API Endpoints

全部返回 JSON。需认证的接口在 Header 带 `Authorization: Bearer <token>`。

### 认证

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | /api/auth/login | 否 | body: {user_id, role} → 返回 {token, user} |

### 工单

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | /api/tickets | 是(teacher) | 提交人提交报修 |
| GET | /api/tickets | 是 | 按角色返回不同列表 |
| PUT | /api/tickets/:id/claim | 是(student) | 处理人接单 |
| PUT | /api/tickets/:id/complete | 是(student) | 标记完成 |

GET /api/tickets 角色逻辑：
- teacher: 返回该提交人自己提交的工单
- student: 返回所有 pending 工单 + 该处理人自己接单的工单
- admin: 返回全部工单，支持 ?start_date=&end_date=&status= 筛选

### 管理

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | /api/tickets/export | 是(admin) | CSV导出, 支持 ?start_date=&end_date= |
| POST | /api/users/import | 是(admin) | 批量导入用户, body: {users: [{user_id, name, role, phone, department}]}, role取值为teacher/student/admin, 导入前清空旧数据 |

CSV 导出列: 工单号, 报修人, 联系方式, 位置, 故障类型, 描述, 接单人, 提交时间, 完成时间, 状态

## Frontend Pages & Components

### 路由

| 路径 | 页面 | 角色 |
|------|------|------|
| /login | LoginPage | 所有 |
| /teacher | TeacherPage | teacher |
| /student | StudentPage | student |
| /admin | AdminPage | admin |

### LoginPage

- 角色选择按钮(提交人/处理人/管理员)
- 工号或工号输入框
- 点击登录 → 调用 /api/auth/login → 存 token 到 sessionStorage → 按角色跳转

### TeacherPage（提交人端）

**报修表单区域:**
- 联系方式输入框
- 楼栋房间号输入框
- 故障类型下拉选择: 网络不通 / 网速慢 / 设备故障 / 其他
- 故障描述文本框
- 提交按钮 → 异步提交 → 刷新列表

**我的工单列表:**
- 卡片列表, 每条显示: 工单号, 位置, 故障类型, 提交时间, 状态标签
- 状态: 待接单(灰) / xxx处理中(蓝) / 已解决(绿)
- 如有接单人则显示"被xxx接单"

### StudentPage（处理人端）

**待接单列表:**
- 显示所有 status=pending 的工单
- 每条显示: 工单号, 报修人, 联系方式, 位置, 故障类型, 描述, 提交时间
- 每条有「接单」按钮 → 点击后状态变为"xxx处理中"

**我的工单列表:**
- 显示该处理人接单的工单
- 每条有「完成」按钮 → 点击后状态变为"已解决"

### AdminPage（管理员端）

**筛选栏:**
- 日期范围选择 (开始日期 ~ 结束日期)
- 状态筛选下拉 (全部 / 待接单 / 处理中 / 已解决)

**全部工单列表:**
- 表格展示所有工单

**操作区:**
- 「导出CSV」按钮 → 依据当前筛选条件导出
- 「导入人员」按钮 → 弹出文本框, 粘贴 JSON 或 CSV 格式数据批量导入用户

## Data Flow

### 报修流程

```
Teacher 提交表单
  → POST /api/tickets {contact, location, category, description}
  → 后端创建工单, status=pending
  → 前端刷新列表, 新工单出现在待接单池
```

### 接单流程

```
Student 点击「接单」
  → PUT /api/tickets/:id/claim
  → 后端设置 assignee=当前处理人, status=processing
  → 前端刷新: 该工单从待接单移到我的工单, 状态变"xxx处理中"
```

### 完成流程

```
Student 点击「完成」
  → PUT /api/tickets/:id/complete
  → 后端设置 status=resolved, completed_at=now
  → 前端刷新: 工单状态变"已解决"
```

## Error Handling

- 后端所有异常返回 `{error: "描述"}` + 对应 HTTP 状态码
- 前端 axios 拦截器统一处理 401(跳转登录页) 和 500(弹出错误提示)
- 表单提交时前端校验必填字段

## UI Design (参考 bz.5138zhuan.com 风格)

### 色彩
- 页面底色: `#f0f8ff` (浅蓝)
- 卡片底色: `#ffffff` (纯白), 16px 圆角, 浅蓝阴影 `rgba(59,130,246,0.08)`, 边框 `#e0f2fe`
- 主色调: `#3b82f6` (科技蓝), 梯度按钮 `linear-gradient(135deg, #3b82f6, #60a5fa)`
- 标题色: `#2563eb`

### 组件风格
- **输入框**: 宽度自适应, 44px高, 16px字号, 2px蓝色边框, focus变深蓝
- **按钮**: 蓝色渐变, 44px高, 8px圆角, 阴影, hover上浮2px, active缩小0.98
- **列表卡片**: 白底, 左边框6px蓝色强调条(待接单)/灰色(已完成), 弹性布局, 行间距12px
- **状态标签**: 待接单(灰), 处理中(蓝), 已解决(绿), 废弃样式同参考站的 used 态
- **字体**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

### 交互
- 全部操作异步 axios 请求, 无页面跳转刷新
- 接单/完成操作后局部刷新列表
- 参考站 SweetAlert2 做操作确认弹窗
- 列表顶部倒计时自动刷新(可选保留)

### 移动端适配
- 600px 断点: 输入区域纵向排列, 按钮全宽

## Deployment


- 内网服务器安装 Python 3.8+
- `pip install flask flask-cors pyjwt`
- `python app.py` 启动后端 (默认 5000 端口)
- 前端 `npm run build` 生成静态文件, 由 Flask 托管或 nginx 反向代理
- 人员数据由管理员通过管理端「导入人员」功能录入
