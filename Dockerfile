# Stage 1: Build frontend
FROM registry.access.redhat.com/ubi9/nodejs-20 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Runtime
FROM registry.access.redhat.com/ubi9/python-311
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./static
COPY skills/ ./skills/

RUN mkdir -p /app/data && chown 1001:0 /app/data

USER 1001

EXPOSE 8080
ENV CONFIG_PATH=/app/config.yaml
ENV SKILLS_DIR=/app/skills
ENV LOG_FORMAT=json

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
