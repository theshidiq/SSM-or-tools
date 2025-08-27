# Multi-stage Docker build for Express.js server with TensorFlow.js Node.js optimization
# Production-ready with security hardening and performance optimization

# Build stage - Install dependencies and prepare application
FROM node:18-alpine AS builder

# Install system dependencies required for TensorFlow.js Node.js native bindings
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    giflib-dev \
    && ln -sf python3 /usr/bin/python

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S serverjs -u 1001

WORKDIR /app

# Copy package files for optimal Docker layer caching
COPY package*.json ./

# Configure npm for security and performance
RUN npm config set audit-level moderate && \
    npm config set fund false && \
    npm config set update-notifier false

# Install dependencies with npm ci for reproducible builds
# Skip native bindings for Alpine compatibility - use CPU backend only
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy application source code
COPY . .

# Remove development files that shouldn't be in production
RUN rm -rf test/ tests/ *.test.js *.spec.js .eslintrc* .prettierrc* nodemon.json

# Production stage - Minimal runtime image
FROM node:18-alpine AS production

# Install runtime dependencies for TensorFlow.js Node.js
RUN apk add --no-cache \
    libc6-compat \
    libstdc++ \
    ca-certificates \
    && apk upgrade --no-cache

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S serverjs -u 1001

WORKDIR /app

# Copy built application and dependencies from builder stage
COPY --from=builder /app .

# Security: Set proper ownership and permissions
RUN chown -R serverjs:nodejs /app && \
    chmod -R 755 /app

# TensorFlow.js CPU-only optimizations for Alpine compatibility
ENV TFJS_BACKEND=cpu
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TFJS_FORCE_CPU=true
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV UV_THREADPOOL_SIZE=2

# Production environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:3001/health', (res) => { res.statusCode === 200 ? process.exit(0) : process.exit(1); }).on('error', () => process.exit(1));"

# Security: Run as non-root user
USER serverjs

# Expose server port
EXPOSE 3001

# Production start command with PM2-like behavior using node
CMD ["node", "server.js"]

# Development stage - Full development environment with hot reload
FROM node:18-alpine AS development

# Install all dependencies including development tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    giflib-dev \
    && ln -sf python3 /usr/bin/python

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S serverjs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies) - skip native bindings
RUN npm install

# Development environment variables
ENV NODE_ENV=development
ENV PORT=3001
ENV DEBUG=shift-schedule:*

# TensorFlow.js development optimizations - CPU only for Alpine
ENV TFJS_BACKEND=cpu
ENV TF_CPP_MIN_LOG_LEVEL=1
ENV TFJS_FORCE_CPU=true
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Security: Change ownership to non-root user
RUN chown -R serverjs:nodejs /app
USER serverjs

# Expose development port
EXPOSE 3001

# Development command with nodemon for hot reload
CMD ["npm", "run", "dev"]

# Testing stage - For running tests in CI/CD
FROM development AS testing

# Copy test files and configuration
COPY . .

# Install testing dependencies if not already installed
RUN npm install --include=dev

# Test environment
ENV NODE_ENV=test

# Run tests
CMD ["npm", "test"]