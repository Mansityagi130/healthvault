# ==========================================
# STAGE 1: Dependency Stage
# ==========================================
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ==========================================
# STAGE 2: Build Stage
# ==========================================
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# We inject a dummy/default API URL for the static build compilation
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

# ==========================================
# STAGE 3: Runner Stage
# ==========================================
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled resources and assets from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

# Expose Next.js port
EXPOSE 3000

# Set non-root user permissions
RUN chown -R node:node /app
USER node

# Start Next.js server
CMD ["npm", "run", "start"]
