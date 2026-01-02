# Longhorn: Enterprise Local Data Server

Longhorn is a high-performance local data server designed for Kinefinity, optimized for Mac mini M1 with dual-disk redundancy.

## Features
- **MacOS 26 UI**: Ultra-modern glassmorphism design.
- **Admin-Managed Auth**: Secure user creation and role management.
- **Disk Redundancy**: Automated rsync backup from Disk A to Disk B.
- **Public Tunneling**: Professional sharing links via UUID-based mapping.

## Setup Instructions

### 1. Server Configuration
```bash
cd server
npm start
```
Default Admin: `admin` / `admin123`

### 2. Client Access
```bash
cd client
npm run dev
```
Accessible at [http://localhost:3001](http://localhost:3001)

### 3. Tunneling (opware.kineraw.com)

1. Sign up for Cloudflare and add the domain `kineraw.com`.
2. Install `cloudflared` on the M1 server.
3. Authenticate and create a tunnel.
4. Add a CNAME record for `opware.kineraw.com` pointing to your tunnel ID.

---
© 2026 Kinefinity Team. Design by Longhorn.
