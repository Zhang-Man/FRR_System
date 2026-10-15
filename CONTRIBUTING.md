# 贡献指南（Contributing）

感谢你对 FRR System 的关注！欢迎以 Issue 或 Pull Request 的形式参与贡献。

## 如何贡献

### 1. 提交 Issue

- **Bug 报告**：请附上复现步骤、期望行为、实际行为、后端日志（`backend/logs/app.log`）与环境信息（OS / Python / Node 版本）。
- **功能建议**：请说明使用场景与预期效果；安全相关建议请先阅读下方的「安全类贡献」。

### 2. 提交 Pull Request

1. Fork 仓库并创建特性分支：`git checkout -b feat/your-feature`。
2. 开发前请先阅读 [DESIGN.md](./DESIGN.md)（数据模型与接口约定）与 [HANDOFF.md](./HANDOFF.md)（关键设计决策）。
3. 保持改动最小化：一个 PR 只解决一件事。
4. 提交前必须通过本地验证（见下）。
5. PR 描述请说明：改了什么、为什么、如何验证。

### 3. 本地验证（提交前必做）

```bash
# 后端测试（87 项用例）
python -m pytest tests/ -q

# 前端类型检查与构建
cd app
npm run build
```

两项均需通过。涉及部署文档的改动请同步核对 [Deploy.md](./Deploy.md) 与 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)。

## 代码规范

- **后端**：Python 3.8+，遵循 PEP 8；所有用户输入必须经过 `models.sanitize()` 处理；新增接口需同步补充 pytest 用例与 [DESIGN.md](./DESIGN.md) 的 API 表。
- **前端**：TypeScript 严格模式，禁用 `any`（确需时注释说明）；新增 UI 文案必须同时更新 `app/src/i18n/zh.ts`（中文为默认语言）。
- **提交信息**：使用 `feat: / fix: / docs: / refactor: / test: / chore:` 前缀。

## 安全类贡献

发现安全漏洞请**不要**公开 Issue，参见 [SECURITY.md](./SECURITY.md) 的私下报告流程。

## 角色与术语

本项目使用中性的企业化术语，贡献代码与文档时请保持一致：

| 角色 | 枚举值 | 说明 |
|------|--------|------|
| 提交人 | `submitter` | 提交报修工单 |
| 处理人 | `handler` | 认领并处理工单 |
| 管理员 | `admin` | 用户/分类/统计管理 |

处理人列表 API 为 `GET /api/handlers`（无 `/api/students`）。

## 许可

提交即表示你同意以 [MIT License](./LICENSE) 授权你的贡献。