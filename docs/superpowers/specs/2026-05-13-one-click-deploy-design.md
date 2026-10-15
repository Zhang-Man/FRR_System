> 历史设计文档（开源存档）：写作时使用旧角色命名（教师/学生运维 = 现提交人/处理人）与旧 API 路径（/api/students = 现 /api/handlers），内容未按新命名改写。

# One-Click Deploy Script Design

## Context

FRR System targets bare LXC Debian containers (2G RAM, 2 CPU, clean OS) with no Docker. Users need a docker-compose-like one-click deploy experience: drop two files in an empty directory, fill in config, run one command.

## Deliverables

Two files, placed in any empty directory:

```
any-dir/
├── .env.deploy     # user-editable config (6 params)
└── deploy.sh       # single entry point, idempotent
```

## Commands

```bash
./deploy.sh          # first-time deploy (idempotent)
./deploy.sh update   # update to latest version
./deploy.sh backup   # manual database backup
```

## Configuration (.env.deploy)

| Param | Purpose | Example |
|-------|---------|---------|
| `REPO_URL` | Git clone source | `https://github.com/<your-name>/<your-repo>.git` |
| `REPO_BRANCH` | Git branch | `main` |
| `WEB_PORT` | Nginx listen port | `80` |
| `BACKEND_PORT` | Gunicorn internal port | `5000` |
| `GUNICORN_WORKERS` | Worker count | `4` |
| `SERVICE_NAME` | systemd unit name | `frr-backend` |

## Execution Flow

Each step is a function in `deploy.sh`. Every function is idempotent — safe to re-run.

| Step | Idempotency Check | Failure Behavior |
|------|-------------------|-----------------|
| `check_config` | — (always runs) | Abort: `.env.deploy` missing or params empty |
| `install_system_deps` | Check each binary exists (`nginx`, `node`, `python3`, `git`, `sqlite3`) | Abort: network or package source unreachable |
| `clone_or_pull_repo` | Dir exists → `git pull`; else → `git clone` | Abort: repo URL wrong or network down |
| `setup_backend` | Check `backend/venv/bin/python` exists; reuse if present | Abort: pip install failure |
| `backup_db` | Only if `backend/data.db` exists | Warn + continue: first deploy has no db |
| `build_frontend` | Check `app/dist/index.html` exists and `app/package.json` unchanged since last build | Abort: npm install or vite build failure |
| `configure_nginx` | Check `/etc/nginx/sites-enabled/frr` symlink points correctly | Abort: nginx config syntax error |
| `setup_systemd` | `systemctl is-enabled --quiet $SERVICE_NAME` | Retry once, then abort |
| `setup_cron` | Check `/etc/cron.d/frr-backup` exists | Abort: file write permission denied |

## Runtime Architecture

After deploy, the container runs:

```
                    LXC Debian
┌─────────────────────────────────────────────┐
│  Nginx :WEB_PORT  ──/api/*──>  Gunicorn :BACKEND_PORT  │
│  ├─ / → app/dist/              ├─ backend/             │
│  │                             ├─ venv/                │
│  └─ systemd: enabled           └─ data.db              │
│                                                         │
│  Cron: weekly backup at Sun 03:00, 90-day retention     │
└─────────────────────────────────────────────────────────┘
```

## Error Handling

- `set -euo pipefail` at script top; any unexpected error aborts immediately
- Colored output: green (ok), yellow (warn), red (error)
- All output telegraphed to both terminal and `deploy.log` in project root
- `git pull` failure on update aborts (user may have local changes)

## Constraints

- Runs as root (required for apt, systemctl, nginx config)
- Requires internet access during deploy/update
- npm build may require ~500MB memory; script warns if available RAM < 256MB
- Debian only (apt package manager assumed)

## Out of Scope

- Multi-host / cluster deployment
- HTTPS / TLS termination (user adds Certbot separately)
- Database migration between SQLite versions
- Rollback command (manual: restore backup db + `git checkout` previous tag + `./deploy.sh update`)
