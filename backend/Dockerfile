# ==========================================
# STAGE 1: Build Stage
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# Install openssl needed for Prisma client
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package descriptors first for caching
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and configurations
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build

# ==========================================
# STAGE 2: Runner Stage
# ==========================================
FROM node:20-slim

WORKDIR /app

# Install openssl needed for Prisma client
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled files and prisma schema from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated /app/src/generated

# Expose API port
EXPOSE 5000

# Set non-root user permissions
RUN chown -R node:node /app
USER node

# Start Express server
CMD ["node", "dist/server.js"]
