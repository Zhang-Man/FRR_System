# 更新日志

## [Unreleased]

### Added
- 开源化配套文档：CONTRIBUTING.md（贡献指南）、SECURITY.md（安全策略与生产部署检查清单）、QUICK_INSTALLATION.md、HANDOFF.md、DESIGN.md
- MIT LICENSE、Docker 一键部署（Dockerfile / nginx.conf / supervisord.conf）、.env.example
- 角色企业化重命名：teacher/student → submitter/handler，/api/students → /api/handlers，全部 UI 文案、测试、文档同步更新
- 管理员账号与机构名称可通过 ADMIN_USER_ID / ORG_NAME 环境变量配置

## [v3.1] - 2026-06-02

### Added
- 工单多人协作：认领人完成时可选择最多 2 名协作者，协作数据展示在工单卡片/详情中
- `ticket_collaborators` 关联表，记录每个工单的额外参与者
- `GET /api/handlers` — 处理人列表接口，供协作者选择使用
- 数据统计排行榜新增"协作数"和"总参与"列（6 列），支持排序
- `PUT /api/tickets/:id/complete` 扩展 `collaborator_ids` 参数
- `GET /api/tickets` 返回 `collaborators` 字段，处理人可见自己协作的工单
- CSV 导出增加"协作者"列
- 测试数据生成器支持协作者随机分配

### Changed
- `GET /api/stats/rankings` 新增 `collaboration_count` 字段（整数，每人每工单 +1）
- 排行榜精简为 6 列：排名、处理人、认领数、协作数、总参与、平均耗时
- 数据统计页默认显示全部数据（不再预设 30 天日期筛选）
- Vite `base` 改为 `'/'`（修复生产环境 SPA 路由刷新白屏）

### Fixed
- 统计页 LEFT JOIN 日期过滤排除纯协作者处理人
- 统计页多次刷新后表格失效
- 搜索后分页不重置导致空列表

## [v3.0] - 2026-05-13

### Added
- 统计看板：`/admin/stats` 页面，含处理人排名 + 分类统计图表 + 趋势分析
- 3 个统计 API：`GET /api/stats/rankings`（处理人排名）、`GET /api/stats/categories`（分类统计）、`GET /api/stats/trends`（月度/周度趋势）
- 组件：`HandlerRanking`（多指标可排序排行榜）、`TicketStats`（饼图 + 柱状/折线趋势图 + 明细表）、`StatsGrid`（5 指标卡片）、`FilterBar`（日期范围 + 状态筛选）、`SearchBar`
- TypeScript 类型定义：`Stats`、`RankingData`、`CategoryStatData`、`TrendData`、`RankingSortKey`
- `scripts/generate_test_tickets.py` — 800 条工单测试数据生成器
- stats API 的 pytest 测试用例
- `DOCKER_DEPLOY.md` — Docker 单容器部署指南（Nginx + Gunicorn + supervisord）

### Changed
- 统计计算从纯前端 `useMemo` 迁移至后端 SQL 聚合，前端仅负责展示
- 排名组件去头像、紧凑化 UI
- CSV 导出增加 `reporter_id` 和 `assignee_id` 列，前端工单详情同步展示
- React 最佳实践优化：`Promise.all` 并行请求、单次遍历 O(n) 聚合、`useMemo` 缓存

### Fixed
- `useMemo` 放在条件返回之前，修复 React Hooks 规则违反
- 用户导入接口补充 XSS `sanitize()` 防护

### Tested
- pytest 51 项全通过（含 stats 测试用例）
- 前端 `tsc + vite build` 编译通过
- 800 条测试工单数据加载与统计 API 输出验证

## [v2.2] - 2026-05-12

### Added
- 配置管理：`.env.example` 模板，支持 `SECRET_KEY`、`DB_PATH`、`CORS_ORIGINS`、`LOG_LEVEL` 等环境变量注入
- 日志系统：`logging` 模块，输出到 `backend/logs/app.log`，30 天轮转，INFO 级别
- 请求级日志埋点：登录成功/失败、token 过期/无效、权限拒绝、工单生命周期关键操作
- pytest 测试框架：51 项测试用例全部自动化，Flask test_client 替代 urllib
- `tests/` 目录结构：`conftest.py`（独立临时数据库）+ 5 个测试模块

### Changed
- 后端配置从硬编码迁移至环境变量（`python-dotenv`），生产/开发环境隔离
- CORS origins 从 `*` 通配符改为 `CORS_ORIGINS` 环境变量控制
- `models.py` DB_PATH 改为运行时动态读取，支持测试时切换数据库

### Fixed
- `RepairForm` 故障类型下拉框从硬编码 mock 数据改为动态获取 `/api/categories`
- `complete_ticket` solution 字段补充 `sanitize()` XSS 防护
- `datetime.utcnow()` 弃用警告：改用 `datetime.now(timezone.utc)`

### Removed
- 旧测试文件：`test/blackbox_test.py`、`test/load_test.py`、`record/load_test.py`（已迁移至 pytest）

### Tested
- pytest 51 项全通过：auth(9) + users(9) + categories(8) + tickets(17) + admin(6) + data_load(3)
- 前端 `tsc + vite build` 编译通过
- 后端 `create_app()` 启动正常，日志输出正确

## [v2.1] - 2026-05-11

### Added
- `import_xlsx_users.py` — Excel 用户批量导入工具，支持多 sheet、自动角色映射
- 数据库备份与恢复文档，含 .db / .sql 两种格式和定时备份（保留三年）
- `test_plan.md` 测试用例自动化验证，12/17 项通过

### Changed
- 部署方式统一为手动部署 (gunicorn + nginx)，nginx 参考配置写入 README
- README 完善：补充数据导入章节、备份恢复、项目结构更新

### Removed
- 移除 Docker/Docker Compose 部署方案及相关文件（Dockerfile、docker-compose.yml、.dockerignore）
- 移除 `microservice/` 微服务架构设计文档

### Tested
- `load_test.py` 从 record.xlsx 加载 771 条维修记录，8 项 API 测试全部通过
- 数据统计：1043 用户（7 admin + 1035 teacher + 1 student），1546 工单
- `test_plan.md` 17 项用例中 12 项 API 验证通过，5 项需浏览器手动确认

## [v1.5] - 2026-05-09

### Added
- `import_mysql_users.py` — 独立 CLI 工具，从外部 MySQL 查询用户并导入本地 SQLite

## [v1.4] - 2026-05-09

### Added
- 动态故障类型：`categories` 表 + CRUD API，表单下拉从后端获取
- 故障类型管理页 (`/admin/categories`)，管理员可增删类型
- XSS 防护：`sanitize()` 剥离 HTML 标签 + 长度限制
- 可配置标题/图标：`frontend/src/config.js`
- i18n 国际化：后端 `i18n.py` + 前端 `i18n.js`，中英双语
- CSV 导出 BOM (`utf-8-sig`)，Excel 打开中文正常

### Changed
- 登录页简化为单一输入框，自动识别提交人/处理人/管理员
- 管理员下拉菜单（顶栏名字点击），含人员管理 + 故障类型管理
- 用户导入改为 Vue 表单逐行录入，按 ID 更新（upsert）
- 故障类型改为动态，替代原有英文键值
- 管理员主页拆分：维修记录 + 人员管理 + 故障类型管理

## [v1.3] - 2026-05-08

### Added
- 处理方案（solution）字段，处理人完成时弹窗填写
- 前端分页组件（工单表 + 用户表），每页 20 条
- 人员管理页 (`/admin/users`)，支持逐条删除
- `DELETE /api/users/:id` 接口
- `GET /api/users` 接口

## [v1.2] - 2026-05-08

### Added
- 完整 API 测试套件（20 项全通过）
- 从 Excel 导入 770 条真实数据的功能测试

### Fixed
- 全链路 UTF-8 编码统一
- CSS `@charset "UTF-8"`
- axios `Content-Type: application/json; charset=utf-8`
- SQLite `PRAGMA encoding = 'UTF-8'`
- CSV 导出 BOM

## [v1.1] - 2026-05-08

### Added
- `solution` 字段（处理方案）
- 处理人完成时弹窗填写方案
- 管理员表格 + CSV 导出含方案列

### Changed
- 管理员账号改为 `FrrSystemAdmin`
- 用户导入 upsert 逻辑

## [v1.0] - 2026-05-08

### Added
- Flask 后端：认证、工单 CRUD、CSV 导出、用户导入
- Vue 3 前端：登录、提交人报修、处理人接单/完成、管理员管理
- SQLite 数据库
- JWT 无密码认证
