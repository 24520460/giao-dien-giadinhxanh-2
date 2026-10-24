# =====================================================================
# GIA ĐÌNH XANH - DOCKERFILE
# Multi-stage / Lightweight Production & Local Setup Image
# =====================================================================
FROM node:22-alpine AS base

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy dependency manifests first for efficient Docker layer caching
COPY package.json package-lock.json ./

# Install exact dependencies according to package-lock.json
RUN npm ci

# Copy application source code
COPY . .

# Ensure data directory exists with write permissions
RUN mkdir -p backend/data && chmod -R 777 backend/data

# Expose standard application port
EXPOSE 3000

# Health check probe against API status endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

# Default execution command
CMD ["npm", "start"]
