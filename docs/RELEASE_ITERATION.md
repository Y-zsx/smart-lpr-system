# 标准发布迭代指南（Frontend / Backend / AI）

> 适用环境：`Ubuntu 22.04 + Nginx + PM2 + MySQL`，单机部署。  
> 目标：发布步骤固定、验收标准固定、回滚路径固定。

## 1. 固定约定（发布前必须确认）

- 代码目录：`~/smart-lpr-system`
- 前端静态目录：`/var/www/smart-lpr`
- 前端访问域名：`https://smartlpr.cloud`
- 后端 PM2 进程名：`smart-lpr-backend`
- AI PM2 进程名：`smart-lpr-ai`

如果线上机器与以上约定不一致，先统一再发布，避免命令失效。

## 2. 发布分级与触发条件

- `前端发布`：仅 `frontend/` 目录改动。
- `后端发布`：仅 `backend/` 目录改动，或接口/鉴权/数据库访问逻辑变更。
- `AI 发布`：仅 `ai-service/` 目录改动，或 `requirements.txt` 变更。
- `全量发布`：跨前端+后端+AI 联动改动。

## 3. 本地发布前检查（必须通过）

## 3.1 更新代码基线

```bash
git checkout main
git pull origin main
```

## 3.2 构建验证

按改动模块执行：

```bash
# Frontend
cd frontend
npm install
npm run build

# Backend
cd ../backend
npm install
npm run build

# AI（建议在 venv 中）
cd ../ai-service
source venv/bin/activate
python -m app.main
```

通过标准：

- 前端/后端构建命令退出码为 `0`
- AI 服务可正常启动，无启动期报错（如 `ImportError`）

## 3.3 提交与推送

提交信息使用明确语义，不使用占位词：

```bash
git add .
git commit -m "fix(frontend): use valid china geojson CDN sources"
git push origin main
```

## 4. 服务器标准发布流程

## 4.1 拉取最新代码并记录版本

```bash
cd ~/smart-lpr-system
git pull origin main
git rev-parse --short HEAD
```

将 `git rev-parse` 输出的短 SHA 记录到发布记录。

## 4.2 前端发布流程

```bash
cd ~/smart-lpr-system/frontend
npm install --no-audit --no-fund
npm run build
sudo rsync -a --delete dist/ /var/www/smart-lpr/
sudo systemctl reload nginx
```

发布成功判定：

- `npm run build` 成功
- `sudo systemctl reload nginx` 成功
- 浏览器访问 `https://smartlpr.cloud` 可打开页面

## 4.3 后端发布流程

```bash
cd ~/smart-lpr-system/backend
npm install --no-audit --no-fund
npm run build
pm2 restart smart-lpr-backend
```

发布成功判定：

- `pm2 status` 显示 `smart-lpr-backend` 为 `online`
- `curl -s http://localhost:8000/api/health` 返回 `checks.database=true`

## 4.4 AI 发布流程

```bash
cd ~/smart-lpr-system/ai-service
source venv/bin/activate
pip install -r requirements.txt
pm2 restart smart-lpr-ai
```

发布成功判定：

- `pm2 status` 显示 `smart-lpr-ai` 为 `online`
- `curl -s http://localhost:8001/health` 返回 `status=online`

## 5. 发布后验收清单（必须全部通过）

执行命令：

```bash
pm2 status
curl -s http://localhost:8001/health
curl -s http://localhost:8000/api/health
curl -s https://smartlpr.cloud/api/health
```

人工验收路径：

- 浏览器强刷：`Ctrl+F5`
- 账号登录
- 仪表盘加载（含地图组件）
- 摄像头页面可正常加载（HTTPS 页面无 Mixed Content）
- 识别流程可跑通（上传图像 / 摄像头识别）
- 数据导出可正常返回

失败处理要求：

- 任一健康检查失败：停止继续发布，立即进入第 6 节回滚流程
- 任一主链路异常：先查日志再决定回滚
  - 后端日志：`pm2 logs smart-lpr-backend --lines 100`
  - AI 日志：`pm2 logs smart-lpr-ai --lines 100`
  - Nginx 错误：`sudo tail -n 100 /var/log/nginx/error.log`

## 6. 标准回滚流程

## 6.1 确认目标版本

```bash
cd ~/smart-lpr-system
git log --oneline -n 10
```

选取最近稳定版本（示例：`5e8c2b1`）并切换：

```bash
git switch --detach 5e8c2b1
```

## 6.2 重新发布受影响模块

- 回滚前端：重复执行第 4.2 节
- 回滚后端：重复执行第 4.3 节
- 回滚 AI：重复执行第 4.4 节

## 6.3 回滚验收

执行第 5 节全部检查。全部通过后，在发布记录中写明“已回滚并恢复”。

## 7. 发布记录（完整示例）

以下为可直接复用的记录格式，不留空字段：

- 发布人：`yangzsx`
- 发布时间：`2026-02-25 21:40`
- 发布版本：`a91c3f2`
- 发布范围：`Frontend + Backend`
- 变更摘要：`修复地图 GeoJSON 加载，修复 HTTPS Mixed Content 请求路径`
- 风险点：`地图外部 CDN 可用性、前端缓存导致旧包残留`
- 验收结果：`pm2 全部 online；三条 health 检查通过；手工主链路通过`
- 回滚方案：`回滚到 5e8c2b1，并按 4.2/4.3 节重发`

## 8. 推荐发布窗口

- 常规需求：工作日低峰时段（20:00 后）
- 重要改动：预留 30~60 分钟观察期
- 跨模块联动改动：分两批发布（先 Backend/AI，后 Frontend）

## 9. 提效优化方案（按投入递增）

## 9.1 立即可做（低成本）

1. 增加 `scripts/deploy.sh`，支持 `fe|be|ai|all` 参数，统一部署入口。  
2. 固化 PM2 配置文件，避免人工 `pm2 start` 参数漂移。  
3. 增加本地预检脚本，统一执行 frontend/backend build。

## 9.2 推荐实施（中成本）

1. 接入 GitHub Actions CI：`push main` 自动跑 frontend/backend build。  
2. 增加手动触发发布工作流：通过 SSH 执行服务器发布命令。

## 9.3 展示加分（中高成本）

1. 增加 `staging` 预发环境，生产前先走预发验证。  
2. 使用 Git Tag 发布（例如 `v1.2.0`），提升回滚效率。  
3. 增加监控告警（PM2 崩溃重启、Nginx 5xx 比例、接口健康状态）。
