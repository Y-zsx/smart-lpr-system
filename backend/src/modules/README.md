# Backend Modules (Scaffold)

该目录用于后端按业务域进行模块化重构（稳妥版脚手架）。

当前策略：
- 保留现有 `controllers/routes/services/utils` 结构，避免大规模迁移引发回归。
- 从新功能开始优先进入 `modules/<domain>`。
- 旧模块在后续迭代中逐步迁移。

建议业务域：
- `modules/auth`
- `modules/iam`
- `modules/monitor`
- `modules/alarms`
- `modules/records`
- `modules/stats`

