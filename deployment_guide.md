# 🚀 Production Deployment Guide: Manage-My-Gate

This guide covers the deployment of the **Manage-My-Gate** portal using the **Pull and Push** method. You will build and push the Docker images from your local machine and set up the server to pull and run them.

---

## 1. Local Image Build and Push

To deploy the application, you first need to build the Docker images locally and push them to your Docker registry (e.g., Docker Hub).

### Prerequisites
- Docker installed and running on your local machine.
- Logged in to your Docker registry: `docker login` (default registry namespace is `atocash`).

#### 1. Backend Build and Push
```bash
cd backend
docker build --no-cache -t atocash/manage-my-gate-server:prd1.0 -t atocash/manage-my-gate-server:latest .
docker push atocash/manage-my-gate-server:prd1.0
docker push atocash/manage-my-gate-server:latest
```

#### 2. Frontend Build and Push (Vite compiles environment variables at build-time)

**Single-Line (Recommended for Windows PowerShell / Command Prompt):**
```bash
cd ../frontend
docker build --no-cache -t atocash/manage-my-gate-client:prd1.0 -t atocash/manage-my-gate-client:latest --build-arg VITE_API_URL="https://managemygate.e3esg.com/api" --build-arg VITE_GOOGLE_CLIENT_ID="your_google_client_id_here" --build-arg VITE_MICROSOFT_CLIENT_ID="your_microsoft_client_id_here" --build-arg VITE_MICROSOFT_TENANT_ID="your_microsoft_tenant_id_here" .
docker push atocash/manage-my-gate-client:prd1.0
docker push atocash/manage-my-gate-client:latest
```

**Linux / macOS / Git Bash (Multi-line with `\`):**
```bash
cd ../frontend
docker build --no-cache -t atocash/manage-my-gate-client:prd1.0 -t atocash/manage-my-gate-client:latest \
  --build-arg VITE_API_URL="https://managemygate.e3esg.com/api" \
  --build-arg VITE_GOOGLE_CLIENT_ID="your_google_client_id_here" \
  --build-arg VITE_MICROSOFT_CLIENT_ID="your_microsoft_client_id_here" \
  --build-arg VITE_MICROSOFT_TENANT_ID="your_microsoft_tenant_id_here" .
docker push atocash/manage-my-gate-client:prd1.0
docker push atocash/manage-my-gate-client:latest
```

---

## 2. Server Preparation

Connect to your Ubuntu server via SSH and perform the following steps:

### 2.1. Install Docker & Compose
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install docker.io docker-compose -y
sudo systemctl enable --now docker
```

### 2.2. Directory Setup
```bash
sudo mkdir -p /opt/manage-my-gate
sudo chown $USER:$USER /opt/manage-my-gate
cd /opt/manage-my-gate
```

---

## 3. Deployment Steps on Server

### 3.1. Secret Configuration (.env)
Create a `.env` file in the root directory (`/opt/manage-my-gate`) to store environment configurations and secrets.

```bash
cat <<EOF > .env
# Image Settings
IMAGE_NAME=nahom
IMAGE_TAG=prd1.0
BACKEND_IMAGE=nahom:prd1.0
FRONTEND_IMAGE=nahom-frontend:prd1.0

# External Port Configurations (Available ports: 5007 & 3005; or 5006 & 3004 if replacing running containers)
CLIENT_PORT=3005
SERVER_PORT=5007
MONGO_EXPRESS_PORT=8082
DB_PORT_EXTERNAL=27019
REDIS_PORT_EXTERNAL=6379

# Database Credentials
MONGO_ROOT_USER=manageadmin
MONGO_ROOT_PASSWORD=your_secure_mongo_password_here

# Database Connection URI (Note: @ in password is URL-encoded as %40)
# For Docker Containers (backend -> mongodb):
MONGODB_URI=mongodb://manageadmin:your_secure_mongo_password_here@mongodb:27017/manage_my_gate_prod?replicaSet=rs0&authSource=admin
# For MongoDB Compass via PuTTY SSH Tunnel (Port Forward 27019 -> localhost:27019):
# MONGODB_URI=mongodb://manageadmin:your_secure_mongo_password_here@localhost:27019/manage_my_gate_prod?directConnection=true&authSource=admin

# Redis Cache URI (use redis://redis:6379 for containerized Redis)
REDIS_URL=redis://redis:6379

# Encryption Keys (Use strong 32-byte hex keys for production)
JWT_SECRET=your_production_jwt_secret_here
SESSION_SECRET=your_production_session_secret_here
ENCRYPTION_KEY=your_production_32_byte_hex_encryption_key_here

# Initial Super Admin Account Setup (bootstrapped on startup)
SUPER_ADMIN_EMAIL=admin@your-domain.com
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=your_secure_superadmin_password_here

# Enterprise SSO Credentials (Google & Microsoft)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
MICROSOFT_TENANT_ID=your_microsoft_tenant_id_here

# Application Settings
NODE_ENV=production
CLIENT_URL=https://managemygate.e3esg.com
ALLOWED_ORIGINS=https://managemygate.e3esg.com

# Docker Build Arguments (Vite compiles environment variables at build-time)
VITE_API_URL=/api
VITE_SOCKET_URL=
EOF
```

### 3.2. Docker Compose Configuration
Transfer the `docker-compose.yml` file from your local project to `/opt/manage-my-gate` on the server.

### 3.3. Start Services

#### Option A: Pull Pre-built Images from Registry (Local Build Workflow)
```bash
# Pull latest images from Docker Hub
docker-compose pull

# Start containers in detached mode
docker-compose up -d
```

#### Option B: Build Images Directly on Hosted Server (Git Pull Workflow)
```bash
# Pull latest code from remote repository
git pull upstream develop

# Build Docker images locally on server (--no-cache ensures Vite bakes updated .env build arguments)
docker-compose build --no-cache

# Start containers in detached mode
docker-compose up -d
```

---

## 4. Port Allocations
- **Database (MongoDB)**: `27019` (External host mapping to container port 27017)
- **Cache (Redis)**: `6379` (External host mapping to container port 6379)
- **Frontend (React)**: `3004` (External host mapping to container port 80)
- **Backend (Node API)**: `5006` (External host mapping to container port 5000)

---

## 5. Maintenance Commands

### 🔄 Updating the Application

#### Option A: Docker Registry Push/Pull Update
```bash
# On server: pull updated pre-built images and restart containers
docker-compose pull
docker-compose up -d
```

#### Option B: In-Place Server Source Code Build Update
```bash
# On server: pull latest code, rebuild images without cache, and restart containers
git pull upstream develop
docker-compose down
docker-compose up -d --build --force-recreate
```

### 🛑 Stopping the Application
```bash
docker-compose down
```

### 🧹 Cleaning Up
Remove unused dangling images and build caches to free up disk space:
```bash
docker image prune -a
```

---

## 6. Host Nginx Configuration (Reverse Proxy)

Since you are using Nginx installed directly on the Ubuntu host, you need to configure it to route web traffic to the running Docker containers. 

This configuration maps both the frontend portal and the backend API under the single domain **`managemygate.e3esg.com`**.

### 6.1. Configuration File
Edit the default Nginx configuration file `/etc/nginx/sites-available/default`:

```nginx
server {
    listen 80;
    server_name managemygate.e3esg.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name managemygate.e3esg.com;

    ssl_certificate /etc/letsencrypt/live/managemygate.e3esg.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/managemygate.e3esg.com/privkey.pem;

    # 1. Backend API Routing (Node.js running on port 5006)
    location /api {
        proxy_pass http://127.0.0.1:5006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Backend Static Assets & Uploads (Node.js running on port 5006)
    location /public {
        proxy_pass http://127.0.0.1:5006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads {
        proxy_pass http://127.0.0.1:5006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 3. Swagger JSON & Swagger Assets Routing (Node.js running on port 5006)
    location /swagger.json {
        proxy_pass http://127.0.0.1:5006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location ~* ^/swagger-ui {
        proxy_pass http://127.0.0.1:5006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 4. Mongo Express Web GUI Routing (Mongo Express running on port 8081)
    location /mongo-express {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 5. Socket.IO Real-Time WebSockets (Node.js Backend running on port 5006)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 6. Frontend React Client Routing (React running on port 3004)
    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.2. Test and Restart Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. SSL Configuration (Certbot / Let's Encrypt)

To secure your production domain with a free SSL certificate:

### 7.1. Install Certbot
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### 7.2. Generate SSL Certificate
Because your Nginx configuration references the SSL certificate files before they are generated, Nginx will fail to test or start (a "chicken-and-egg" problem). 

To resolve this, temporarily stop Nginx to free up port 80, run Certbot in standalone mode to generate the certificates, and then start Nginx:

```bash
# 1. Stop Nginx temporarily to free up port 80
sudo systemctl stop nginx

# 2. Generate the SSL certificates
sudo certbot certonly --standalone -d managemygate.e3esg.com

# 3. Start Nginx (it will now find the generated certificates and start successfully)
sudo systemctl start nginx
```

### 7.3. Automated Renewal
Let's Encrypt certificates are valid for 90 days. Certbot automates renewal. You can test it by running:
```bash
sudo certbot renew --dry-run
```

---

## 8. Firewall Settings

Ensure the firewall is enabled and ports `80` (HTTP) and `443` (HTTPS) are open:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## 9. Connecting to MongoDB Compass via PuTTY / SSH Tunnel

### Option A: Using PuTTY Port Forwarding (Recommended for PuTTY Users)
When using **PuTTY** to connect to your remote server:

1. **Configure PuTTY Tunneling**:
   * Open **PuTTY**.
   * Navigate to **Connection → SSH → Tunnels**.
   * **Source port**: `27019`
   * **Destination**: `localhost:27019` (or `127.0.0.1:27019`)
   * Click **Add**.
   * Go back to **Session**, type your server Host IP / Domain, save the session, and click **Open** to log in.

2. **Connect in MongoDB Compass**:
   Use the connection string below with `directConnection=true` and `authSource=admin` so Compass connects directly without attempting to resolve internal Docker replica set hostnames (`mongodb:27017`):
   ```text
   mongodb://manageadmin:ManageAdminPwd%40123@localhost:27019/manage_my_gate_prod?directConnection=true&authSource=admin
   ```

### Option C: Web-Based Visual Manager (Mongo Express Container — Port 8081)
You can view and manage all MongoDB collections directly in your web browser using the included **Mongo Express** container.

1. **Access URL**: Open `http://<YOUR_SERVER_IP>:8081` in your browser.
2. **Basic Auth Credentials**:
   * **Username**: `admin`
   * **Password**: `admin123`
3. **Features**:
   * View all databases and collections visually (`manage_my_gate_prod`, `users`, `organizations`, `villas`, `roles`, etc.).
   * Insert, edit, delete, search, and export MongoDB documents directly in the UI without installing Compass or setting up SSH tunnels.

---

## 10. Troubleshooting & Common Fixes

### 🔴 Issue 1: `MongoServerError: Transaction numbers are only allowed on a replica set member or mongos`
* **Check status**: Run `docker exec -it mmg-mongodb mongosh --eval "rs.status()"`
* **Fix**: If no replica set exists, run:
  ```bash
  docker exec -it mmg-mongodb mongosh --eval "rs.initiate({ _id: 'rs0', members: [ { _id: 0, host: 'mongodb:27017' } ] })"
  ```

### 🔴 Issue 2: `MongoServerSelectionError: getaddrinfo ENOTFOUND mongodb` when using PuTTY
* **Fix**: Add `?directConnection=true` to your MongoDB URI in Compass, or add `127.0.0.1 mongodb` to your local `C:\Windows\System32\drivers\etc\hosts` file.

### 🔴 Issue 3: `BadValue: security.keyFile is required when authorization is enabled with replica sets`
* **Root Cause**: In MongoDB, enabling root user authentication (`MONGO_INITDB_ROOT_USERNAME`) alongside a replica set (`--replSet rs0`) requires a keyFile for internal cluster authentication.
* **Fix**: The updated `docker-compose.yml` automatically generates a valid `/data/db/replica.key` (with permissions `400`) on container boot.
* **Restarting Services Cleanly**:
  ```bash
  # Stop containers and remove invalid initial data volume if needed
  docker-compose down -v
  
  # Start containers with updated docker-compose.yml
  docker-compose up -d
  ```

### 🔴 Issue 4: `Authentication failed` in MongoDB Compass
* **Root Cause**: `MONGO_INITDB_ROOT_USERNAME` in MongoDB Docker only runs when the `/data/db` volume is created for the first time. If the container previously started without root user environment variables, MongoDB skipped creating the `manageadmin` user.
* **Fix**: Run this command on your server to create or reset the `manageadmin` user in the `admin` database:
  ```bash
  # Linux / Bash:
  docker exec -it mmg-mongodb mongosh admin --eval 'db.createUser({ user: "manageadmin", pwd: "ManageAdminPwd@123", roles: [ { role: "root", db: "admin" } ] })'

  # Windows PowerShell:
  docker exec -it mmg-mongodb mongosh admin --eval "db.createUser({ user: 'manageadmin', pwd: 'ManageAdminPwd@123', roles: [ { role: 'root', db: 'admin' } ] })"
  ```

### 🔴 Issue 5: Container crashes immediately on startup
* **Check logs**:
  ```bash
  docker-compose logs backend
  ```
* **Common Cause**: Missing required environment variables (`JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `MONGODB_URI`) in `.env`. Ensure all keys are set properly.
