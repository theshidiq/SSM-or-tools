# Multi-stage Docker build for React client with TensorFlow.js optimization
# Production-ready with security hardening and optimal caching

# Build stage - Node.js environment for building React app
FROM node:18-alpine AS builder

# Security: Create non-root user for build process
RUN addgroup -g 1001 -S nodejs && adduser -S reactjs -u 1001

# Install build dependencies for native modules (TensorFlow.js may need)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Set working directory
WORKDIR /app

# Copy package files first for optimal Docker layer caching
COPY package*.json ./

# Set npm configurations for performance and security
RUN npm config set audit-level moderate && \
    npm config set fund false && \
    npm config set update-notifier false

# Install all dependencies first (including dev for build)
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Set build environment
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false
ENV CI=true
ENV ESLINT_NO_DEV_ERRORS=true

# TensorFlow.js optimizations
ENV TFJS_BACKEND=webgl
ENV TFJS_FORCE_CPU=false

# Build the React application (disable linting errors for Docker build)
RUN CI=false DISABLE_ESLINT_PLUGIN=true npm run build

# Remove dev dependencies after build to reduce image size
RUN npm prune --omit=dev && \
    npm cache clean --force

# Production stage - Nginx for serving static files
FROM nginx:1.25-alpine AS production

# Security: Install security updates
RUN apk upgrade --no-cache

# Security: Modify existing nginx user to use specific UID/GID
RUN deluser nginx && delgroup nginx || true && \
    addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx

# Copy custom nginx configuration
COPY docker/nginx.simple.conf /etc/nginx/nginx.conf

# Copy built React app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy environment injection script
COPY docker/inject-env.sh /docker-entrypoint.d/inject-env.sh
RUN chmod +x /docker-entrypoint.d/inject-env.sh

# Security: Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Security: Remove unnecessary packages
RUN rm -rf /var/cache/apk/*

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Security: Run as non-root user
USER nginx

# Expose port
EXPOSE 80

# Default command
CMD ["nginx", "-g", "daemon off;"]

# Development stage - Node.js with hot reload
FROM node:18-alpine AS development

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S reactjs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Set development environment
ENV NODE_ENV=development
ENV FAST_REFRESH=true
ENV CHOKIDAR_USEPOLLING=true

# Security: Change ownership to non-root user
RUN chown -R reactjs:nodejs /app
USER reactjs

# Expose development port
EXPOSE 3000

# Development command with hot reload
CMD ["npm", "start"]