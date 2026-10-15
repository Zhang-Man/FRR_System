# 快速安装指南（Quick Installation）

本项目为前后端分离架构。以下步骤可在 **5 分钟内**于本机跑通完整系统。

## 环境要求

| 依赖 | 版本 | 校验命令 |
|------|------|----------|
| Python | 3.8+ | `python --version` |
| Node.js | 20+（推荐 22.x） | `node -v` |
| npm | 随 Node 附带 | `npm -v` |

## 一、获取代码

```bash
git clone https://github.com/Zhang-Man/FRR_System.git
cd FRR_System
```

> 若下载的是压缩包，解压后进入项目根目录即可。

> 可选：复制根目录 `.env.example` 为 `.env`，设置 `ORG_NAME`（企业/机构名称，用于品牌展示）与 `SECRET_KEY`。

## 二、启动后端

```bash
cd backend
pip install -r requirements.txt
python app.py
```

首次启动时会自动完成：

- 创建 SQLite 数据库文件 `backend/data.db`
- 初始化数据表（users / categories / tickets / ticket_collaborators）
- 写入种子数据：默认管理员、默认分类

后端默认监听 `http://localhost:5000`，健康检查接口为 `http://localhost:5000/health`。

## 三、启动前端

**新开一个终端**，回到项目根目录：

```bash
cd app
npm install
npm run dev
```

前端开发服务器运行在 `http://localhost:3000`，已内置 `/api` 到 `http://localhost:5000` 的代理，无需额外配置 CORS。

## 四、访问系统

浏览器打开 **http://localhost:3000**，使用默认管理员工号登录：

- **管理员工号**：`FrrSystemAdmin`（首次登录后请尽快在「用户管理」中修改为真实人员）

登录后：

1. 进入「用户管理」添加提交人与处理人（或点击「导入」批量粘贴）
2. 进入「分类管理」维护故障类型
3. 提交人/处理人即可用工号/工号登录使用

## 五、生产构建（可选）

```bash
cd app
npm run build        # 产物在 app/dist/
```

将 `dist/` 交给 Nginx / IIS 托管，后端用 gunicorn（Linux）或 waitress（Windows）运行。完整说明见：

- [Deploy.md](./Deploy.md) —— Linux systemd + Nginx 部署
- [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) —— Docker 单容器部署

## 常见问题

**Q：后端启动报 `unable to open database file`？**
A：`.env` 中的 `DB_PATH` 路径不正确。使用默认值即可；如自定义，确保路径存在且可写。

**Q：前端页面空白 / 接口 404？**
A：确认后端已在 `5000` 端口运行，且前端通过代理访问（开发模式下勿手动改 `vite.config.ts` 的 proxy）。

**Q：如何切换为无后端 Mock 模式？**
A：修改 `app/src/config.ts` 中 `USE_MOCK = true`（仅供前端演示，功能受限）。

**Q：如何重置数据库？**
A：停止后端，删除 `backend/data.db`，重新 `python app.py` 即可重建并写入种子数据。