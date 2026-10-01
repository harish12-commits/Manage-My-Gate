# 🚀 Nahom (Manage-My-Gate) Production Deployment & Operations Guide
**Docker Image Tag:** `prd1.0`  
**Target Systems:** Ubuntu Server / Docker Desktop / Cloud VPS  
**Domain:** `managemygate.e3esg.com`

---

## 1. Executive Summary

This guide documents the production deployment of the **Nahom** gated community platform with the release tag **`prd1.0`**. It addresses image build pipelines, available port mapping without downtime, zero-conflict container orchestration, database persistence, and reverse proxy routing.

### Built Docker Images
| Component | Image Name & Tag | Container Name | Target Internal Port | Host Mapped Port |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | `nahom:prd1.0` | `nahom-backend` | `5000` | `5007` (or `5006` in-place) |
| **Web Frontend** | `nahom-frontend:prd1.0` | `nahom-frontend` | `80` | `3005` (or `3004` in-place) |
| **Database UI** | `mongo-express:latest` | `nahom-mongo-express` | `8081` | `8082` (or `8081` in-place) |
| **Database** | `mongo:7.0.14` | `mmg-mongodb` | `27017` | `27019` |
| **Cache Store** | `redis:alpine` | `mmg-redis` | `6379` | `6379` |

---

## 2. Port Conflict Analysis & Allocation

### Active Server Containers (Existing Baseline)
If your host already runs the previous stack:
- `mmg-frontend` on port `3004`
- `mmg-backend` on port `5006`
- `mmg-mongo-express` on port `8081`
- `mmg-mongodb` on port `27019`
- `mmg-redis` on port `6379`

### Chosen Port Strategy for `nahom:prd1.0`
To avoid `bind: address already in use` and `container name in use` errors, [`docker-compose.yml`](file:///d:/atominos/GatedCommunity/docker-compose.yml) is parameterized:

```text
Backend Host Port:  5007 (Available free port)
Frontend Host Port: 3005 (Available free port)
Mongo Express Port: 8082 (Available free port)
```

---

## 3. Build & Packaging Instructions

### Option A: Using Pre-Configured Automation Scripts

#### On Windows (PowerShell):
```powershell
# Build locally without pushing to Docker Hub:
.\build-and-push.ps1 -SkipPush

# Build and push to Docker Hub registry:
.\build-and-push.ps1
```

#### On Linux / macOS (Bash):
```bash
chmod +x ./build-and-push.sh

# Build locally without pushing:
./build-and-push.sh nahom prd1.0 atocash true

# Build and push:
./build-and-push.sh nahom prd1.0 atocash false
```

#### Using Monorepo npm Commands:
```bash
# Build both services:
npm run docker:build

# Build backend API only:
npm run docker:build:backend

# Build frontend UI only:
npm run docker:build:frontend
```

### Option B: Manual Docker CLI Commands
```bash
# 1. Backend Build
docker build \
  -t nahom:prd1.0 \
  -t nahom:latest \
  -t atocash/manage-my-gate-server:prd1.0 \
  ./backend

# 2. Frontend Build (with build-time environment args baked into Vite bundle)
docker build \
  -t nahom-frontend:prd1.0 \
  -t nahom-frontend:latest \
  -t atocash/manage-my-gate-client:prd1.0 \
  --build-arg VITE_API_URL="/api" \
  --build-arg VITE_SOCKET_URL="" \
  --build-arg VITE_GOOGLE_CLIENT_ID="610778456829-edvpd6gcav2u31jo0p2aeligfopvqfbo.apps.googleusercontent.com" \
  --build-arg VITE_MICROSOFT_CLIENT_ID="00000000-0000-0000-0000-000000000000" \
  --build-arg VITE_MICROSOFT_TENANT_ID="common" \
  ./frontend
```

---

## 4. Deployment Workflows on Server

### Workflow 1: Parallel / Blue-Green Run (Available Ports `5007` & `3005`)
Use this workflow to test and verify `nahom:prd1.0` in live runtime while leaving existing containers undisturbed:

```bash
# Start backend and frontend on available ports 5007 & 3005:
docker compose up -d backend frontend
```

Verify service status:
```bash
docker ps --filter "name=nahom"
```
Endpoints:
- **Backend API:** `http://<server-ip>:5007/api/health` (or `/api`)
- **Frontend Portal:** `http://<server-ip>:3005`

---

### Workflow 2: In-Place Upgrade (Replace Previous Containers on Ports `5006` & `3004`)
Use this workflow when you are ready to cut over the primary production ports:

```bash
# 1. Stop and remove the old application containers (MongoDB & Redis remain running!)
docker stop mmg-backend mmg-frontend
docker rm mmg-backend mmg-frontend

# 2. Start nahom:prd1.0 on primary ports 5006 & 3004
SERVER_PORT=5006 CLIENT_PORT=3004 BACKEND_CONTAINER_NAME=mmg-backend FRONTEND_CONTAINER_NAME=mmg-frontend docker compose up -d backend frontend
```

---

## 5. Environment Configuration Template (`.env`)

Place this file at `/opt/manage-my-gate/.env` on the host server:

```dotenv
# ==============================================================================
# Container Image Settings
# ==============================================================================
IMAGE_NAME=nahom
IMAGE_TAG=prd1.0
BACKEND_IMAGE=nahom:prd1.0
FRONTEND_IMAGE=nahom-frontend:prd1.0

# ==============================================================================
# Port Mappings
# ==============================================================================
# Use 5007/3005 for parallel run, or 5006/3004 for primary upgrade
SERVER_PORT=5007
CLIENT_PORT=3005
MONGO_EXPRESS_PORT=8082
DB_PORT_EXTERNAL=27019
REDIS_PORT_EXTERNAL=6379

# ==============================================================================
# Database & Cache Credentials
# ==============================================================================
MONGO_ROOT_USER=manageadmin
MONGO_ROOT_PASSWORD=your_secure_mongo_password_here

# For Docker Containers inside mmg-network (backend -> mongodb):
MONGODB_URI=mongodb://manageadmin:your_secure_mongo_password_here@mongodb:27017/manage_my_gate_prod?replicaSet=rs0&authSource=admin

# Redis Cache URI
REDIS_URL=redis://redis:6379

# ==============================================================================
# Security & Cryptographic Secrets
# ==============================================================================
JWT_SECRET=generate_with_openssl_rand_hex_32
JWT_REFRESH_SECRET=generate_with_openssl_rand_hex_32
SESSION_SECRET=generate_with_openssl_rand_base64_32
ENCRYPTION_KEY=generate_with_openssl_rand_base64_32
VAULT_ENCRYPTION_KEY=generate_with_openssl_rand_base64_32

# ==============================================================================
# Initial Super Admin Bootstrap
# ==============================================================================
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=YourSecurePassword123!

# ==============================================================================
# SSO & OAuth Credentials
# ==============================================================================
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000
MICROSOFT_TENANT_ID=common

# ==============================================================================
# App URLs & CORS
# ==============================================================================
NODE_ENV=production
CLIENT_URL=https://managemygate.e3esg.com
APP_CLIENT_URL=https://managemygate.e3esg.com
WEB_CLIENT_URL=https://managemygate.e3esg.com
ALLOWED_ORIGINS=https://managemygate.e3esg.com
TZ=Asia/Kolkata
```

---

## 6. Host Nginx Reverse Proxy Setup

When pointing live traffic (`https://managemygate.e3esg.com`) to the new container ports (`5007` & `3005`), update `/etc/nginx/sites-available/default`:

```nginx
server {
    listen 80;
    server_name managemygate.e3esg.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name managemygate.e3esg.com;

    ssl_certificate /etc/letsencrypt/live/managemygate.e3esg.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/managemygate.e3esg.com/privkey.pem;

    # 1. API Route -> nahom:prd1.0 (Port 5007)
    location /api {
        proxy_pass http://127.0.0.1:5007;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. WebSockets Route (Socket.IO) -> nahom:prd1.0 (Port 5007)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5007;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 3. Static Assets & Uploads -> nahom:prd1.0 (Port 5007)
    location /public {
        proxy_pass http://127.0.0.1:5007;
    }
    location /uploads {
        proxy_pass http://127.0.0.1:5007;
    }

    # 4. Frontend Web App -> nahom-frontend:prd1.0 (Port 3005)
    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx after editing:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Diagnostics & Operational Runbook

### Inspecting Container Logs
```bash
# Backend logs
docker logs -f nahom-backend --tail 100

# Frontend Nginx logs
docker logs -f nahom-frontend --tail 100
```

### Checking MongoDB Replica Set Status
```bash
docker exec -it mmg-mongodb mongosh --eval "rs.status().ok"
```

### Rollback Plan
If an instant rollback to the previous version is required:
```bash
# Stop new containers
docker compose stop backend frontend

# Re-enable the previous containers (if preserved)
docker start mmg-backend mmg-frontend

# Or relaunch with IMAGE_TAG=latest:
IMAGE_TAG=latest docker compose up -d backend frontend
```
