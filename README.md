# Sector Staff

Multi-organization attendance tracking and access control system built with NestJS.

## Features

- **Multi-Organization Support**: Complete data isolation between organizations
- **Hierarchical Structure**: Organization → Branch → Department → Employee
- **Role-Based Access Control**: SUPER_ADMIN, ORG_ADMIN, BRANCH_MANAGER, EMPLOYEE
- **Device Integration**: Support for cameras, card readers, fingerprint scanners
- **Guest Management**: Visitor workflows with approval processes
- **Attendance Tracking**: Automated attendance recording from device events
- **Asynchronous Processing**: Background job processing with BullMQ
- **Audit Logging**: Comprehensive audit trails for compliance

## Technology Stack

- **Backend**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ
- **Storage**: Local Storage
- **Authentication**: JWT with Passport.js
- **Testing**: Jest with Testcontainers

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sector-staff-v2
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Start infrastructure services:
```bash
docker-compose up -d
```

5. Generate Prisma client and run migrations:
```bash
pnpm run db:generate
pnpm run db:migrate
```

6. Start the development server:
```bash
pnpm run start:dev
```

The API will be available at `http://localhost:3000/api/v1`

### Environment Variables

See `.env.example` for all required environment variables.

## Project Structure

```
src/
├── app/                     # Main application module
├── core/                    # Core infrastructure modules
│   ├── config/              # Configuration management
│   ├── database/            # Prisma service
│   ├── logger/              # Logging service
│   └── queue/               # BullMQ configuration
├── shared/                  # Shared utilities
│   ├── decorators/          # Custom decorators
│   ├── dto/                 # Common DTOs
│   ├── enums/               # Enumerations
│   ├── guards/              # Security guards
│   ├── interfaces/          # Type definitions
│   └── utils/               # Helper functions
├── modules/                 # Business modules
│   ├── auth/                # Authentication
│   ├── organization/        # Organization management
│   ├── user/                # User management
│   ├── branch/              # Branch management
│   ├── department/          # Department management
│   ├── employee/            # Employee management
│   ├── device/              # Device management
│   ├── guest/               # Guest management
│   ├── attendance/          # Attendance tracking
│   ├── reporting/           # Report generation
│   ├── audit/               # Audit logging
│   └── integration/         # External adapters
└── main.ts                  # Application entry point
```

## API Documentation

The API follows RESTful conventions with the following base URL: `/api/v1`

### Health Check
- `GET /` - API status
- `GET /health` - Health check endpoint

## Testing

```bash
# Unit tests
pnpm run test

# Integration tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## Development

```bash
# Start in development mode
pnpm run start:dev

# Build for production
pnpm run build

# Start production server
pnpm run start:prod
```

## Database

```bash
# Generate Prisma client
pnpm run db:generate

# Create and apply migration
pnpm run db:migrate

# Deploy migrations (production)
pnpm run db:deploy

# Seed database
pnpm run db:seed
```

## License

This project is licensed under the UNLICENSED License.
