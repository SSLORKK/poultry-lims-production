# Docker Quick Start Guide

## ✅ Your LIMS Application is Running!

All services are successfully running in Docker containers.

## 🌐 Access Your Application

- **Frontend (Web Interface)**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Database**: PostgreSQL on localhost:5432

## 🔑 Default Login Credentials

- **Username**: `sslork`
- **Password**: `sslork634827@@##`
- **Email**: `sslork@lims.local`

⚠️ **Important**: Keep this password secure!

## 📋 Common Docker Commands

### View Running Containers
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Stop All Services
```bash
docker-compose down
```

### Start All Services
```bash
docker-compose up -d
```

### Restart After Code Changes
```bash
docker-compose up -d --build
```

### Restart Single Service
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Stop and Remove Everything (including database data)
```bash
docker-compose down -v
```

## 🗄️ Database Management

### Access PostgreSQL
```bash
docker-compose exec db psql -U lims_user -d lims_db
```

### Backup Database
```bash
docker-compose exec db pg_dump -U lims_user lims_db > backup.sql
```

### Restore Database
```bash
docker-compose exec -T db psql -U lims_user -d lims_db < backup.sql
```

## 🔧 Troubleshooting

### Check Service Status
```bash
docker-compose ps
```

### View Service Logs
```bash
docker-compose logs backend --tail=100
```

### Restart a Service
```bash
docker-compose restart backend
```

### Rebuild from Scratch
```bash
docker-compose down -v
docker-compose up -d --build
```

## 📁 Project Structure

```
.
├── docker-compose.yml          # Main orchestration file
├── backend/
│   ├── Dockerfile             # Backend container
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile             # Frontend container
│   ├── nginx.conf             # Nginx config
│   └── .dockerignore
└── DOCKER.md                  # Full documentation
```

## 🚀 What's Running?

1. **PostgreSQL Database** (lims_db)
   - Port: 5432
   - User: lims_user
   - Database: lims_db

2. **FastAPI Backend** (lims_backend)
   - Port: 8000
   - Auto-reload enabled
   - Database initialized with tables

3. **React Frontend** (lims_frontend)
   - Port: 3000 (mapped to container port 80)
   - Served by Nginx
   - Production build

## 📖 Full Documentation

For detailed information, see `DOCKER.md`

## 🎉 You're All Set!

Your LIMS application is now running in Docker containers. Open http://localhost:3000 in your browser to get started!
