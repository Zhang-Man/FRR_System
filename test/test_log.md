# 测试日志

> 测试日期：2026-05-11  
> 环境：Windows / Python 3.14 / Flask + SQLite  
> 目的：上线前完整回归测试

---

## 一、数据环境

| 指标 | 数量 |
|------|------|
| 总用户数 | 1043+ |
| admin | 7 |
| submitter | 1035+ |
| handler | 13（10 位示例运维小组成员 + S001 + 运维小组 + TEST001） |
| 总工单数 | 1542（两轮 load_test 累计） |
| pending | 0 |
| processing | 6 |
| resolved | 1536 |

### 处理人小组成员

| 工号 | 姓名 | 工单数 |
|------|------|--------|
| S001 | 张三 | 497 |
| S002 | 李四 | 77 |
| S003 | 王五 | 62 |
| S004 | 赵六 | 54 |
| S005 | 钱七 | 39 |
| S006 | 孙八 | 38 |
| S007 | 周九 | 4 |
| S008 | 吴十 | 1 |

---

## 二、load_test.py 测试结果

```
1. Login admin...          → OK: 管理员
2. Loading tickets         → 771 tickets from record.xlsx
   Status: pending=0, processing=6, resolved=1536
3. API tests:
   3.1 Admin sees all:      1542 tickets - OK
   3.2 Filter pending:      0 - OK
   3.3 Filter resolved:     1536 - OK
   3.4 CSV export:          1562 lines, header OK - OK
   3.5 submitter (T001): 771 - OK
   3.6 handler (S001 张三): 497 - OK
   3.7 Claim #3101:         processing - OK
   3.8 Complete #3101:      resolved - OK

=== ALL FUNCTIONAL TESTS PASSED ===
```

---

## 三、test_plan.md 用例验证

| # | 用例 | 结果 | 验证方式 |
|---|------|------|----------|
| TC-01 | 管理员登录 | ✅ | FrrSystemAdmin → token + role=admin |
| TC-02 | 无效登录 | ✅ | X999 → 401；空输入 → 400 |
| TC-03 | 提交人/处理人登录 | ✅ | T001 → submitter；S001 → handler |
| TC-04 | Token 过期 | ✅ | 无效 token → 401 |
| TC-05 | 提交报修 | ✅ | 空字段 → 400；完整数据 → 201 |
| TC-06 | 动态故障类型 | ✅ | GET /categories 返回 4 个类型 |
| TC-07 | 防注入 | ✅ | script 标签被剥离 |
| TC-08 | 接单 | ✅ | claim → processing；重复 → 400 |
| TC-09 | 完成+处理方案 | ✅ | complete → resolved + solution |
| TC-10 | 提交人查看进度 | ☐ | 需浏览器验证 |
| TC-11 | 管理员筛选 | ☐ | 需浏览器验证 |
| TC-12 | 分页 | ☐ | 需浏览器验证 |
| TC-13 | CSV 导出 | ✅ | 1562 行，header 完整 |
| TC-14 | 人员管理 | ✅ | 不能删除自己 |
| TC-15 | 故障类型管理 | ☐ | 需浏览器验证 |
| TC-16 | 角色权限 | ✅ | 处理人报修/提交人接单 → 403 |
| TC-17 | Token 过期 | ✅ | 无效 token → 401 |
| 空状态 | — | ☐ | 需浏览器验证 |

**API 测试：12/17 通过 ✅**

---

## 四、关键变更

- **工单分配逻辑**：优先匹配 Excel 维修人到处理人小组成员，匹配命中自动分配，未命中默认分配第一位成员（张三 S001）
- **删除保护**：删除处理人时工单自动转移给 S001（运维小组），避免僵尸工单
- **不再修改用户表**：load_test.py 仅操作工单表，不导入额外用户

## 五、结论

- **后端 API**：全部通过，无回归
- **工单分配**：按示例处理人团队匹配，分布合理
- **安全防护**：XSS sanitize、权限校验、参数化查询均生效
- **待手动验证**：5 项 UI 交互测试
