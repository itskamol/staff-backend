# Development Scripts

This directory contains development scripts for the Staff Control System monorepo.

## Available Scripts

### Package.json Scripts

Use these npm/pnpm scripts for common development tasks:

```bash
# Development
pnpm run dev                    # Start both APIs in development mode
pnpm run dev:all               # Start all applications including gateway
pnpm run serve:dashboard-api   # Start Dashboard API only (port 3000)
pnpm run serve:agent-api       # Start Agent API only (port 3001)
pnpm run serve:agent-gateway   # Start Agent Gateway only (port 3002)

# Building
pnpm run build                 # Build all applications
pnpm run build:dashboard-api   # Build Dashboard API only
pnpm run build:agent-api       # Build Agent API only
pnpm run build:agent-gateway   # Build Agent Gateway only

# Database
pnpm run db:generate          # Generate Prisma client
pnpm run db:migrate           # Run database migrations
pnpm run db:migrate:deploy    # Deploy migrations (production)
pnpm run db:migrate:reset     # Reset database and migrations
pnpm run db:seed              # Seed database with initial data
pnpm run db:studio            # Open Prisma Studio
pnpm run db:setup             # Complete database setup

# Testing
pnpm run test                 # Run all tests
pnpm run test:watch           # Run tests in watch mode
pnpm run test:coverage        # Run tests with coverage
pnpm run test:e2e             # Run e2e tests

# Code Quality
pnpm run lint                 # Lint all code
pnpm run lint:fix             # Lint and fix issues
pnpm run format               # Format code
pnpm run format:check         # Check code formatting

# Utilities
pnpm run clean                # Clean build artifacts and cache
pnpm run setup                # Complete project setup
```

### Shell Scripts

Advanced scripts for development workflow:

#### `dev-setup.sh`
Complete development environment setup:
```bash
./scripts/dev-setup.sh
```

Features:
- Checks required dependencies (Node.js, pnpm, Docker)
- Installs project dependencies
- Sets up database (generate, migrate, seed)
- Builds applications
- Runs tests
- Provides usage instructions

#### `build.sh`
Advanced build script with options:
```bash
# Build all applications
./scripts/build.sh

# Build specific application
./scripts/build.sh dashboard-api

# Build for production
./scripts/build.sh --prod

# Build in watch mode
./scripts/build.sh --watch agent-api
```

#### `serve.sh`
Development server script:
```bash
# Serve main APIs (dashboard-api + agent-api)
./scripts/serve.sh

# Serve specific application
./scripts/serve.sh dashboard-api

# Serve all applications
./scripts/serve.sh --full
```

#### `db-migrate.sh`
Database management script:
```bash
# Complete database setup
./scripts/db-migrate.sh setup

# Run migrations
./scripts/db-migrate.sh migrate

# Deploy migrations (production)
./scripts/db-migrate.sh deploy

# Reset database (with confirmation)
./scripts/db-migrate.sh reset

# Force reset database
./scripts/db-migrate.sh reset --force

# Generate Prisma client
./scripts/db-migrate.sh generate

# Seed database
./scripts/db-migrate.sh seed

# Open Prisma Studio
./scripts/db-migrate.sh studio

# Check migration status
./scripts/db-migrate.sh status
```

#### `test.sh`
Comprehensive testing script:
```bash
# Run all tests
./scripts/test.sh

# Run tests for specific app
./scripts/test.sh dashboard-api

# Run unit tests only
./scripts/test.sh --unit

# Run e2e tests only
./scripts/test.sh --e2e

# Run tests with coverage
./scripts/test.sh --coverage

# Run tests in watch mode
./scripts/test.sh --watch agent-api

# Run tests with verbose output
./scripts/test.sh --verbose
```

#### `restart.sh`
Production deployment script (existing):
```bash
# Restart services with PM2
PM2_PROCESSES="dashboard-api agent-api" ./scripts/restart.sh

# Restart with systemd
SYSTEMD_SERVICES="staff-control-dashboard staff-control-agent" ./scripts/restart.sh
```

## Quick Start

1. **Initial Setup:**
   ```bash
   ./scripts/dev-setup.sh
   ```

2. **Start Development:**
   ```bash
   pnpm run dev
   ```

3. **Run Tests:**
   ```bash
   pnpm run test
   ```

4. **Build for Production:**
   ```bash
   pnpm run build --prod
   ```

## Application Ports

- **Dashboard API:** 3000
- **Agent API:** 3001
- **Agent Gateway:** 3002
- **Device Adapter Platform:** 3003
- **Prisma Studio:** 5555

## Environment Variables

Make sure to set up your `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/staff_control"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"

# API Keys
AGENT_API_KEY="your-agent-api-key"

# HIKVision
HIKVISION_HOST="192.168.1.100"
HIKVISION_USERNAME="admin"
HIKVISION_PASSWORD="password"
```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Kill processes on specific ports
   lsof -ti:3000 | xargs kill -9
   lsof -ti:3001 | xargs kill -9
   ```

2. **Database connection issues:**
   ```bash
   # Check database status
   ./scripts/db-migrate.sh status
   
   # Reset database
   ./scripts/db-migrate.sh reset --force
   ```

3. **Build failures:**
   ```bash
   # Clean and rebuild
   pnpm run clean
   pnpm install
   pnpm run build
   ```

4. **Test failures:**
   ```bash
   # Run tests with verbose output
   ./scripts/test.sh --verbose
   
   # Run specific test file
   nx test dashboard-api --testNamePattern="specific-test"
   ```

### Performance Tips

1. **Use parallel execution:**
   ```bash
   # Build all apps in parallel
   nx run-many --target=build --all --parallel
   ```

2. **Use NX cache:**
   ```bash
   # Check cache status
   nx report
   
   # Clear cache if needed
   nx reset
   ```

3. **Use watch mode for development:**
   ```bash
   # Watch mode for builds
   ./scripts/build.sh --watch
   
   # Watch mode for tests
   ./scripts/test.sh --watch
   ```

## Contributing

When adding new scripts:

1. Make scripts executable: `chmod +x scripts/new-script.sh`
2. Add usage documentation to this README
3. Include error handling and logging
4. Follow the existing script patterns
5. Test scripts in different environments

## Support

For issues with development scripts:

1. Check this README for common solutions
2. Verify environment setup with `./scripts/dev-setup.sh`
3. Check NX documentation: https://nx.dev
4. Review application logs in the `logs/` directory