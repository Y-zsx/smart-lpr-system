# 权限系统（RBAC）说明

本文档说明智能车牌识别系统的人员权限管理（MVP）实现与验证方式。

## 1. 权限模型

- 用户（`iam_users`）
- 角色（`iam_roles`）
- 权限项（`iam_permissions`）
- 角色-权限关联（`iam_role_permissions`）
- 用户-角色关联（`iam_user_roles`）
- 角色数据范围（`iam_role_data_scopes`）

当前支持的数据范围类型：
- `all`：全量数据
- `camera`：按摄像头 ID
- `region`：按区域编码

## 2. 默认账号（本地演示）

- 管理员：`admin / admin123`
- 值班员：`operator / operator123`
- 只读用户：`viewer / viewer123`

可通过后端 `.env` 覆盖：
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- `OPERATOR_USERNAME` / `OPERATOR_PASSWORD`
- `VIEWER_USERNAME` / `VIEWER_PASSWORD`

## 3. 关键接口

- 登录：`POST /api/auth/login`
- 当前用户快照：`GET /api/auth/me`（返回 user + roles + permissions + dataScope）
- IAM（管理员权限）：
  - `GET /api/iam/users`
  - `GET /api/iam/roles`
  - `GET /api/iam/permissions`
  - `PUT /api/iam/users/:userId/roles`
  - `PUT /api/iam/roles/:roleKey/permissions`
  - `PUT /api/iam/roles/:roleKey/data-scope`

## 4. 前端行为

- 顶部显示登录状态、当前用户和角色
- 菜单按权限显示（例如仅管理员可见“权限管理”）
- 按钮级控制：
  - 非授权用户不可见/不可操作摄像头管理、黑名单管理、告警归档等

## 5. 快速验收步骤

1. 启动后端和前端。
2. 使用 `admin` 登录，确认：
   - 可见“权限管理”页面
   - 可进行摄像头、黑名单、告警管理等操作
3. 使用 `viewer` 登录，确认：
   - 仅可查看数据
   - 不可见“权限管理”、黑名单管理、摄像头管理入口
4. 使用 Postman 或 curl 调用写接口（如删除告警）：
   - `viewer` 应返回 403
5. 在权限管理页修改用户角色后重新登录，确认权限即时生效。

## 6. 毕设展示建议

- 展示同一页面下 admin 和 viewer 的菜单差异
- 展示越权调用返回 403（后端硬拦截）
- 展示数据范围策略（全量/指定摄像头）的差异

