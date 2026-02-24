# 项目结构说明（稳妥版）

## 目标

- 提升目录可读性，降低新功能接入成本。
- 保持现有业务逻辑和启动命令不变。
- 为后续重构提供脚手架目录。

## 调整内容

**Backend**：新增 `backend/src/modules/`，新功能优先放在 `modules/<domain>`。

**Frontend**：新增 `frontend/src/features/`，与现有 pages/components/store 并行，新功能优先放在 `features/<domain>`。

**AI Service**：新增 `app/`、`evaluation/`；保留 `main.py` → `app/main.py`、`evaluation.py` → `evaluation/evaluate.py` 兼容入口。

## 兼容性

- `python main.py`、`python evaluation.py` 用法不变；前后端构建命令不变。

## 后续建议

- 分批迁移高频模块到 modules/ 与 features/。
- 统一导出入口与路径别名、模块边界规则（如 lint/import boundary）。
