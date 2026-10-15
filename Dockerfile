# ============ 阶段一：构建前端 ============
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY app/package.json app/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY app/ ./
RUN npm run build

# ============ 阶段二：运行镜像 ============
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Shanghai \
    DB_PATH=/app/data/data.db \
    ORG_NAME=FRR System

RUN apt-get update && apt-get install -y --no-install-recommends nginx supervisor sqlite3 \
    && rm -rf /var/lib/apt/lists/* && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app
COPY backend/ ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt
COPY --from=frontend-builder /app/frontend/dist/ ./frontend/
RUN mkdir -p /app/data
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
EXPOSE 80
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]