# Docker Setup for LIMS Project

This guide explains how to run the LIMS project using Docker and Docker Compose.

## Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** (included with Docker Desktop)

Download Docker Desktop: https://www.docker.com/products/docker-desktop

## Project Architecture

The Docker setup includes three services:

1. **PostgreSQL Database** (`db`) - Port 5432
2. **FastAPI Backend** (`backend`) - Port 8000
3. **React Frontend** (`frontend`) - Port 3000

## Quick Start

### 1. Start All Services

From the project root directory, run:

```bash
docker-compose up -d
```

This will:
- Build the backend and frontend Docker images
- Start PostgreSQL database
- Initialize the database with tables and default admin user
- Start the backend API server
- Start the frontend web server

### 2. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### 3. Default Login Credentials

Check `LOGIN_CREDENTIALS.md` for default admin credentials.

## Docker Commands

### Start Services (Detached Mode)
```bash
docker-compose up -d
```

### Start Services (With Logs)
```bash
docker-compose up
```

### Stop Services
```bash
docker-compose down
```

### Stop Services and Remove Volumes (Clean Slate)
```bash
docker-compose down -v
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

### Rebuild Images (After Code Changes)
```bash
docker-compose up -d --build
```

### Restart a Specific Service
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Check Service Status
```bash
docker-compose ps
```

## Environment Variables

### Backend Environment Variables

The backend service uses these environment variables (configured in `docker-compose.yml`):

- `DATABASE_URL` - PostgreSQL connection string
- `PROJECT_NAME` - API project name
- `SECRET_KEY` - JWT secret key (⚠️ **Change in production!**)
- `ALGORITHM` - JWT algorithm (HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration time

### Customizing Environment Variables

To customize environment variables:

1. Create a `.env` file in the project root:
```bash
# Database
POSTGRES_USER=lims_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=lims_db

# Backend
SECRET_KEY=your-very-secure-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

2. Update `docker-compose.yml` to use the `.env` file:
```yaml
services:
  db:
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
```

## Database Management

### Access PostgreSQL Database
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

### Reset Database
```bash
# Stop services and remove volumes
docker-compose down -v

# Start services again (will recreate database)
docker-compose up -d
```

## Development Workflow

### Making Backend Changes

1. Edit backend code
2. Rebuild and restart:
```bash
docker-compose up -d --build backend
```

### Making Frontend Changes

1. Edit frontend code
2. Rebuild and restart:
```bash
docker-compose up -d --build frontend
```

### Hot Reload (Development Mode)

For development with hot reload, you can mount your code as volumes in `docker-compose.yml`:

```yaml
backend:
  volumes:
    - ./backend:/app
    - ./backend/uploads:/app/uploads
  command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

1. Check what's using the port:
```bash
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :3000
netstat -ano | findstr :5432

# Linux/Mac
lsof -i :8000
lsof -i :3000
lsof -i :5432
```

2. Change the port in `docker-compose.yml`:
```yaml
ports:
  - "8001:8000"  # Use port 8001 instead
```

### Database Connection Issues

If the backend can't connect to the database:

1. Check database is healthy:
```bash
docker-compose ps
```

2. Check database logs:
```bash
docker-compose logs db
```

3. Verify database is ready:
```bash
docker-compose exec db pg_isready -U lims_user -d lims_db
```

### Container Won't Start

1. Check logs:
```bash
docker-compose logs backend
docker-compose logs frontend
```

2. Rebuild from scratch:
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Frontend Can't Connect to Backend

1. Check backend is running:
```bash
curl http://localhost:8000/health
```

2. Verify frontend environment:
- Frontend should connect to `http://localhost:8000` from the browser
- Update `frontend/.env.example` if needed

### Permission Issues (Linux/Mac)

If you encounter permission issues with uploads:

```bash
sudo chown -R $USER:$USER backend/uploads
chmod -R 755 backend/uploads
```

## Production Deployment

### Security Checklist

Before deploying to production:

1. ✅ Change `SECRET_KEY` to a strong, random value
2. ✅ Use strong database passwords
3. ✅ Update CORS settings in backend to allow only your domain
4. ✅ Enable HTTPS/SSL
5. ✅ Set up proper backup strategy
6. ✅ Configure proper logging
7. ✅ Remove development tools and debug mode

### Production docker-compose.yml Example

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - lims_network

  backend:
    build: ./backend
    restart: always
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      SECRET_KEY: ${SECRET_KEY}
    volumes:
      - ./backend/uploads:/app/uploads
    networks:
      - lims_network

  frontend:
    build: ./frontend
    restart: always
    ports:
      - "80:80"
    networks:
      - lims_network

volumes:
  postgres_data:

networks:
  lims_network:
    driver: bridge
```

## File Structure

```
.
├── docker-compose.yml          # Main orchestration file
├── .dockerignore              # Root dockerignore
├── backend/
│   ├── Dockerfile             # Backend container definition
│   ├── .dockerignore          # Backend-specific ignores
│   └── ...
├── frontend/
│   ├── Dockerfile             # Frontend container definition
│   ├── nginx.conf             # Nginx configuration
│   ├── .dockerignore          # Frontend-specific ignores
│   └── ...
└── DOCKER.md                  # This file
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Docker Documentation](https://fastapi.tiangolo.com/deployment/docker/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Review this documentation
3. Check Docker and Docker Compose versions
4. Ensure all prerequisites are installed
