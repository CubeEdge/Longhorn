# Multi-stage build for Longhorn Application
# Stage 1: Build client
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund

# Copy client source and build
COPY client/ ./
RUN npm run build

# Stage 2: Server setup
FROM node:20-alpine AS server

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy server package files
COPY server/package*.json ./server/
RUN cd server && npm ci --no-audit --no-fund --production

# Copy server source
COPY server/ ./server/

# Copy built client from stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Copy ecosystem config
COPY scripts/ecosystem.config.js ./

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start with PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
