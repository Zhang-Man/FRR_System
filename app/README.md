# 网络故障报修系统（前端）

基于 React 19 + TypeScript + Vite 7 + Tailwind CSS 3 的单页应用。

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 角色说明

| 角色 | 功能 |
|------|------|
| 提交人 (submitter) | 提交报修工单 → 查看自己的工单进度 |
| 处理人 (handler) | 浏览待处理工单 → 认领 → 填写处理方案（可选协作者） → 完成 |
| 管理员 (admin) | 统计看板、日期/状态筛选、CSV导出、分类管理、用户管理 |

## 模式切换

修改 `src/config.ts`：

```ts
export const USE_MOCK = true;   // Mock 模式：内置数据，无需后端
export const USE_MOCK = false;  // 生产模式：连接后端 API
```

Mock 模式下可用测试账号：`T001`（李明/提交人）、`S001`（王芳/处理人）、`FrrSystemAdmin`（管理员）。

## 项目结构

```
app/
├── index.html              # HTML 入口（含标题配置）
├── public/
│   └── images/             # logo.jpg、avatar*.jpg
├── src/
│   ├── api/index.ts        # 统一 API 客户端（超时/错误处理）
│   ├── components/
│   │   ├── Header.tsx      # 顶部导航栏 + 管理员菜单
│   │   ├── StatsGrid.tsx   # 统计看板（总数/待处理/处理中/已解决/今日新增）
│   │   ├── FilterBar.tsx   # 日期 + 状态筛选栏
│   │   ├── SearchBar.tsx   # 工单搜索
│   │   ├── RepairForm.tsx  # 报修表单（提交人）
│   │   ├── TicketCard.tsx  # 工单卡片
│   │   ├── TicketModal.tsx # 工单详情弹窗
│   │   ├── SolutionModal.tsx # 处理方案弹窗
│   │   ├── Toast.tsx       # 消息提示
│   │   ├── Pagination.tsx  # 分页组件
│   │   ├── RoleBadge.tsx   # 角色标签
│   │   └── ui/             # shadcn UI 组件库（53个组件）
│   ├── hooks/
│   │   ├── useStore.ts     # 核心状态管理（工单/用户/分类/登录持久化）
│   │   └── use-mobile.ts   # 移动端检测
│   ├── pages/
│   │   ├── LoginPage.tsx   # 登录页
│   │   ├── AdminUsersPage.tsx      # 用户管理
│   │   └── AdminCategoriesPage.tsx # 分类管理
│   ├── data/mockData.ts    # Mock 数据
│   ├── i18n/zh.ts          # 中文文案
│   ├── types/index.ts      # TypeScript 类型定义
│   ├── lib/utils.ts        # cn() 工具函数
│   ├── config.ts           # USE_MOCK 开关
│   ├── App.tsx             # 主布局 + 路由
│   └── main.tsx            # 入口
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

## 自定义配置

### 网站名称

| 位置 | 文件 | 行 |
|------|------|----|
| 浏览器标题栏 | `index.html` | `<title>` |
| 登录页大标题 | `src/i18n/zh.ts` | `appTitle` |
| 页面内导航栏 | `src/components/Header.tsx:41` | span 文本 |

### 图标

- **Favicon**：在 `public/` 添加 `favicon.ico`，并在 `index.html` 的 `<head>` 中 `<link rel="icon">`
- **Logo**：替换 `public/images/logo.jpg`

## 部署

### 前端部署

```bash
# 1. 构建
npm run build

# 2. 将 dist/ 目录部署到任意静态服务器
```

**方式一：Nginx**

```nginx
server {
    listen 80;
    server_name _;

    root /opt/frr-system/app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**方式二：Windows IIS**

1. 安装 IIS + URL Rewrite 模块
2. 创建站点，物理路径指向 `dist/`
3. 添加 `web.config`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{URL}" pattern="^/api/" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <httpProtocol>
      <customHeaders>
        <add name="Cache-Control" value="no-cache, no-store, must-revalidate" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

4. 配置反向代理 `/api` → `http://127.0.0.1:5000`（需安装 ARR 模块）

**方式三：直接运行（仅开发/演示）**

```bash
npm install -g serve
serve -s dist -l 80
```

> 注意：直接运行时无 `/api` 反向代理，需配合 `vite.config.ts` 中的 proxy 或 CORS 配置。

### 后端部署

```bash
# 开发模式
cd backend
pip install -r requirements.txt
python app.py          # → http://localhost:5000

# 生产模式（Linux）
gunicorn -w 4 -b 0.0.0.0:5000 app:create_app()

# 生产模式（Windows - 使用 waitress）
pip install waitress
waitress-serve --port=5000 app:create_app
```

### 数据库说明

后端使用 SQLite（`backend/data.db`），无外部依赖，开箱即用。数据库文件随项目部署即可。

### 初始管理员

工号 `FrrSystemAdmin`，登录页直接输入即可进入管理员端。

## 首次使用

1. 以管理员身份登录（`FrrSystemAdmin`）
2. 点击顶栏名字 → 下拉菜单 →「用户管理」→ 逐行添加提交人和处理人
3. 点击顶栏名字 → 下拉菜单 →「分类管理」→ 添加故障类型（如：网络不通、网速慢等）
4. 导入后，提交人/处理人输入工号/工号即可登录
