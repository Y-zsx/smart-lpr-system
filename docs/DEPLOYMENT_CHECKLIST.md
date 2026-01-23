# 📋 部署配置检查清单

快速参考：部署时需要修改的所有配置项

## ⚠️ 必须修改的配置项

### 1. 后端配置 (`backend/.env`)

```env
# 数据库配置
DB_PASSWORD=your_strong_password_here          # ⚠️ 修改为你的数据库密码
DB_USER=lpr_user                                # 可选：修改为你的数据库用户

# CORS 配置
CORS_ORIGIN=https://your-domain.com,http://your-server-ip  # ⚠️ 修改为你的域名和IP
```

### 2. 前端配置 (`frontend/.env.production`)

```env
# API 地址
VITE_API_BASE_URL=https://your-domain.com/api   # ⚠️ 修改为你的后端地址
# 或使用 IP: http://your-server-ip:8000/api

# 高德地图（如果使用）
VITE_AMAP_KEY=your_amap_key_here                # ⚠️ 修改为你的高德地图 Key
```

### 3. Nginx 配置 (`/etc/nginx/sites-available/smart-lpr-frontend`)

```nginx
server_name your-domain.com;                    # ⚠️ 修改为你的域名

root /home/appuser/smart-lpr-system/frontend/dist;  # ⚠️ 修改为实际路径
```

### 4. 数据库配置

```sql
-- 创建用户时
CREATE USER 'lpr_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';
-- ⚠️ 修改密码
```

## 📝 配置项汇总表

| 配置文件 | 配置项 | 说明 | 示例值 |
|---------|--------|------|--------|
| `backend/.env` | `DB_PASSWORD` | 数据库密码 | `MySecurePass123!` |
| `backend/.env` | `CORS_ORIGIN` | 允许的前端域名 | `https://lpr.example.com` |
| `frontend/.env.production` | `VITE_API_BASE_URL` | 后端 API 地址 | `https://lpr.example.com/api` |
| `frontend/.env.production` | `VITE_AMAP_KEY` | 高德地图 Key | `abc123def456` |
| Nginx 配置 | `server_name` | 域名 | `lpr.example.com` |
| Nginx 配置 | `root` | 前端文件路径 | `/home/appuser/.../dist` |
| MySQL | 数据库用户密码 | 数据库密码 | `MySecurePass123!` |

## ✅ 部署后验证清单

- [ ] 后端服务运行正常 (`pm2 status`)
- [ ] AI 服务运行正常 (`pm2 status`)
- [ ] Nginx 服务运行正常 (`sudo systemctl status nginx`)
- [ ] 数据库连接正常 (`mysql -u lpr_user -p`)
- [ ] 前端可以访问 (`curl http://your-domain.com`)
- [ ] API 接口正常 (`curl http://your-domain.com/api/health`)
- [ ] SSL 证书配置（如果使用）
- [ ] 防火墙规则配置
- [ ] 域名解析生效

## 🔗 相关文档

详细部署步骤请查看：[云服务器部署指南](DEPLOYMENT.md)
