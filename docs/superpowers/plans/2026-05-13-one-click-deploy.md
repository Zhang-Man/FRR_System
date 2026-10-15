> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# One-Click Deploy Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create two files (`.env.deploy` + `deploy.sh`) that provide docker-compose-like one-click deploy for FRR System on a blank Debian LXC container.

**Architecture:** Single `deploy.sh` with idempotent functions, each checking work-done markers before executing. systemd manages runtime; script manages deploy/update/backup operations.

**Tech Stack:** Bash 4+, systemd, nginx, Python venv, npm, git

---

### Task 1: Create `.env.deploy` template

**Files:**
- Create: `.env.deploy`

- [ ] **Step 1: Write the config template**

```bash
# ============================================
# FRR System 一键部署配置
# 修改以下参数，保存后运行 ./deploy.sh
# ============================================

# Git 仓库地址
REPO_URL=https://github.com/<your-name>/<your-repo>.git

# Git 分支
REPO_BRANCH=main

# 前端监听端口
WEB_PORT=80

# 后端内部端口（Nginx 反向代理到此）
BACKEND_PORT=5000

# Gunicorn worker 数（建议 CPU 核数×2，2 CPU 用 4）
GUNICORN_WORKERS=4

# systemd 服务名
SERVICE_NAME=frr-backend
```

- [ ] **Step 2: Verify file exists and is readable**

Run: `Test-Path -LiteralPath ".env.deploy"`
Expected: True

- [ ] **Step 3: Commit**

```bash
git add .env.deploy
git commit -m "feat: add .env.deploy config template for one-click deploy"
```

---

### Task 2: Write `deploy.sh` — scaffold (shebang, logging, colors, main dispatcher)

**Files:**
- Create: `deploy.sh`

- [ ] **Step 1: Write the scaffold**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============================================
# FRR System One-Click Deploy Script
# Usage: ./deploy.sh [deploy|update|backup]
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/deploy.log"
ENV_FILE="$SCRIPT_DIR/.env.deploy"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
info() { log "${CYAN}[INFO]${NC} $1"; }
ok()   { log "${GREEN}[OK]${NC} $1"; }
warn() { log "${YELLOW}[WARN]${NC} $1"; }
err()  { log "${RED}[ERROR]${NC} $1"; exit 1; }

usage() {
    echo "Usage: $0 {deploy|update|backup}"
    echo ""
    echo "  deploy   First-time deployment (idempotent, safe to re-run)"
    echo "  update   Pull latest code and rebuild"
    echo "  backup   Manual database backup"
    exit 1
}

main() {
    local cmd="${1:-deploy}"
    case "$cmd" in
        deploy) do_deploy ;;
        update) do_update ;;
        backup) do_backup ;;
        *)      usage ;;
    esac
}

main "$@"
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output (no syntax errors)

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add deploy.sh scaffold with logging and dispatcher"
```

---

### Task 3: Write `check_config()` function

**Files:**
- Modify: `deploy.sh` — insert `check_config()` before `usage()`, add call in `do_deploy`/`do_update`

- [ ] **Step 1: Add `check_config()`**

Insert after the log functions and before `usage()`:

```bash
check_config() {
    if [[ ! -f "$ENV_FILE" ]]; then
        err ".env.deploy not found in $SCRIPT_DIR"
    fi
    source "$ENV_FILE"

    local missing=""
    for var in REPO_URL REPO_BRANCH WEB_PORT BACKEND_PORT GUNICORN_WORKERS SERVICE_NAME; do
        if [[ -z "${!var:-}" ]]; then
            missing="$missing $var"
        fi
    done
    if [[ -n "$missing" ]]; then
        err "Missing required config values:$missing"
    fi

    if [[ ! "$WEB_PORT" =~ ^[0-9]+$ ]] || [[ "$WEB_PORT" -lt 1 ]] || [[ "$WEB_PORT" -gt 65535 ]]; then
        err "WEB_PORT must be 1-65535"
    fi
    if [[ ! "$BACKEND_PORT" =~ ^[0-9]+$ ]] || [[ "$BACKEND_PORT" -lt 1 ]] || [[ "$BACKEND_PORT" -gt 65535 ]]; then
        err "BACKEND_PORT must be 1-65535"
    fi
    if [[ ! "$GUNICORN_WORKERS" =~ ^[1-9][0-9]*$ ]]; then
        err "GUNICORN_WORKERS must be a positive integer"
    fi

    REPO_DIR="$SCRIPT_DIR/$(basename "$REPO_URL" .git)"
    ok "Configuration loaded: REPO_DIR=$REPO_DIR WEB_PORT=$WEB_PORT"
}
```

- [ ] **Step 2: Add stub functions and `do_deploy`/`do_update`/`do_backup` placeholders**

Replace the `main` function with:

```bash
# ---------- stubs (filled in later tasks) ----------

do_deploy() {
    check_config
    install_system_deps
    clone_or_pull_repo
    setup_backend
    backup_db
    build_frontend
    configure_nginx
    setup_systemd
    setup_cron
    print_summary
}

do_update() {
    check_config
    clone_or_pull_repo
    setup_backend
    backup_db
    build_frontend
    configure_nginx
    setup_systemd
    systemctl restart "$SERVICE_NAME"
    ok "Update complete"
}

do_backup() {
    check_config
    backup_db
    ok "Backup complete"
}

install_system_deps() { info "install_system_deps (stub)"; }
clone_or_pull_repo()  { info "clone_or_pull_repo (stub)"; }
setup_backend()       { info "setup_backend (stub)"; }
backup_db()           { info "backup_db (stub)"; }
build_frontend()      { info "build_frontend (stub)"; }
configure_nginx()     { info "configure_nginx (stub)"; }
setup_systemd()       { info "setup_systemd (stub)"; }
setup_cron()          { info "setup_cron (stub)"; }
print_summary()       { info "print_summary (stub)"; }

main "$@"
```

- [ ] **Step 3: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add deploy.sh
git commit -m "feat: add check_config() and deploy/update/backup flow stubs"
```

---

### Task 4: Write `install_system_deps()` function

**Files:**
- Modify: `deploy.sh` — replace `install_system_deps()` stub

- [ ] **Step 1: Replace stub with full implementation**

Replace the `install_system_deps()` stub line with:

```bash
install_system_deps() {
    info "Checking system dependencies..."

    local need_update=false
    local missing_pkgs=""

    if ! command -v python3 &>/dev/null; then
        missing_pkgs="$missing_pkgs python3 python3-pip python3-venv"
        need_update=true
    fi
    if ! command -v nginx &>/dev/null; then
        missing_pkgs="$missing_pkgs nginx"
        need_update=true
    fi
    if ! command -v git &>/dev/null; then
        missing_pkgs="$missing_pkgs git"
        need_update=true
    fi
    if ! command -v sqlite3 &>/dev/null; then
        missing_pkgs="$missing_pkgs sqlite3"
        need_update=true
    fi
    if ! command -v curl &>/dev/null; then
        missing_pkgs="$missing_pkgs curl"
        need_update=true
    fi

    if $need_update; then
        info "Installing: $missing_pkgs"
        apt-get update -qq
        apt-get install -y -qq $missing_pkgs
    fi

    if ! command -v node &>/dev/null; then
        info "Installing Node.js 22.x..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y -qq nodejs
    fi

    ok "System dependencies ready"
    node -v
    python3 --version
    nginx -v 2>&1 | head -1
}
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add install_system_deps() with idempotent apt+node setup"
```

---

### Task 5: Write `clone_or_pull_repo()` function

**Files:**
- Modify: `deploy.sh` — replace `clone_or_pull_repo()` stub

- [ ] **Step 1: Replace stub with full implementation**

```bash
clone_or_pull_repo() {
    if [[ -d "$REPO_DIR/.git" ]]; then
        info "Repository exists, pulling latest..."
        cd "$REPO_DIR"
        git fetch origin "$REPO_BRANCH"
        local local_sha remote_sha
        local_sha=$(git rev-parse HEAD)
        remote_sha=$(git rev-parse "origin/$REPO_BRANCH")
        if [[ "$local_sha" == "$remote_sha" ]]; then
            ok "Already up to date ($local_sha)"
            return 0
        fi
        git reset --hard "origin/$REPO_BRANCH"
        ok "Updated to $remote_sha"
    else
        info "Cloning repository..."
        git clone --branch "$REPO_BRANCH" "$REPO_URL" "$REPO_DIR"
        ok "Cloned to $REPO_DIR"
    fi
}
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add clone_or_pull_repo() with git reset --hard on update"
```

---

### Task 6: Write `setup_backend()` and `backup_db()` functions

**Files:**
- Modify: `deploy.sh` — replace `setup_backend()` and `backup_db()` stubs

- [ ] **Step 1: Replace both stubs**

```bash
setup_backend() {
    info "Setting up Python virtual environment..."
    cd "$REPO_DIR/backend"

    if [[ ! -f venv/bin/python ]]; then
        python3 -m venv venv
        info "Created virtual environment"
    fi

    source venv/bin/activate
    pip install --quiet -r requirements.txt
    deactivate
    ok "Backend dependencies installed"
}

backup_db() {
    local db_path="$REPO_DIR/backend/data.db"
    if [[ ! -f "$db_path" ]]; then
        warn "No existing database to backup (first deploy?)"
        return 0
    fi
    local backup_name="$REPO_DIR/backend/data_backup_$(date +%Y%m%d_%H%M%S).db"
    cp "$db_path" "$backup_name"
    ok "Database backed up to $(basename "$backup_name")"
}
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add setup_backend() venv idempotent + backup_db()"
```

---

### Task 7: Write `build_frontend()` function

**Files:**
- Modify: `deploy.sh` — replace `build_frontend()` stub

- [ ] **Step 1: Replace stub with full implementation**

```bash
build_frontend() {
    info "Building frontend..."
    cd "$REPO_DIR/app"

    if [[ -f dist/index.html ]]; then
        if [[ dist/index.html -nt package.json ]]; then
            ok "Frontend already built (dist is newer than package.json)"
            return 0
        fi
    fi

    local avail_mem
    avail_mem=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}') || true
    if [[ -n "$avail_mem" ]] && [[ "$avail_mem" -lt 262144 ]]; then
        warn "Available memory < 256MB, npm build may fail or be slow"
    fi

    npm install --legacy-peer-deps
    npm run build
    ok "Frontend built successfully"
}
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add build_frontend() with memory check and mtime-based skip"
```

---

### Task 8: Write `configure_nginx()` function

**Files:**
- Modify: `deploy.sh` — replace `configure_nginx()` stub

- [ ] **Step 1: Replace stub with full implementation**

```bash
configure_nginx() {
    info "Configuring Nginx..."
    local site_name="frr"
    local site_file="/etc/nginx/sites-available/$site_name"
    local site_link="/etc/nginx/sites-enabled/$site_name"
    local dist_dir="$REPO_DIR/app/dist"

    cat > "$site_file" << NGINX_EOF
server {
    listen $WEB_PORT;
    server_name _;

    root $dist_dir;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_EOF

    if [[ ! -L "$site_link" ]] || [[ "$(readlink -f "$site_link")" != "$site_file" ]]; then
        ln -sf "$site_file" "$site_link"
    fi

    rm -f /etc/nginx/sites-enabled/default

    if nginx -t 2>/dev/null; then
        systemctl reload nginx 2>/dev/null || systemctl restart nginx
        ok "Nginx configured and reloaded"
    else
        err "Nginx configuration test failed"
    fi
}
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add configure_nginx() with idempotent site setup and reload"
```

---

### Task 9: Write `setup_systemd()` function

**Files:**
- Modify: `deploy.sh` — replace `setup_systemd()` stub

- [ ] **Step 1: Replace stub with full implementation**

```bash
setup_systemd() {
    info "Setting up systemd service..."
    local service_file="/etc/systemd/system/${SERVICE_NAME}.service"
    local venv_dir="$REPO_DIR/backend/venv"
    local backend_dir="$REPO_DIR/backend"

    cat > "$service_file" << SYSTEMD_EOF
[Unit]
Description=FRR System Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$backend_dir
ExecStart=$venv_dir/bin/gunicorn -w $GUNICORN_WORKERS -b 127.0.0.1:$BACKEND_PORT app:create_app()
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

    systemctl daemon-reload

    if ! systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl enable "$SERVICE_NAME"
        info "Service enabled"
    fi

    local tries=0
    while [[ $tries -lt 2 ]]; do
        if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            systemctl restart "$SERVICE_NAME"
            break
        else
            systemctl start "$SERVICE_NAME"
        fi
        sleep 2
        if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            break
        fi
        tries=$((tries + 1))
    done

    if ! systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        err "Failed to start $SERVICE_NAME after $tries attempts"
    fi
    ok "Systemd service $SERVICE_NAME is running"
}
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add setup_systemd() with retry-on-failure and auto-enable"
```

---

### Task 10: Write `setup_cron()` function

**Files:**
- Modify: `deploy.sh` — replace `setup_cron()` stub

- [ ] **Step 1: Replace stub with full implementation**

```bash
setup_cron() {
    info "Setting up weekly database backup cron..."
    local cron_file="/etc/cron.d/frr-backup"
    local db_dir="$REPO_DIR/backend"

    cat > "$cron_file" << CRON_EOF
# Weekly backup of FRR System database (Sunday 03:00, retain 90 days)
0 3 * * 0 root cp $db_dir/data.db ${db_dir}/data_backup_\$(date +\%Y\%m\%d_\%H\%M\%S).db && find $db_dir -name 'data_backup_*.db' -mtime +90 -delete
CRON_EOF

    chmod 644 "$cron_file"
    ok "Cron job installed: weekly backup at Sun 03:00"
}
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add setup_cron() for weekly db backup with 90-day retention"
```

---

### Task 11: Write `print_summary()` function

**Files:**
- Modify: `deploy.sh` — replace `print_summary()` stub

- [ ] **Step 1: Replace stub with full implementation**

```bash
print_summary() {
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}') || ip="<server-ip>"

    echo ""
    echo "========================================"
    echo -e "  ${GREEN}FRR System Deploy Complete${NC}"
    echo "========================================"
    echo ""
    echo "  Access:  http://$ip:$WEB_PORT"
    echo "  Admin:   FrrSystemAdmin"
    echo ""
    echo "  Commands:"
    echo "    ./deploy.sh update    # Update to latest"
    echo "    ./deploy.sh backup    # Manual backup"
    echo "    systemctl status $SERVICE_NAME"
    echo "    journalctl -u $SERVICE_NAME -f"
    echo ""
}
```

- [ ] **Step 2: Syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat: add print_summary() with access URL and common commands"
```

---

### Task 12: Final verification — lint and end-to-end syntax check

**Files:**
- Verify: `deploy.sh` — complete file is syntactically correct

- [ ] **Step 1: Full syntax check**

Run: `bash -n deploy.sh`
Expected: no output

- [ ] **Step 2: Verify all required functions are defined**

Run: `grep -c "^[a-z_]*() {" deploy.sh`
The following functions MUST appear: `check_config`, `install_system_deps`, `clone_or_pull_repo`, `setup_backend`, `backup_db`, `build_frontend`, `configure_nginx`, `setup_systemd`, `setup_cron`, `print_summary`, `do_deploy`, `do_update`, `do_backup`, `main`

- [ ] **Step 3: Verify `set -euo pipefail` is at top of file**

Run: `head -1 deploy.sh`
Expected: `#!/usr/bin/env bash`
Run: `grep -n "set -euo pipefail" deploy.sh`
Expected: line 2 or 3

- [ ] **Step 4: Confirm deploy.log location and .env.deploy reference are relative to SCRIPT_DIR**

Run: `grep -n 'SCRIPT_DIR' deploy.sh`
Expected: LOG_FILE, ENV_FILE, REPO_DIR all reference SCRIPT_DIR

- [ ] **Step 5: Commit**

```bash
git add deploy.sh
git commit -m "chore: final verification — syntax check and function audit passed"
```

---

### Task 13: Update project README with deploy section

**Files:**
- Modify: `README.md` — update deployment section to reference the new one-click script

- [ ] **Step 1: Update README deployment section**

Find the existing "部署到生产环境" section in README.md and replace with:

```markdown
## 部署到生产环境

### 一键部署（推荐）

适用于空白 Debian/Ubuntu 系统，全程自动安装依赖、构建前端、配置 Nginx 和 systemd。

```bash
# 1. 将 deploy.sh 和 .env.deploy 放到服务器的任意空目录
# 2. 编辑 .env.deploy，修改 REPO_URL 等参数
# 3. 运行
chmod +x deploy.sh
./deploy.sh

# 后续操作
./deploy.sh update    # 更新到最新版本
./deploy.sh backup    # 手动备份数据库
systemctl status frr-backend   # 查看后端状态
```

### 手动部署

详见 [Deploy.md](./Deploy.md)。
```

- [ ] **Step 2: Verify README renders correctly**

Check that the markdown code blocks are properly closed and formatting is correct.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add one-click deploy instructions to README"
```

---

## Post-Implementation Checklist

- [ ] `bash -n deploy.sh` passes
- [ ] `deploy.sh` contains all 13 functions listed in Task 12 Step 2
- [ ] `.env.deploy` has all 6 parameters
- [ ] README references the new deploy method
- [ ] All commits are atomic and well-named
