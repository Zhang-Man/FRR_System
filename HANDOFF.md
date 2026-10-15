# 项目交接文档（Handoff）

本文档面向**接手本项目的开发者或运维人员**，说明项目现状、关键设计、注意事项与后续工作。

## 一、项目概况

| 项 | 内容 |
|----|------|
| 名称 | 企业网络故障报修接单系统 |
| 用途 | 企业园区内网部署，提交人报修、处理人小组接单处理、管理员管理与统计 |
| 版本 | v3.1（见 [CHANGELOG.md](./CHANGELOG.md)） |
| 架构 | 前后端分离：React SPA + Flask REST API + SQLite |
| 认证 | JWT 无密码登录（仅校验工号/工号是否存在） |

## 二、目录速览

```
├── app/            # React 前端（Vite）
├── backend/        # Flask 后端（入口 app.py）
├── tests/          # pytest 自动化测试
├── docs/           # 设计与规划文档
├── scripts/        # 辅助脚本
├── README.md       # 项目说明
├── CONTRIBUTING.md # 贡献指南
├── SECURITY.md     # 安全策略与漏洞报告
├── LICENSE         # MIT 许可证
├── QUICK_INSTALLATION.md  # 快速安装
├── DESIGN.md       # 设计文档
├── Deploy.md       # Linux 部署
└── DOCKER_DEPLOY.md# Docker 部署
```

## 三、关键设计决策

1. **无密码认证**：企业园区内网场景下，仅校验工号/工号存在性，返回 24 小时有效的 JWT。降低使用门槛，但**不适合公网暴露**。
2. **SQLite 单文件库**：零配置、易备份。单机内网场景够用；高并发或多实例部署需迁移到 MySQL/PostgreSQL。
3. **接单-协作模型**：工单状态 `pending → processing → resolved`；完成时可登记最多 2 名协作者（`ticket_collaborators` 表），用于统计协作数量。
4. **服务端 sanitize**：所有用户输入在入库前剥离 HTML 标签并限制长度，配合 React 默认转义防 XSS。
5. **中英 i18n**：前端 `app/src/i18n/zh.ts`，后端 `backend/i18n.py`，默认中文。

## 四、环境变量（backend/.env）

| 变量 | 说明 | 默认 |
|------|------|------|
| `SECRET_KEY` | JWT 签名密钥 | 开发默认值，**生产必须修改** |
| `DB_PATH` | SQLite 数据库路径 | `backend/data.db` |
| `CORS_ORIGINS` | 允许的跨域来源 | 开发默认 |
| `LOG_LEVEL` | 日志级别 | INFO |
| `LOG_BACKUP_COUNT` | 日志保留份数 | - |
| `FLASK_DEBUG` | 调试模式 | false（生产务必关闭） |
| `ORG_NAME` | 企业/机构名称（品牌展示） | FRR System |
| `ADMIN_USER_ID` | 首次启动 seed 的默认管理员账号 | FrrSystemAdmin |

## 五、接手第一步

1. 阅读 [QUICK_INSTALLATION.md](./QUICK_INSTALLATION.md) 在本机跑通系统。
2. 阅读 [DESIGN.md](./DESIGN.md) 理解数据模型与接口。
3. 运行测试：项目根目录执行 `python -m pytest tests/ -q`（后端 87 项用例）。
4. **修改默认密钥与默认管理员账号**，不要沿用仓库中的默认值。
5. 按 [Deploy.md](./Deploy.md) 或 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) 部署。

## 六、已知事项与后续建议

- **默认账号**：管理员工号 `FrrSystemAdmin`、处理人 `S001` 由 `init_db()` 自动写入，生产环境请替换或删除。
- **无密码认证安全边界**：如需公网部署，务必增加密码/验证码/白名单等机制。
- **密钥管理**：JWT 密钥必须通过环境变量注入，切勿硬编码。
- **数据库迁移**：目前靠 `init_db()` 建表（`CREATE TABLE IF NOT EXISTS`），无版本化迁移工具；表结构变更需手动处理。
- **备份**：见 README「数据库备份与恢复」章节，建议配置定时任务。
- **待优化**：后端以 root 运行、DB 与代码同目录、gunicorn 多用 worker 重复建表等（详见 Deploy.md 的 TODO 清单）。

## 七、联系方式

原开发者已不再维护本项目。如有问题，请通过代码仓库的 Issue 反馈。