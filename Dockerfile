# Base stage
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# Development stage
FROM base AS development
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

# Production stage
FROM base AS production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY . .
RUN pnpm run build

EXPOSE 3000
CMD ["pnpm", "run", "start:prod"]