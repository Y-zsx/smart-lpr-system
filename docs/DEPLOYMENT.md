# 🚀 云服务器部署指南

> 保姆级教程：从零开始部署 Smart LPR System 到云服务器

## 📋 目录

- [文档边界与使用方式](#文档边界与使用方式)
- [前置准备](#前置准备)
- [服务器环境配置](#服务器环境配置)
- [数据库配置](#数据库配置)
- [后端服务部署](#后端服务部署)
- [AI 服务部署](#ai-服务部署)
- [前端应用部署](#前端应用部署)
- [Nginx 反向代理配置](#nginx-反向代理配置)
- [SSL 证书配置](#ssl-证书配置)
- [防火墙配置](#防火墙配置)
- [域名解析](#域名解析)
- [首次部署验收](#首次部署验收)
- [首次部署常见问题](#首次部署常见问题)
- [发布迭代与回滚](#发布迭代与回滚)

---

## 文档边界与使用方式

本文档只负责**从 0 到 1 的首次上云部署**，包括：

- 服务器基础环境安装
- 数据库初始化
- 前后端与 AI 首次启动
- Nginx / HTTPS / 域名接入

日常迭代发布、回滚、发布记录与优化策略统一使用：

- [`RELEASE_ITERATION.md`](RELEASE_ITERATION.md)

避免同时维护两套发布流程，防止命令漂移与步骤冲突。

---

## 前置准备

### 1. 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **CPU**: 2 核以上
- **内存**: 4GB 以上（推荐 8GB）
- **硬盘**: 20GB 以上可用空间
- **网络**: 公网 IP，开放 80、443 端口

### 2. 需要准备的内容

- ✅ 云服务器实例（已购买）
- ✅ 域名（可选，推荐）
- ✅ SSH 访问权限
- ✅ 服务器 root 或 sudo 权限

---

## 服务器环境配置

### 1. 连接到服务器

```bash
ssh root@your-server-ip
# 或使用密钥
ssh -i your-key.pem root@your-server-ip
```

### 2. 更新系统

```bash
# Ubuntu/Debian
apt update && apt upgrade -y

# CentOS
yum update -y
```

### 3. 创建应用用户（推荐）

```bash
# 创建用户
adduser appuser
usermod -aG sudo appuser

# 切换到应用用户
su - appuser
```

### 4. 安装基础工具

```bash
# Ubuntu/Debian
apt install -y curl wget git vim build-essential

# CentOS
yum install -y curl wget git vim gcc gcc-c++ make
```

---

## 安装 Node.js

### 1. 安装 Node.js 18+

```bash
# 使用 NodeSource 仓库（推荐）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 配置 npm 镜像（可选，加速下载）

```bash
npm config set registry https://registry.npmmirror.com
```

---

## 安装 Python 3.8+

### 1. 检查 Python 版本

```bash
python3 --version
```

### 2. 安装 Python（如果没有）

```bash
# Ubuntu/Debian
sudo apt install -y python3 python3-pip python3-venv

# CentOS
sudo yum install -y python3 python3-pip
```

### 3. 配置 pip 镜像（可选）

```bash
mkdir -p ~/.pip
cat > ~/.pip/pip.conf << EOF
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
EOF
```

---

## 安装 MySQL

### 1. 安装 MySQL

```bash
# Ubuntu/Debian
sudo apt install -y mysql-server

# CentOS
sudo yum install -y mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

### 2. 配置 MySQL

```bash
# 运行安全配置脚本
sudo mysql_secure_installation

# 登录 MySQL
sudo mysql -u root -p
```

### 3. 创建数据库和用户

```sql
-- 在 MySQL 中执行
CREATE DATABASE smart_lpr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'lpr_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';

GRANT ALL PRIVILEGES ON smart_lpr.* TO 'lpr_user'@'localhost';

FLUSH PRIVILEGES;

EXIT;
```

> ⚠️ **重要**: 请将 `your_strong_password_here` 替换为强密码

### 4. 导入数据库结构

```bash
# 稍后部署时会执行，这里先记录
```

---

## 安装 Nginx

### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS
sudo yum install -y nginx
```

### 2. 启动 Nginx

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 3. 验证安装

访问 `http://your-server-ip` 应该看到 Nginx 欢迎页面

---

## 安装 PM2（进程管理）

```bash
sudo npm install -g pm2
```

---

## 部署应用代码

### 1. 创建应用目录

```bash
# 在用户主目录下创建
mkdir -p ~/smart-lpr-system
cd ~/smart-lpr-system
```

### 2. 上传代码到服务器

**方式一：使用 Git（推荐）**

```bash
# 克隆代码（如果是私有仓库，需要配置 SSH 密钥）
git clone https://github.com/your-username/smart-lpr-system.git .

# 或使用 HTTPS（需要输入用户名密码）
git clone https://github.com/your-username/smart-lpr-system.git .
```

**方式二：使用 SCP 上传**

```bash
# 在本地执行
scp -r ./smart-lpr-system root@your-server-ip:/home/appuser/
```

### 3. 验证代码结构

```bash
cd ~/smart-lpr-system
ls -la
# 应该看到 frontend, backend, ai-service 等目录
```

---

## 数据库配置

### 1. 导入数据库结构

```bash
cd ~/smart-lpr-system
mysql -u lpr_user -p smart_lpr < scripts/init_database.sql
```

### 2. 验证数据库

```bash
mysql -u lpr_user -p smart_lpr < scripts/verify_database.sql
```

---

## 后端服务部署

### 1. 进入后端目录

```bash
cd ~/smart-lpr-system/backend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量文件
vim .env
```

**需要修改的配置项**：

```env
# 服务器配置
PORT=8000
NODE_ENV=production
JWT_SECRET=replace_with_a_strong_random_secret

# 数据库配置 - ⚠️ 修改为你的数据库信息
DB_HOST=localhost
DB_PORT=3306
DB_USER=lpr_user
DB_PASSWORD=your_strong_password_here
DB_NAME=smart_lpr
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_CONNECT_TIMEOUT_MS=10000

# AI 服务地址 - ⚠️ 如果 AI 服务在同一服务器，保持 localhost
AI_SERVICE_URL=http://localhost:8001

# 文件上传配置
MAX_FILE_SIZE=10485760
MAX_VIDEO_FILE_SIZE=536870912
PUBLIC_BASE_URL=https://your-domain.com

# 存储驱动：local / cos
STORAGE_DRIVER=local

# 腾讯云 COS（STORAGE_DRIVER=cos 时必填）
COS_BUCKET=
COS_REGION=
COS_SECRET_ID=
COS_SECRET_KEY=
# 可选：公共读桶/CDN 地址
COS_PUBLIC_BASE_URL=
# 私有桶签名 URL 过期秒数
COS_SIGNED_URL_EXPIRES_SECONDS=600

# 告警触发短视频切片
ALARM_CLIP_ENABLED=true
ALARM_CLIP_DURATION_SEC=12
ALARM_CLIP_TIMEOUT_MS=45000
ALARM_CLIP_FFMPEG_BIN=ffmpeg

# CORS 配置 - ⚠️ 修改为你的前端域名
CORS_ORIGIN=https://your-domain.com,http://your-server-ip
```

> ⚠️ **重要配置项**：
> - `DB_PASSWORD`: 使用之前创建的数据库密码
> - `CORS_ORIGIN`: 添加你的前端域名和服务器 IP
>
> 💡 **当前版本建议额外配置**（按需）：
> - `PUBLIC_BASE_URL`: 上传文件访问地址（例如 `https://your-domain.com`）
> - `STORAGE_DRIVER`: 存储驱动（`local`/`cos`）
> - `COS_BUCKET` / `COS_REGION` / `COS_SECRET_ID` / `COS_SECRET_KEY`: COS 访问配置
> - `ALARM_CLIP_*`: 告警视频切片参数（依赖 ffmpeg）
> - `GLOBAL_RATE_LIMIT_PER_MINUTE`: 全局限流阈值（默认 240）
> - `AUTH_RATE_LIMIT_PER_MINUTE`: 登录限流阈值（默认 12）
> - `RECOGNIZE_RATE_LIMIT_PER_MINUTE`: 识别接口限流阈值（默认 60）
> - `UPLOAD_RATE_LIMIT_PER_MINUTE`: 上传接口限流阈值（默认 40）
> - `AI_FAILURE_MODE`: AI 失败时返回模式（默认 `structured`）

### 4. 创建上传目录

```bash
mkdir -p uploads
chmod 755 uploads
```

### 4.1 安装 ffmpeg（告警视频切片必需）

> `ALARM_CLIP_ENABLED=true` 时必须安装 ffmpeg，否则告警媒体任务会标记为 failed。

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y ffmpeg
ffmpeg -version
```

### 5. 构建项目

```bash
npm run build
```

### 6. 使用 PM2 启动后端服务

```bash
# 创建 PM2 配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'smart-lpr-backend',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
EOF

# 创建日志目录
mkdir -p logs

# 启动服务
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 执行上面命令输出的命令（通常是 sudo env PATH=...）
```

### 7. 验证后端服务

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs smart-lpr-backend

# 测试接口
curl http://localhost:8000/api/health
```

---

## AI 服务部署

### 1. 进入 AI 服务目录

```bash
cd ~/smart-lpr-system/ai-service
```

### 2. 创建虚拟环境

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 使用 PM2 启动 AI 服务

```bash
# 创建 PM2 配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'smart-lpr-ai',
    script: 'venv/bin/python',
    args: '-m app.main',
    interpreter: 'none',
    instances: 1,
    exec_mode: 'fork',
    env: {
      PORT: 8001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G'
  }]
}
EOF

# 创建日志目录
mkdir -p logs

# 启动服务
pm2 start ecosystem.config.js

# 保存配置
pm2 save
```

### 5. 验证 AI 服务

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs smart-lpr-ai

# 测试接口
curl http://localhost:8001/health
```

---

## 前端应用部署

### 1. 进入前端目录

```bash
cd ~/smart-lpr-system/frontend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
# 创建生产环境配置文件
cat > .env.production << EOF
# API 地址 - ⚠️ 修改为你的后端域名或 IP
VITE_API_BASE_URL=https://your-domain.com
# 或使用 IP
# VITE_API_BASE_URL=http://your-server-ip:8000

# 高德地图 API Key（如果使用）- ⚠️ 修改为你的 Key
VITE_AMAP_KEY=your_amap_key_here
# 高德地图安全密钥（可选，按平台配置）
# VITE_AMAP_SECURITY_CODE=your_amap_security_code

# API 重试参数（可选）
# VITE_API_RETRY_TIMES=2
# VITE_API_RETRY_BASE_MS=250
EOF
```

> ⚠️ **重要**: 
> - `VITE_API_BASE_URL`: 如果使用域名，应该是 `https://your-domain.com`（不要带 `/api`）
> - 如果使用 IP，需要包含端口号 `http://your-server-ip:8000`（不要带 `/api`）

### 4. 修改 API 客户端配置（如果需要）

```bash
# 检查 frontend/src/api/client.ts
# 确保 API_BASE_URL 使用环境变量
```

### 5. 构建生产版本

```bash
npm run build
```

构建完成后，会在 `dist` 目录生成静态文件。

### 6. 配置 Nginx 托管前端

```bash
# 创建 Nginx 配置
sudo vim /etc/nginx/sites-available/smart-lpr-frontend
```

**Nginx 配置内容**：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # ⚠️ 修改为你的域名，或使用 _ 表示所有域名
    
    root /home/appuser/smart-lpr-system/frontend/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 7. 启用 Nginx 配置

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/smart-lpr-frontend /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## Nginx 反向代理配置（完整版）

### 怎么配（操作步骤）

1. **SSH 登录服务器**（如 `ssh root@你的服务器IP` 或使用 smartlpr.cloud 对应主机）。

2. **打开站点配置**（实际文件名可能是 `smart-lpr`、`default` 或你的域名）：
   ```bash
   sudo vim /etc/nginx/sites-available/smart-lpr
   # 或
   sudo vim /etc/nginx/conf.d/smart-lpr.conf
   ```

3. **在 `server { ... }` 里做两件事**（顺序不要反）：
   - 在 **`location /api` 之前** 增加一段 `location /api/media/upload-video`（见下方「视频上传专用 location」）。
   - 把原来的 **`client_max_body_size 10M;`** 改成 **`client_max_body_size 20M;`**（或删除该行，用下面默认 20M）。

4. **保存后检查并重载**：
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

**若已有完整 server 块**，只需在 `location /api` 之前插入下面这一段即可：

```nginx
    # 视频上传接口：需要更大 body 和更长超时（避免 413）
    location /api/media/upload-video {
        client_max_body_size 512M;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        proxy_request_buffering off;
        proxy_buffering off;
    }
```

---

如需完整 server 配置，可使用以下内容（将 `your-domain.com` 改为你的域名，如 `smartlpr.cloud`）：

```bash
sudo vim /etc/nginx/sites-available/smart-lpr
```

```nginx
# 前端服务
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # ⚠️ 修改为你的域名
    
    # 重定向到 HTTPS（配置 SSL 后启用）
    # return 301 https://$server_name$request_uri;

    root /home/appuser/smart-lpr-system/frontend/dist;
    index index.html;

    # 日志
    access_log /var/log/nginx/smart-lpr-access.log;
    error_log /var/log/nginx/smart-lpr-error.log;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # 视频上传接口：需要更大 body 和更长超时（避免 413 Content Too Large）
    location /api/media/upload-video {
        client_max_body_size 512M;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        proxy_request_buffering off;
        proxy_buffering off;
    }

    # API 代理
    location /api {
        client_max_body_size 20M;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时和缓冲设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 默认请求体限制（普通接口）。视频上传单独用上面 location /api/media/upload-video 的 512M
    client_max_body_size 20M;
}
# 说明：此前用 10M 是常见做法，用于限制普通接口请求体、防止滥用；视频需单独放大故单独配置。
# 前端逻辑：视频仅在用户点击「添加」或「保存」后才上传，未确认不会落盘，避免产生无法删除的孤儿文件。

# HTTPS 配置（配置 SSL 证书后使用）
# server {
#     listen 443 ssl http2;
#     server_name your-domain.com www.your-domain.com;
#     
#     ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
#     
#     # SSL 配置
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#     
#     # 其他配置同上
# }
```

---

## SSL 证书配置

### 使用 Let's Encrypt（免费）

### 1. 安装 Certbot

```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS
sudo yum install -y certbot python3-certbot-nginx
```

### 2. 获取证书

```bash
# 确保域名已解析到服务器 IP
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 3. 自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# Certbot 会自动配置 cron 任务
```

### 4. 更新 Nginx 配置

Certbot 会自动更新 Nginx 配置，启用 HTTPS。

---

## 防火墙配置

### Ubuntu/Debian (UFW)

```bash
# 启用防火墙
sudo ufw enable

# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 查看状态
sudo ufw status
```

### CentOS (firewalld)

```bash
# 启动防火墙
sudo systemctl start firewalld
sudo systemctl enable firewalld

# 允许服务
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# 重载配置
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-all
```

---

## 域名解析

### 1. 添加 A 记录

在域名 DNS 管理中添加：

- **类型**: A
- **主机记录**: @ (或 www)
- **记录值**: 你的服务器公网 IP
- **TTL**: 600（或默认）

### 2. 等待解析生效

```bash
# 检查解析
nslookup your-domain.com
dig your-domain.com
```

通常需要几分钟到几小时生效。

---

## 首次部署验收

### 1. 服务状态检查

```bash
pm2 status
sudo systemctl status nginx --no-pager
sudo systemctl status mysql --no-pager
```

通过标准：

- `smart-lpr-backend`、`smart-lpr-ai` 均为 `online`
- `nginx`、`mysql` 均为 `active (running)`

### 2. 端口与健康检查

```bash
sudo ss -tlnp | grep -E '8000|8001|80|443'
curl -s http://localhost:8000/api/health
curl -s http://localhost:8001/health
curl -s https://your-domain.com/api/health
```

### 3. 浏览器验收

至少验证以下链路：

- 前端页面可访问（HTTPS）
- 登录成功
- 仪表盘与地图可加载
- 摄像头页面可打开并触发识别

---

## 首次部署常见问题

### 1. 后端启动失败

```bash
pm2 logs smart-lpr-backend --lines 100
sudo lsof -i :8000
```

优先排查项：数据库账号密码、`.env` 配置、端口冲突。

### 2. AI 启动失败

```bash
pm2 logs smart-lpr-ai --lines 100
cd ~/smart-lpr-system/ai-service
source venv/bin/activate
python -m app.main
```

优先排查项：Python 依赖是否完整、系统依赖（如 `libGL.so.1`）、端口冲突。

### 3. 前端可访问但 API 异常

```bash
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
curl -s http://localhost:8000/api/health
```

优先排查项：Nginx 反向代理、`CORS_ORIGIN`、前端 `VITE_API_BASE_URL`。

### 4. 视频上传返回 413 Content Too Large

原因：Nginx 对请求体有默认上限（常见为 10M），用于限制普通接口、防止滥用；视频体积大，超过该限制会被直接拒绝。

处理：按本文档「Nginx 反向代理配置（完整版）」更新配置，确保：

- 为 `/api/media/upload-video` 单独配置 `client_max_body_size 512M` 和更长超时（如 `proxy_send_timeout 600s`）。
- 通用 API 的 `client_max_body_size` 建议不小于 20M。

修改后执行：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 发布迭代与回滚

首次部署完成后，后续所有日常发布、回滚、发布记录与提效策略，统一使用：

- [`RELEASE_ITERATION.md`](RELEASE_ITERATION.md)

本文件不再维护重复的发布运维命令，避免文档分叉。

---

## 安全建议

1. **定期更新系统**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **使用强密码**
   - 数据库密码
   - 服务器 root 密码
   - SSH 密钥（推荐）

3. **禁用 root SSH 登录**（可选）
   ```bash
   sudo vim /etc/ssh/sshd_config
   # 设置: PermitRootLogin no
   sudo systemctl restart sshd
   ```

4. **配置 fail2ban**（防止暴力破解）
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   ```

5. **定期备份数据**

---

## 总结

完成以上步骤后，你的 Smart LPR System 应该已经成功部署到云服务器上。

**访问地址**：
- 前端: `http://your-domain.com` 或 `https://your-domain.com`
- 后端 API: `http://your-domain.com/api`
- AI 服务: `http://your-server-ip:8001`（内部访问）

日常管理与版本发布请直接使用：

- [`RELEASE_ITERATION.md`](RELEASE_ITERATION.md)

如有问题，请优先查看本文件“首次部署常见问题”，再结合发布迭代文档排查。

---

**祝部署顺利！** 🎉
