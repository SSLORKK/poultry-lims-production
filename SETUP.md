# LIMS Project Setup Guide

## Overview
This Laboratory Information Management System (LIMS) has been successfully set up with all dependencies installed and configured.

## Project Structure

```
.
├── backend/              # FastAPI backend
│   ├── app/             # Application code
│   ├── requirements.txt # Python dependencies
│   └── .env.example     # Environment variables template
├── frontend/            # React frontend
│   ├── src/            # Source code
│   ├── package.json    # Node.js dependencies
│   ├── .env.example    # Frontend environment template
│   └── DEPENDENCIES.md # Dependencies documentation
└── SETUP.md            # This file
```

## ✅ Completed Setup Steps

1. **Backend Dependencies Installed** (`requirements.txt`)
   - FastAPI, SQLAlchemy, Alembic
   - Authentication (JWT, bcrypt, passlib)
   - Database drivers (psycopg2-binary)
   - All other required packages

2. **Frontend Dependencies Installed** (`package.json`)
   - React 19.0, React Router
   - Axios, TanStack Query
   - Tailwind CSS, Recharts
   - All development tools

3. **PostgreSQL Database Configured**
   - Database automatically created by Replit
   - DATABASE_URL environment variable is available
   - Connection pooling configured in the backend

4. **Environment Files Created**
   - `backend/.env.example` - Backend configuration template
   - `frontend/.env.example` - Frontend configuration template

## Database Connection

The DATABASE_URL is **automatically provided by Replit** as an environment variable. You don't need to manually configure it!

### How It Works
- Replit's PostgreSQL database is already running
- The environment variable `DATABASE_URL` is automatically set
- Your backend reads this variable from `backend/app/core/config.py`
- No manual .env file needed in Replit environment

### For Local Development (Outside Replit)
If you want to run this locally, copy the `.env.example` files:

```bash
# Backend
cp backend/.env.example backend/.env
# Then edit backend/.env with your local database URL

# Frontend
cp frontend/.env.example frontend/.env
# Then edit frontend/.env with your backend URL
```

## Running the Application

Both workflows are already running:

### Backend API
- **URL**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Command**: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

### Frontend
- **URL**: Your Replit webview (port 5000)
- **Command**: `npm run dev` (in frontend directory)

## Environment Variables Reference

### Backend Variables (from `.env.example`)
```
DATABASE_URL          # Auto-provided by Replit
PROJECT_NAME          # API name
SECRET_KEY            # JWT secret (change in production!)
ALGORITHM             # JWT algorithm (HS256)
ACCESS_TOKEN_EXPIRE_MINUTES  # Token expiry time
```

### Frontend Variables (from `.env.example`)
```
VITE_API_URL          # Backend API endpoint
```

## Next Steps for Development

1. **Check Database Tables**
   - Database tables are created automatically on startup
   - Use the database pane in Replit to view tables

2. **Test the API**
   - Visit http://localhost:8000/docs for interactive API docs
   - Try the health check: http://localhost:8000/health

3. **Start Building Features**
   - The login page is already working
   - All database models are set up
   - Authentication is configured

## Troubleshooting

### Database Connection Issues
- The DATABASE_URL is automatically available in Replit
- Check the Backend API workflow logs for any errors
- Verify the database is running in the Replit database pane

### Frontend Not Loading
- Make sure both workflows are running
- Check the Frontend workflow logs
- Verify the API URL is correct

### Dependencies Issues
- Backend: Run `uv sync` in the root directory
- Frontend: Run `npm install` in the frontend directory

## Development Commands

### Backend
```bash
# Install dependencies
uv sync

# Run migrations (if needed)
cd backend
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Important Notes

⚠️ **Security**: Change the SECRET_KEY in production! The default value in the code is for development only.

✅ **Database**: The PostgreSQL database is ready to use with automatic backups and rollback support in Replit.

✅ **Ready to Build**: All dependencies are installed and both workflows are running successfully!
