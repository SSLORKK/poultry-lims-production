# POULTRY LIMS - AI Assistant Guide

> **Project**: Central Poultry Laboratories Information Management System (LIMS)  
> **Purpose**: Laboratory sample management for PCR, Serology, and Microbiology departments

---

## Project Overview

This is a full-stack web application for managing laboratory samples in a poultry testing facility. It tracks samples through registration, testing, and certificate of analysis (COA) generation.

### Key Domains
- **PCR Department** - Molecular testing (disease detection via PCR)
- **Serology Department** - Antibody/antigen testing (ELISA, etc.)
- **Microbiology Department** - Bacterial/fungal culture and sensitivity testing

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19 | UI Framework |
| TypeScript | Type safety |
| Vite 7 | Build tool & dev server |
| TailwindCSS 3 | Styling |
| React Router 7 | Routing |
| TanStack Query 5 | Server state management |
| Axios | HTTP client |
| Recharts | Charts/dashboards |
| jsPDF + html2canvas | PDF generation |
| xlsx-js-style | Excel export |

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI | Python web framework |
| SQLAlchemy 2 | ORM |
| PostgreSQL 15 | Database |
| Redis | Caching |
| Pydantic 2 | Data validation |
| python-jose | JWT authentication |
| Alembic | Database migrations |
| ReportLab | PDF generation |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| Synology NAS | Production hosting |
| Docker Hub | Image registry (`sslorkk/poultry-lims-*`) |

---

## Project Structure

```
POULTRY LIMS/
├── backend/
│   ├── app/
│   │   ├── api/v1/routers/     # API endpoints
│   │   ├── core/               # Config, security, dependencies
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   └── db/                 # Database session & base
│   ├── alembic/                # Database migrations
│   ├── uploads/                # File uploads storage
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   ├── contexts/           # React contexts
│   │   └── features/           # Feature modules
│   │       ├── auth/           # Login/register
│   │       ├── samples/        # Sample management (main feature)
│   │       ├── controls/       # Dropdown data management
│   │       ├── dashboard/      # Analytics dashboard
│   │       ├── database/       # Data tables view
│   │       ├── drive/          # File management system
│   │       ├── reports/        # Report generation
│   │       ├── pcr/            # PCR-specific components
│   │       └── microbiology/   # Microbiology-specific
│   └── package.json
│
├── docker-compose.yml          # Production config
├── docker-compose-dev.yml      # Development config
└── COMMANDS-REFERENCE.md       # Deployment commands
```

---

## Key Files Reference

### Backend Entry Points
- `backend/app/main.py` - FastAPI app initialization, middleware, routes
- `backend/app/core/config.py` - Environment settings
- `backend/app/api/v1/routers/samples.py` - Main sample CRUD operations
- `backend/app/api/v1/routers/controls.py` - Dropdown data management

### Frontend Entry Points
- `frontend/src/App.tsx` - Routes definition
- `frontend/src/components/MainLayout.tsx` - Main layout with sidebar
- `frontend/src/features/samples/components/` - Sample management screens

### Key Sample Components
| Component | Purpose |
|-----------|---------|
| `UnifiedSampleRegistration.tsx` | Register new samples |
| `AllSamples.tsx` | View all samples across departments |
| `PCRSamples.tsx` | PCR department sample list & data entry |
| `SerologySamples.tsx` | Serology department sample list |
| `MicrobiologySamples.tsx` | Microbiology sample list |
| `PCRCOA.tsx` | PCR Certificate of Analysis |
| `MicrobiologyCOA.tsx` | Microbiology COA |

---

## Data Model Overview

### Core Entities
```
Sample → Units → Department-specific Data → COA
```

- **Sample**: Registration info (company, farm, date, sample number)
- **Unit**: Individual test unit within a sample (linked to department)
- **PCR Data**: PCR test results per unit
- **Serology Data**: Serology test results per unit
- **Microbiology Data**: Culture results, AST data per unit
- **COA**: Certificate of Analysis for completed tests

### Department IDs
| ID | Department |
|----|------------|
| 1 | PCR |
| 2 | Serology |
| 3 | Microbiology |

### Dropdown Data Tables (Controls)
Companies, Farms, Flocks, Houses, Sources, Sample Types, Diseases, Kit Types, Technicians, Signatures, etc.

---

## API Patterns

### Base URL
```
Development: http://localhost:8000/api/v1
Production:  http://192.168.55.92:8000/api/v1
```

### Authentication
- JWT Bearer tokens
- Access token: 30 min (configurable)
- Refresh token: 7 days
- Remember me: 30 days

### Common Endpoints
```
POST   /auth/login           # Login
GET    /samples              # List samples (paginated)
POST   /samples              # Create sample
GET    /units/{id}           # Get unit details
PUT    /units/{id}           # Update unit
GET    /controls/{type}      # Get dropdown data
POST   /controls/{type}      # Create dropdown item
```

---

## Development Commands

### Start Development Environment
```powershell
# Using Docker
docker-compose -f docker-compose-dev.yml up -d --build

# Or run separately:
# Backend
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm run dev
```

### Access Points
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 (Docker) or :5173 (Vite) |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Database | localhost:5433 (PostgreSQL) |

---

## Code Conventions

### Frontend
- **Components**: Functional components with hooks
- **State**: TanStack Query for server state, useState for local
- **Styling**: TailwindCSS utility classes
- **API calls**: Axios with interceptors in `api.ts`
- **Forms**: Controlled components with local state

### Backend
- **Routers**: One file per resource in `api/v1/routers/`
- **Models**: SQLAlchemy declarative models
- **Schemas**: Pydantic models for request/response validation
- **Dependencies**: FastAPI Depends() for auth, db session

### Naming
- **Files**: PascalCase for React components, snake_case for Python
- **Database**: snake_case table/column names
- **API**: RESTful conventions

---

## Common Tasks

### Adding a New Dropdown Type
1. Create model in `backend/app/models/dropdown_data.py`
2. Add CRUD in `backend/app/api/v1/routers/controls.py`
3. Add frontend form in `frontend/src/features/controls/`

### Adding a New Report
1. Backend: Add endpoint in `backend/app/api/v1/routers/reports.py`
2. Frontend: Add component in `frontend/src/features/reports/`

### Database Schema Changes
1. Modify model in `backend/app/models/`
2. Create migration: `alembic revision --autogenerate -m "description"`
3. Apply: `alembic upgrade head`
4. Or direct SQL on production (see COMMANDS-REFERENCE.md)

---

## Production Deployment

### Docker Hub Images
```
sslorkk/poultry-lims-backend:latest
sslorkk/poultry-lims-frontend:latest
```

### Quick Deploy to NAS
```bash
ssh alihassan@192.168.55.92
cd /volume3/docker/poultry-lims
sudo docker-compose pull
sudo docker-compose down
sudo docker-compose up -d
```

See `COMMANDS-REFERENCE.md` for complete deployment workflow.

---

## Important Notes

### Security
- Never hardcode secrets - use environment variables
- SECRET_KEY must be 32+ chars in production
- CORS is configured for specific origins only

### Performance
- React Query caching: 5 min stale, 10 min cache
- Backend Redis caching enabled
- GZip compression middleware
- PostgreSQL tuned for performance

### File Uploads
- Stored in `backend/uploads/` (mounted as Docker volume)
- Profile pictures, documents, signatures

---

## Troubleshooting

### Common Issues
| Issue | Solution |
|-------|----------|
| CORS errors | Check ALLOWED_ORIGINS in backend .env |
| 401 Unauthorized | Token expired, re-login |
| Database connection | Check DATABASE_URL, container health |
| Missing columns | Run schema fix SQL (see COMMANDS-REFERENCE.md) |

### View Logs
```bash
# Backend
docker logs lims_backend --tail 100

# Frontend
docker logs lims_frontend --tail 100

# Database
docker logs lims_db --tail 100
```

---

## Related Documentation

- `COMMANDS-REFERENCE.md` - Complete command reference
- `DEPLOYMENT.md` - Deployment guide
- `DOCKER.md` - Docker setup details
- `PERFORMANCE.md` - Performance optimization
- `SECURITY_AUDIT_REPORT.md` - Security review

---

*Last Updated: January 2026*
