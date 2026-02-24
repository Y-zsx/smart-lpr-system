# 项目结构说明

## 目标

- 按业务域组织代码，便于查找与协作。
- 新功能有固定落点，降低接入成本。
- 保持启动方式与 API 行为不变。

## 当前结构概览

### Backend（`backend/src/`）

| 目录 | 说明 |
|------|------|
| **modules/** | 按业务域划分的模块，**新功能优先放这里** |
| **routes/** | API 路由，从 `modules` 引用控制器 |
| **middlewares/** | 通用中间件（如错误处理） |
| **config/** | 数据库等配置 |
| **types/** | 全局类型（含 Express 扩展） |
| **utils/** | 共享工具与数据访问（如 `db.ts`、`dataScope.ts`） |

**已迁移模块**（`modules/<domain>`）：

- **auth** — 登录、Token、鉴权中间件（requireAuth、requirePermission、applyDataScope）
- **iam** — 用户/角色/权限/数据范围（rbacService + IAM 控制器）
- **records** — 车牌记录与导出（PlateController、ExportController）
- **stats** — 仪表盘/日统计/区域统计
- **alarms** — 告警与黑名单（AlarmController、BlacklistController）
- **monitor** — 摄像头与上传（CameraController、UploadController）

### Frontend（`frontend/src/`）

| 目录 | 说明 |
|------|------|
| **features/** | 按业务域划分的功能，**页面与域内组件优先放这里** |
| **components/** | 共享 UI 组件（多域复用） |
| **pages/** | 其余页面（如设置页） |
| **store/** | 全局状态 (Zustand) |
| **api/** | API 客户端封装 |
| **contexts/** | 全局 Context；`AuthContext.tsx` 再导出 `@/features/auth` 以兼容旧引用 |
| **utils/** | 工具函数 |

**已迁移功能**（`features/<domain>`）：

- **auth** — AuthContext、PermissionGuard
- **iam** — IamPage（权限管理页）
- **dashboard** — DashboardPage（仪表盘）
- **records** — RecordsPage（识别记录）
- **alarms** — AlarmsPage（告警中心）
- **monitor** — LiveMonitorPage（实时监控）

### AI Service（`ai-service/`）

- **app/** — 服务核心实现
- **evaluation/** — 评估脚本
- 根目录 **main.py**、**evaluation.py** 为兼容入口，用法不变。

## 开发约定

1. **新增后端能力**：在 `backend/src/modules/<domain>/` 下增加或扩展控制器/服务，在 `routes/api.ts` 中挂载路由。
2. **新增前端页面/域**：在 `frontend/src/features/<domain>/` 下增加页面或组件，在 `App.tsx` 中通过 `@/features/<domain>` 引用。
3. **共享代码**：后端放 `utils/` 或 `config/`，前端放 `components/`、`store/`、`api/`、`utils/`；仅单域使用的可逐步迁入对应 module/feature。
4. **路径**：前端已配置 `@/` 指向 `src/`，推荐使用 `@/features/xxx`、`@/api/client` 等。

## 后续可选优化

- 统一导出风格与路径别名（如后端 `@/config`）。
- 按需将 components/store 中强绑定单域的代码迁入对应 feature。
- 引入 import 边界规则（如禁止 feature 互相引用），避免耦合。
