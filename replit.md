# Poultry LIMS - Laboratory Information Management System

## Overview

Poultry LIMS is a specialized Laboratory Information Management System designed for poultry laboratories. It manages sample registration, tracking, and analysis across PCR, Serology, and Microbiology departments. Key features include automatic year-based sample ID generation, department-specific unit tracking, and comprehensive poultry farm data collection with archival support. The system aims to streamline laboratory operations, provide robust data management, and offer a professional Certificate of Analysis (COA) generation for PCR samples.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend is built with React 18+ and TypeScript, using Tailwind CSS for styling. It features a collapsible sidebar navigation by department. Key views include a Dashboard with statistics, an "All Samples" global overview, and dedicated department sample screens (PCR, Serology, Microbiology) with year filtering, search, and COA workflows. A professional, branded PDF export template for PCR COAs is designed for compact A4 layout, optimized for print, and includes XSS protection.

### Technical Implementations

The system utilizes React Router DOM for navigation, TanStack Query for server state management, and Axios for HTTP requests. Data visualization is handled by Recharts. A unified sample registration form supports creating and editing samples and units across departments, with live ID previews and dynamic disease-kit selectors. An E-Signature system, managed in the Controls section, uses secure PIN-based authentication with bcrypt hashing for signing PCR COAs. A comprehensive "Database" view provides pivot-table analysis for PCR results with advanced filtering, color-coded positive/negative results, and read-only COA previews. The "Controls" section offers a tabbed interface for managing all system dropdown master data.

### System Design Choices

The backend is developed with FastAPI, SQLAlchemy (ORM), and PostgreSQL. Alembic manages database migrations, and Pydantic is used for data validation. Authentication is JWT-based with bcrypt for password hashing, supporting role-based access control and fine-grained permissions at the screen and department levels. The system features automatic sample and unit ID generation, and supports complex poultry-specific data fields. A layered architecture (Routes -> Services -> Repositories -> Models) and repository pattern ensure separation of concerns and abstract data access. Dependency injection is used via FastAPI's `Depends` system.

## External Dependencies

-   **Database:** PostgreSQL (Replit's built-in database), Alembic (for schema migrations)
-   **Authentication:** `python-jose` (for JWT), `bcrypt` (for password hashing)
-   **Frontend Development:** Vite
-   **Backend Server:** Uvicorn