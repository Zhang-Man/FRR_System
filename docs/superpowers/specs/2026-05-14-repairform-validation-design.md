> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# RepairForm 表单校验设计

日期：2026-05-14

## 背景

`RepairForm.tsx` 当前使用 `useState` 管理表单状态，提交时对 4 个字段做空值判断，但校验不通过时静默返回，用户无任何提示。

## 目标

- 点击提交时对未填字段显示红色行内错误提示
- 不引入新的依赖（`react-hook-form` + `zod` 已装在项目中）
- 不改变 `RepairForm` 对外接口（props 签名不变）
- 不改动 `App.tsx`、`useStore.ts`、后端任何代码

## 方案

用 `react-hook-form` + `zod` 替代当前 `useState` 手动校验。

### 改动文件

仅 `app/src/components/RepairForm.tsx`

### 校验规则

4 个字段全部必填，未填时显示"请填写此项"：

- `contact`：联系电话
- `location`：所在位置
- `category`：故障类型（select，默认值为空字符串时视为未填）
- `description`：故障描述

不做电话格式校验。

### 数据流不变

```
useState → useForm + zod schema
手动判空 → zodResolver 校验
handleSubmit → handleSubmit(onValid)
静默return → formState.errors 驱动红色行内提示
```

`onSubmit({ contact, location, category, description })` 传给 `store.addTicket` 的数据形状完全不变。

## 非目标

- 电话格式校验（不做）
- 实时/失焦校验（仅提交时校验）
- 后端校验改动
