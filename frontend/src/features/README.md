# Frontend Features (Scaffold)

该目录用于前端按业务功能组织代码，逐步替代“按技术类型平铺”的结构。

稳妥版约定：
- 现有 `pages/components/store` 继续可用，避免大迁移。
- 新功能优先放入 `features/<domain>`。
- 旧功能按模块迭代迁移。

建议每个 feature 内结构：
- `components/`
- `pages/`
- `store/`
- `services/`
- `types/`

