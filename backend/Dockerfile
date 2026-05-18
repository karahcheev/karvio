FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .


COPY app ./app
COPY scripts ./scripts
COPY alembic ./alembic
COPY alembic.ini ./



EXPOSE 8000
