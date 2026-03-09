# Longhorn Deployment Guide

## Quick Start

### Option 1: Using Deploy Script (Recommended)

```bash
# Fast deployment (incremental, ~5s)
./scripts/deploy.sh

# Full deployment (complete rebuild, ~60s)
./scripts/deploy.sh --full

# With git push
./scripts/deploy.sh --git

# Force server sync
./scripts/deploy.sh --force-server
```

### Option 2: Using Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# With Nginx reverse proxy
docker-compose --profile with-nginx up -d

# View logs
docker-compose logs -f longhorn
```

### Option 3: Manual Deployment

```bash
# On server, run setup once
./scripts/setup-server.sh

# Build locally
cd client && npm run build && cd ..

# Sync to server
rsync -avz --delete client/dist/ server/ user@host:/path/to/longhorn/

# Restart on server
ssh user@host "cd /path/to/longhorn/server && pm2 reload longhorn"
```

## Server Requirements

- Node.js 20+
- PM2 (for process management)
- Docker & Docker Compose (optional)
- Nginx (optional, for reverse proxy)

## Environment Variables

Create `.env` file in `server/` directory:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=your-secret-key
DB_PATH=/path/to/data/longhorn.db
```

## CI/CD (GitHub Actions)

Configure secrets in GitHub repository:
- `SSH_PRIVATE_KEY`: SSH private key for deployment
- `SSH_HOST`: Server IP or hostname
- `SSH_USER`: SSH username

Push to `main` branch triggers automatic deployment.

## Troubleshooting

```bash
# Check PM2 status
pm2 status
pm2 logs longhorn

# Restart application
pm2 reload longhorn

# Clear build cache
rm -rf .deploy_cache

# Docker cleanup
docker-compose down
docker system prune -a
```
