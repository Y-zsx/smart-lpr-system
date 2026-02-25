# 文档索引

## 快速入门

- [快速开始](QUICK_START.md) — 视频演示与摄像头接入

## 配置与部署

- [云服务器部署](DEPLOYMENT.md) — 从零部署（环境、数据库、Nginx、SSL、PM2、防火墙）
- [标准发布迭代](RELEASE_ITERATION.md) — 日常迭代发布、回滚、验收与优化路线
- [摄像头配置](CAMERA_SETUP.md) — USB/网络摄像头、视频文件、性能与故障排查
- [数据库配置](DATABASE.md) — MySQL 安装、表结构、脚本使用
- [权限管理](IAM_RBAC.md) — RBAC、数据范围、默认账号与验收
- [项目结构](PROJECT_STRUCTURE.md) — 按域目录、模块/功能说明与开发约定
- [高德地图配置](AMAP_SETUP.md) — 地理位置与地图 API

## 数据与开发

- [数据记录说明](PLATE_RECORDS.md) — 车牌记录模型、表结构、API、维护
- [功能测试指南](TESTING.md) — 构建验证、健康检查、前端手动测试清单

## 推荐阅读

- 新用户：快速开始 → 摄像头配置 → 数据库配置
- 部署：云服务器部署
- 开发：数据记录说明、高德地图配置、各模块 README（frontend/backend/ai-service）

## 文档维护约定

- `DEPLOYMENT.md`：只维护首次上云部署（从 0 到 1）。
- `RELEASE_ITERATION.md`：只维护日常迭代发布、回滚、验收和发布记录。
- 遇到发布相关改动时，优先更新 `RELEASE_ITERATION.md`，避免两份文档重复维护。
