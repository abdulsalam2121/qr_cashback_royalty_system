# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM base AS production

# Copy application files and dependencies
COPY --from=deps --chown=backend:nodejs /app/node_modules ./node_modules
COPY --chown=backend:nodejs package*.json ./
COPY --chown=backend:nodejs server.js ./
COPY --chown=backend:nodejs src ./src
COPY --chown=backend:nodejs prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Create logs directory
RUN mkdir -p logs uploads && chown -R backend:nodejs logs uploads

# Switch to non-root user
USER backend

# Expose the port the app runs on
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Set environment to production
ENV NODE_ENV=production

# Command to run the application using server.js
CMD ["node", "server.js"]