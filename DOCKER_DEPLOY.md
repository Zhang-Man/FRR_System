# Docker 容器化部署文档

将 `app`（React 前端）和 `backend`（Flask 后端）封装进**单一 Docker 容器**，容器内项目名称为 `Frr-system`。

---

## 一、整体架构

```
┌──────────────────────────────────────────────┐
│                 Docker 容器                    │
│                                              │
│   /app/Frr-system/                           │
│   ├── backend/       # Flask 后端代码          │
│   ├── frontend/      # React 构建产物 (dist)    │
│   └── data/          # SQLite 数据库持久化目录   │
│                                              │
│   ┌─────────┐     /api/*      ┌──────────┐   │
│   │  Nginx  │ ──────────────> │ Gunicorn │   │
│   │  :80    │                 │ :5000    │   │
│   │  静态文件 │ <── /, /assets  │ (内部)    │   │
│   └─────────┘                 └──────────┘   │
└──────────────────────────────────────────────┘
```

- **Nginx**：监听 `80` 端口，提供前端静态文件服务，并将 `/api/*` 请求反向代理到内部的 Flask 应用
- **Gunicorn**：运行 Flask 后端，监听 `127.0.0.1:5000`（仅容器内部可达）
- **数据库**：SQLite 文件存放在 `data/` 目录，通过 volume 挂载实现持久化

---

## 二、需要创建的文件

在项目根目录下创建以下 3 个文件：

### 2.1 `Dockerfile`

```dockerfile
# ============================================
# 阶段一：构建前端
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/Frr-system/frontend

# 复制前端依赖文件并安装
COPY app/package.json app/package-lock.json* ./
RUN npm ci --legacy-peer-deps

# 复制前端源码并构建
COPY app/ ./
RUN npm run build

# ============================================
# 阶段二：最终运行镜像
# ============================================
FROM python:3.11-slim

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Shanghai

# 安装 nginx、supervisor 和系统依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        nginx \
        supervisor \
        sqlite3 && \
    rm -rf /var/lib/apt/lists/* && \
    rm /etc/nginx/sites-enabled/default

# 创建工作目录
WORKDIR /app/Frr-system

# ---- 后端 ----
COPY backend/ ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# ---- 前端构建产物 ----
COPY --from=frontend-builder /app/Frr-system/frontend/dist/ ./frontend/

# ---- 数据目录 ----
RUN mkdir -p /app/Frr-system/data
ENV DB_PATH=/app/Frr-system/data/data.db

# ---- nginx 配置 ----
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ---- supervisor 配置 ----
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 暴露端口
EXPOSE 80

# 启动 supervisor（管理 nginx + gunicorn）
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
```

### 2.2 `nginx.conf`

```nginx
server {
    listen 80;
    server_name _;

    root /app/Frr-system/frontend;
    index index.html;

    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到 Flask 后端
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2.3 `supervisord.conf`

```ini
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:gunicorn]
command=gunicorn -w 4 -b 127.0.0.1:5000 app:create_app()
directory=/app/Frr-system/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

### 2.4 `.dockerignore`

```dockerignore
node_modules/
.git/
*.md
.vscode/
.idea/
record/
test/
app/node_modules/
app/dist/
backend/__pycache__/
backend/*.db
__pycache__/
*.pyc
.env
```

---

## 三、构建与运行

### 3.1 构建镜像

在项目根目录下执行：

```bash
docker build -t frr-system:latest .
```

### 3.2 运行容器

```bash
docker run -d \
  --name frr-system \
  -p 8080:80 \
  -v frr-data:/app/Frr-system/data \
  frr-system:latest
```

参数说明：
| 参数 | 说明 |
|------|------|
| `-d` | 后台运行 |
| `--name frr-system` | 容器名称 |
| `-p 8080:80` | 将宿主机 8080 端口映射到容器 80 端口 |
| `-v frr-data:/app/Frr-system/data` | 持久化 SQLite 数据库 |

### 3.3 访问

浏览器打开：`http://localhost:8080`

### 3.4 常用管理命令

```bash
# 查看日志
docker logs frr-system

# 进入容器
docker exec -it frr-system bash

# 停止容器
docker stop frr-system

# 删除容器
docker rm frr-system

# 重新构建并运行
docker build -t frr-system:latest . && docker rm -f frr-system || true && docker run -d --name frr-system -p 8080:80 -v frr-data:/app/Frr-system/data frr-system:latest
```

---

## 四、文件清单

| 文件 | 位置 | 用途 |
|------|------|------|
| `Dockerfile` | 项目根目录 | 多阶段构建定义 |
| `nginx.conf` | 项目根目录 | Nginx 反向代理配置 |
| `supervisord.conf` | 项目根目录 | 进程管理（nginx + gunicorn） |
| `.dockerignore` | 项目根目录 | 排除不需要打包的文件 |

---

## 五、注意事项

1. **不修改任何源代码**：以上配置仅通过环境变量 `DB_PATH` 修改数据库路径，不触及业务代码
2. **单容器方案**：使用 `supervisord` 在容器内同时管理 nginx 和 gunicorn 两个进程
3. **数据持久化**：SQLite 数据库通过 Docker volume 持久化，容器删除后数据不丢失
4. **镜像大小**：多阶段构建使最终镜像不含 Node.js 和 npm 依赖，有效减小体积
5. **生产环境密钥**：JWT 密钥应通过环境变量 `SECRET_KEY` 注入，切勿硬编码在代码或镜像中
6. **日志**：nginx 和 gunicorn 的日志均输出到 `stdout`/`stderr`，可通过 `docker logs` 查看
