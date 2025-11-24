# AstroPlanner

AstroPlanner is an astronomy session planner and observing log web app.

## Tech Stack

- Backend: FastAPI (Python), SQLAlchemy ORM, JWT auth
- Database: PostgreSQL
- Frontend: React + TypeScript (Vite)
- Deployment: Docker + docker-compose, Nginx reverse proxy, HTTPS (HTTP/2)

## High-level Features

- User registration and login
- Save observing locations (e.g., backyard, dark-sky site)
- Plan observing sessions (target, date/time, location)
- View weather for planned sessions via external weather API
- Log observation details (notes, seeing, rating)
