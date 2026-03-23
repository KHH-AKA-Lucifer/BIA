# BIA Dashboard - Vending Machine Business Intelligence System

A comprehensive Business Intelligence and Analysis (BIA) platform for monitoring, analyzing, and optimizing vending machine operations. Built as a 3-month team project for the Business Intelligence and Analysis course at the Asian Institute of Technology (AIT).

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.13+-blue)
![React](https://img.shields.io/badge/React-19.2+-blue)
![Status](https://img.shields.io/badge/Status-Active%20Development-green)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Development Workflow](#development-workflow)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

---

## 🎯 Overview

The BIA Dashboard is a data-driven operational intelligence system designed to help vending machine operators make informed decisions about machine placement, restocking schedules, and performance optimization.

### Problem Statement
Automated vending machines across AIT require efficient operational monitoring to ensure availability, maintain revenue stability, and optimize servicing schedules. Without centralized analytics, restocking decisions are typically reactive, leading to stock-outs, inefficient servicing, and reduced operational visibility.

### Solution
A real-time dashboard that provides:
- **Operational Visibility**: Machine performance monitoring and health status
- **Data-Driven Insights**: Statistical analysis, performance tiers, and anomaly detection
- **Geographic Intelligence**: Location-based revenue analysis and suitability evaluation
- **Predictive Analytics**: Trend detection and demand forecasting foundation

---

## ✨ Features

### Executive Dashboard
- **Real-time KPIs**: Total revenue, machine count, average utilization, active alerts
- **Fleet Health Visualization**: Machine status indicators (Healthy/Warning/Critical)
- **Revenue Distribution**: Category-based revenue breakdown (Pie chart)
- **Profit Trend Analysis**: Weekly profit trajectory with trend detection
- **Utilization Distribution**: Machine performance binning across utilization ranges
- **Location-based Revenue**: Treemap visualization of top-performing locations

### Statistical Analysis Panel
- **10 Statistical Metrics**: Mean, Median, Std Dev, Coefficient of Variation, Quartiles, Range, IQR
- **Quartile Distribution**: Visual stacked bar chart showing machine distribution across Q1-Q4
- **Outlier Detection**: 2-sigma statistical anomaly identification and flagging

### Performance Analytics
- **Profit Trend Metrics**: 7-day profit analysis with trend detection (improving/declining)
- **Day-over-Day Changes**: Bar chart visualizing daily profit movements
- **Alert Correlation Analysis**: Alerts correlated with underutilizing machines
- **Alert Details**: Machine-level alert breakdown with utilization metrics and risk indicators

### Machine Management Tab
- **Machine Heatmap**: Auto-grid color-coded visualization of machine utilization
- **Performance Tiers**: 5-tier segmentation (Elite/High/Average/Low/Critical)
- **Top/Bottom Performers**: Quick identification of best and worst performing machines
- **Anomaly Detection**: Machines operating outside normal parameters

### Geographic Analysis
- **Location Mapping**: Bubble-sized visualization of machines by revenue
- **Location List**: Detailed location information with revenue metrics

### Location Dashboard
- **Location Performance Table**: Ranked locations with revenue breakdown
- **Revenue Distribution**: Pie chart showing revenue concentration by location
- **Location Summaries**: Total count, aggregate revenue, top performer stats

### Interactive Slicers
- **Date Range Filter**: Week/Month/Quarter period selection
- **Location Filter**: Multi-select location filtering
- **Machine Status Filter**: Healthy/Warning/Critical status filtering
- **One-click Reset**: Clear all filters instantly

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI 0.135.1
- **Server**: Uvicorn 0.41.0
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Migration**: Alembic 1.18.4
- **Authentication**: Python-Jose + Passlib
- **Data Processing**: Pandas 3.0.1
- **Validation**: Pydantic Settings 2.13.1

### Frontend
- **Runtime**: React 19.2.4
- **Language**: TypeScript 5.9.3
- **Build Tool**: Vite 8.0.2
- **Styling**: Tailwind CSS 4.2.2
- **Routing**: React Router DOM 7.13.2
- **Charts**: Recharts 3.8.0 (LineChart, BarChart, PieChart, Treemap)
- **HTTP Client**: Axios 1.13.6
- **Icons**: Lucide React 1.0.1
- **UI**: Glassmorphic design with CSS-in-JS

### DevOps
- **Containerization**: Docker & Docker Compose
- **Version Control**: Git
- **Python Version**: 3.13+
- **Node Version**: 18+ (LTS)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)         │
│  ├─ DashboardPage (Main component)                      │
│  ├─ KPICard (Reusable card component)                   │
│  ├─ AuthContext (Authentication state)                 │
│  └─ Hooks (useDashboard, useAuth)                       │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP/REST API (Axios)
┌──────────────────▼──────────────────────────────────────┐
│              Backend (FastAPI + Python)                  │
│  ├─ /api/v1/auth/* (Authentication endpoints)           │
│  ├─ /api/v1/dashboard/summary (Analytics data)          │
│  ├─ /api/v1/user/* (User management)                    │
│  └─ /api/v1/data/* (Data retrieval)                     │
└──────────────────┬──────────────────────────────────────┘
                   │ SQL Queries
┌──────────────────▼──────────────────────────────────────┐
│        PostgreSQL Database + SQLAlchemy ORM              │
│  ├─ users (Authentication)                              │
│  ├─ vending_machines (Machine metadata)                 │
│  ├─ sales_data (Transaction records)                    │
│  └─ alerts (System alerts)                              │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Prerequisites

Before you begin, ensure you have installed:

- **Python 3.13+** ([Download](https://www.python.org/downloads/))
- **Node.js 18+ LTS** ([Download](https://nodejs.org/))
- **PostgreSQL 14+** ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/))
- **Docker & Docker Compose** (Optional, for containerization)

### Verify Installations

```bash
python --version     # Should be 3.13+
node --version       # Should be 18+
npm --version        # Should be 8+
psql --version       # Should be 14+
git --version        # Latest version
```

---

## 📥 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/KHH-AKA-Lucifer/BIA.git
cd BIA
```

### 2. Backend Setup

#### 2a. Create and Activate Python Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

#### 2b. Install Python Dependencies

```bash
pip install --upgrade pip
pip install -e .
```

This installs all dependencies from `pyproject.toml`:
- FastAPI, Uvicorn (API framework)
- SQLAlchemy, Alembic (Database ORM & migrations)
- Pandas (Data processing)
- Authentication libraries (Python-Jose, Passlib)

#### 2c. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/bia_db
SQLALCHEMY_DATABASE_URI=postgresql://user:password@localhost:5432/bia_db

# Security
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Configuration
API_HOST=127.0.0.1
API_PORT=8000

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:5173
```

### 3. Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Create .env file for frontend
echo "VITE_API_URL=http://localhost:8000" > .env
```

### 4. Database Setup

#### 4a. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL CLI
CREATE DATABASE bia_db;
CREATE USER bia_user WITH PASSWORD 'your_secure_password';
ALTER ROLE bia_user SET client_encoding TO 'utf8';
ALTER ROLE bia_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE bia_user SET default_transaction_deferrable TO on;
ALTER ROLE bia_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE bia_db TO bia_user;
\q
```

#### 4b. Run Database Migrations

```bash
# From project root (with venv activated)
alembic upgrade head
```

Loaded migrations:
- `e24ffe6eab49_add_role_to_users.py`
- `ef75aaafe6a0_create_users_table.py`

---

## 🚀 Running the Project

### Option 1: Manual Start (Recommended for Development)

#### Terminal 1 - Start Backend API

```bash
# From project root
source venv/bin/activate  # macOS/Linux or: venv\Scripts\activate (Windows)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend will be available at: `http://localhost:8000`

API Documentation (Swagger UI): `http://localhost:8000/docs`

#### Terminal 2 - Start Frontend Development Server

```bash
cd frontend
npm run dev
```

Frontend will be available at: `http://localhost:5173` (default Vite port)

#### Access the Dashboard

Open your browser and navigate to:
```
http://localhost:5173
```

### Option 2: Docker Compose (All-in-one)

```bash
# Build and start all services
docker-compose up --build

# Services will be available at:
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# Database: localhost:5432
```

To stop services:
```bash
docker-compose down
```

---

## 📂 Project Structure

```
BIA/
├── app/                          # Backend application
│   ├── main.py                   # FastAPI app initialization
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py           # Authentication endpoints
│   │   │   ├── user.py           # User management
│   │   │   └── dashboard.py      # Analytics endpoints
│   │   └── deps.py               # Dependency injection
│   ├── core/
│   │   ├── config.py             # Configuration management
│   │   ├── security.py           # Security utilities
│   │   └── logging.py            # Logging configuration
│   ├── db/
│   │   ├── models.py             # SQLAlchemy models
│   │   ├── base.py               # Database base class
│   │   └── sessions.py           # Session management
│   ├── models/                   # Pydantic models
│   │   ├── user.py               # User schemas
│   │   └── auth.py               # Auth schemas
│   ├── schemas/                  # Request/Response schemas
│   └── services/                 # Business logic
│       ├── auth_service.py       # Auth logic
│       └── databoard_service.py  # Dashboard calculations
│
├── frontend/                      # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   └── DashboardPage.tsx # Main dashboard (1200+ lines)
│   │   ├── components/
│   │   │   └── KPICard.tsx       # Reusable KPI card
│   │   ├── context/
│   │   │   └── AuthContext.tsx   # Auth state management
│   │   ├── hooks/
│   │   │   └── useDashboard.ts   # Dashboard data fetching
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── alembic/                       # Database migrations
│   ├── versions/
│   │   ├── e24ffe6eab49_add_role_to_users.py
│   │   └── ef75aaafe6a0_create_users_table.py
│   └── env.py
│
├── app/data/
│   └── vending_machine_sales.csv # Sample dataset
│
├── pyproject.toml                # Python dependencies
├── docker-compose.yml            # Container orchestration
├── alembic.ini                   # Migration config
├── proposal.txt                  # Project proposal
└── README.md                     # This file
```

---

## 📡 API Documentation

### Base URL

```
http://localhost:8000/api/v1
```

### Authentication

All endpoints (except `/auth/login`) require JWT token in header:

```
Authorization: Bearer <your_jwt_token>
```

### Key Endpoints

#### Authentication
- `POST /auth/login` - User login, receive JWT token
- `POST /auth/register` - Register new user
- `GET /auth/me` - Get current user info

#### Dashboard
- `GET /dashboard/summary` - Main analytics endpoint
  - Returns: KPIs, machine data, alerts, revenue, profitability, utilization stats

#### Data
- `GET /machines` - List all machines
- `GET /locations` - Locations data
- `GET /sales` - Sales records

### Swagger UI

Interactive API documentation available at: `http://localhost:8000/docs`

---

## ⚙️ Configuration

### Backend Configuration (app/core/config.py)

```python
# Key settings
DEBUG = False                           # Set to True in development
DATABASE_URL = "postgresql://..."       # Your DB connection string
SECRET_KEY = "your-secret-key"          # Change in production
ALGORITHM = "HS256"                     # JWT algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = 30        # Token TTL
```

### Frontend Configuration (.env)

```
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=BIA Dashboard
```

### Database Configuration

Edit `.env` to change database connection:

```
DATABASE_URL=postgresql://username:password@host:port/database_name
```

---

## 💾 Database Setup

### Sample Data

The project includes sample vending machine sales data:

```bash
# Load sample CSV data (if automation exists)
# Manual import: app/data/vending_machine_sales.csv
```

### Database Schema Highlights

**Users Table**
```sql
- id, email, hashed_password, is_active, role, created_at
```

**Machines Table**
```sql
- id, machine_id, location, utilization, status, revenue
```

**Sales Data**
```sql
- id, machine_id, date, revenue, transactioncount, category
```

---

## 👨‍💻 Development Workflow

### 1. Feature Development

1. Create feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make changes to code

3. Test changes locally

4. Commit with atomic messages
   ```bash
   git commit -m "feat(component): description of feature"
   ```

### 2. Commit Message Format

Follow conventional commits:

```
feat(scope): add new feature
fix(scope): fix bug
refactor(scope): refactor code
docs(scope): update documentation
style(scope): formatting changes
chore(scope): dependency updates
```

### 3. Testing

```bash
# Backend tests (configure in pyproject.toml)
pytest

# Frontend tests (configure in package.json)
npm test
```

### 4. Code Quality

```bash
# Backend linting
flake8 app/

# Frontend linting
npm run lint
```

### 5. Building for Production

#### Backend
```bash
# No separate build needed for FastAPI
# Just ensure all dependencies are installed
pip install -e .
```

#### Frontend
```bash
cd frontend
npm run build
# Output: dist/ directory with optimized files
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit with clear messages**
5. **Push to your fork**
6. **Create a Pull Request**

### Guidelines
- Keep commits atomic and well-documented
- Include comments for complex logic
- Test changes before pushing
- Update documentation if needed

---

## 👥 Team

| Name | Student ID | Role |
|------|-----------|------|
| Saugat Shakya | st125986 | Full Stack Developer |
| Gaurav Karki | st126522 | Backend & Database |
| Shah Md. Jobayer | st126404 | Data Analytics |
| Kaung Hein Htet | st126477 | DevOps & Infrastructure |

**Course**: Business Intelligence and Analysis  
**Institution**: Asian Institute of Technology (AIT)  
**Submitted**: February 19, 2026

---

## 📋 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🆘 Troubleshooting

### Backend Issues

**Port 8000 already in use**
```bash
# Kill process using port 8000
lsof -ti:8000 | xargs kill -9

# Or use different port
python -m uvicorn app.main:app --port 8001
```

**Database connection failed**
```bash
# Check PostgreSQL is running
psql -U postgres  # Should connect successfully

# Verify DATABASE_URL in .env
# Format: postgresql://user:password@localhost:5432/database
```

**Migration errors**
```bash
# Reset migrations (⚠️ WARNING: Deletes all data)
alembic downgrade base
alembic upgrade head
```

### Frontend Issues

**Port 5173 already in use**
```bash
cd frontend
npm run dev -- --port 5174
```

**Build fails**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

**API connection errors**
- Verify backend is running on http://localhost:8000
- Check VITE_API_URL in frontend/.env
- Ensure CORS is enabled in FastAPI

---

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Recharts Documentation](https://recharts.org/)
- [Vite Documentation](https://vitejs.dev/)

---

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact the development team
- Check existing documentation

---

**Last Updated**: March 24, 2026  
**Project Status**: Active Development  
**Version**: 0.1.0
