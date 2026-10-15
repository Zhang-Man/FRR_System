
### 第一步：安装系统依赖

```bash
# 更新包列表
apt update

# 安装 Node.js 22.x（Vite 7 需要较新版本）
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 安装 Python 虚拟环境工具、Nginx、Git
apt install -y python3-pip python3-venv nginx git

# 验证
node -v && npm -v && python3 --version && nginx -v
```

---

### 第二步：克隆项目 & 安装依赖

```bash
# 克隆到 /opt
cd /opt
git clone https://github.com/Zhang-Man/FRR_System.git
cd FRR_System

# 后端：创建虚拟环境 & 安装依赖
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
pip install gunicorn
deactivate

# 前端：安装依赖 & 构建
cd app
npm install
npm run build
```

---

### 第三步：# 回到项目目录 配置 Nginx

```bash
cd /opt/frr-system

cat > /etc/nginx/sites-available/frr << 'EOF'
server {
    listen 80;
    server_name _;

    root /opt/frr-system/app/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/frr /etc/nginx/sites-enabled/frr
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

### 第四步：注册后端为 systemd 服务（开机自启）

```bash
cat > /etc/systemd/system/frr-backend.service << 'EOF'
[Unit]
Description=FRR Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/frr-system/backend
ExecStart=/opt/frr-system/backend/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:create_app()
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable frr-backend
systemctl start frr-backend
systemctl status frr-backend
```

---

### 第五步：验证

```bash
# 检查后端
curl http://127.0.0.1:5000/health

# 检查前端（用服务器 IP 在浏览器访问 http://<你的服务器IP>）
curl -I http://127.0.0.1/
```

---

### 以后更新代码

```bash
cd /opt/frr-system
git pull
cd app && npm install && npm run build
cd /opt/frr-system
source backend/venv/bin/activate && pip install -r backend/requirements.txt && deactivate
systemctl restart frr-backend
```

### 新增功能部署（v3.1 多人协作）

v3.1 新增 `ticket_collaborators` 表和多条 API 变更，首次更新需要重启后端以确保新表创建：

```bash
cd /opt/frr-system
git pull
cd app && npm install && npm run build
systemctl restart frr-backend   # 重启会自动执行 init_db() 创建新表
```

验证新表是否创建：
```bash
cd /opt/frr-system/backend
source venv/bin/activate
python -c "from models import get_db; db=get_db(); cols=db.execute('PRAGMA table_info(ticket_collaborators)').fetchall(); print([c[1] for c in cols]); db.close()"
# 预期输出: ['id', 'ticket_id', 'user_id', 'user_name']
```

### 默认登录账号

- 管理员：`FrrSystemAdmin`
- 处理人：`S001`

---

### 常见问题

#### DB_PATH 相对路径导致 sqlite3.OperationalError

`.env` 中的 `DB_PATH=backend/data.db` 是相对路径，systemd 的 `WorkingDirectory` 为 `backend/`，
实际解析为 `backend/backend/data.db`（不存在），导致 `unable to open database file`。

**解决：** 改为 `DB_PATH=data.db`（相对于 WorkingDirectory）或绝对路径：

```bash
sed -i 's|DB_PATH=backend/data.db|DB_PATH=data.db|' /opt/frr-system/.env
```

#### 前端 500 + 后端正常 = nginx 无权限读取静态文件

nginx worker 以 `www-data` 用户运行。如果项目放在 `/root`（权限 700），nginx 无法进入该目录。
项目放在 `/opt`（权限 755）即可解决。不要将前端 dist 放在 `/root` 下。

#### 移动项目目录后 venv 失效（status=203/EXEC）

Python venv 的 shebang 写死了绝对路径，移动后 gunicorn 等脚本无法执行。
**必须重建 venv：**

```bash
cd /opt/frr-system/backend
rm -rf venv && python3 -m venv venv
source venv/bin/activate && pip install -r requirements.txt && pip install gunicorn && deactivate
```

---

### TODO 优化项

- [ ] **用非 root 用户运行后端：** `useradd -r -s /usr/sbin/nologin frrsvcuser`，systemd 改 `User=frrsvc`，项目目录 `chown -R frrsvc:frrsvc`
- [ ] **数据库与代码分离：** 将 `data.db` 放到 `/var/lib/frr/data.db`，`.env` 里 `DB_PATH=/var/lib/frr/data.db`
- [ ] **gunicorn 加 `--preload`：** 避免多 worker 各自 `init_db()`，ExecStart 改为 `gunicorn --preload -w 4 -b 127.0.0.1:5000 app:create_app()`
- [ ] **nginx 前端目录与代码分离：** 将 dist 复制到 `/var/www/frr/`，更新 nginx `root` 指令
- [ ] **关闭 FLASK_DEBUG：** 生产环境 `.env` 中 `FLASK_DEBUG=false`

---

### 定时备份数据库

每周日凌晨 3 点备份 `data.db` 到 `/root/backups/`：

```bash
# 创建备份目录
mkdir -p /root/backups

# 写入 cron 任务
(crontab -l 2>/dev/null; echo '0 3 * * 0 cp /opt/frr-system/backend/data.db /root/backups/data_$(date +\%Y\%m\%d).db') | crontab -
```

验证是否写入成功：

```bash
crontab -l
```