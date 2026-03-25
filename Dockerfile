# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python app
FROM python:3.13-slim
WORKDIR /app

# Install dependencies
COPY backend/pyproject.toml .
RUN pip install --no-cache-dir \
    "fastapi[standard]>=0.115" \
    "sqlalchemy>=2.0" \
    "alembic>=1.14" \
    "psycopg2-binary>=2.9" \
    "python-dateutil>=2.9"

# Copy backend code
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/alembic.ini .

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
