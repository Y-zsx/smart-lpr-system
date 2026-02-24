# 权限系统（RBAC）

## 模型

- 用户（iam_users）、角色（iam_roles）、权限项（iam_permissions）
- 角色-权限（iam_role_permissions）、用户-角色（iam_user_roles）、角色数据范围（iam_role_data_scopes）
- 数据范围类型：all（全量）、camera（按摄像头 ID）、region（按区域编码）

## 默认账号（可 .env 覆盖）

- 管理员：admin / admin123
- 值班员：operator / operator123
- 只读：viewer / viewer123

环境变量：ADMIN_USERNAME/PASSWORD、OPERATOR_*、VIEWER_*。

## 接口

- 登录：POST /api/auth/login
- 当前用户：GET /api/auth/me（含 user、roles、permissions、dataScope）
- IAM：GET/PUT /api/iam/users、/api/iam/roles、/api/iam/permissions；PUT users/:userId/roles、roles/:roleKey/permissions、roles/:roleKey/data-scope

## 前端

- 顶部显示登录状态与角色；菜单按权限显示（如仅管理员见「权限管理」）；摄像头/黑名单/告警等按权限控制。

## 验收步骤

1. admin 登录：可见权限管理、可操作摄像头/黑名单/告警。
2. viewer 登录：仅可查看，无权限管理/黑名单/摄像头入口；写接口返回 403。
3. 在权限管理页改用户角色后重新登录，权限即时生效。
