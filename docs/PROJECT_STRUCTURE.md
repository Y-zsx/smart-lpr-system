# 项目结构优化说明（稳妥版）

本文档说明本次“稳妥版”结构优化目标与约束。

## 目标

- 提升目录可读性，降低新功能接入成本。
- 保持现有业务逻辑和启动命令不变。
- 为后续深度重构提供脚手架目录。

## 本次调整

### Backend

- 新增：`backend/src/modules/`
- 说明：当前仅提供分域脚手架目录，不强制迁移旧代码。
- 约定：新功能优先进入 `modules/<domain>`。

### Frontend

- 新增：`frontend/src/features/`
- 说明：与现有 `pages/components/store` 并行存在。
- 约定：新功能优先进入 `features/<domain>`。

### AI Service

- 新增：`ai-service/app/`、`ai-service/evaluation/`
- 保留兼容入口：
  - `ai-service/main.py` 委托到 `app/main.py`
  - `ai-service/evaluation.py` 委托到 `evaluation/evaluate.py`

## 兼容性

- `python main.py` 启动方式不变。
- `python evaluation.py ...` 用法不变。
- 前后端构建命令不变。

## 后续建议（非本次）

- 分批迁移高频业务模块到 `modules/` 与 `features/`。
- 增加统一导出入口（barrel）与路径别名规范。
- 引入模块边界规则（如 lint/import boundary）。

