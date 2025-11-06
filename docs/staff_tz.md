# Hodimlarni Nazorat Qilish Tizimi - Texnik Topshiriq

## 1. LOYIHA HAQIDA UMUMIY MA'LUMOT

### 1.1 Loyiha maqsadi

Tashkilot hodimlarining ishini kompleks monitoring va tahlil qilish uchun korporativ tizim yaratish:

- **Kirish-chiqish nazorati**: HIKVision qurilmalari orqali hodimlarning ishga kelish/ketish vaqtlarini avtomatik monitoring qilish
- **Kompyuter faoliyati monitoring**: C# agent dasturi orqali hodimlarning kompyuterdagi real-time faoliyatini kuzatish (aktiv oynalar, tashrif buyurilgan saytlar, screenshot)
- **Tashrif buyuruvchilar boshqaruvi**: Tashqi mehmonlarni ro'yxatga olish va nazorat qilish tizimi
- **Samaradorlik tahlili**: Hodimlar mehnat unumdorligini tahlil qilish va hisobotlar yaratish
- **RBAC asosida huquqlar**: Role-Based Access Control orqali xavfsiz va ierarxik boshqaruv

### 1.2 Loyiha qamrovi

**Qamrovdagi funksionallik:**
- Multi-organization, multi-department arxitektura
- HIKVision qurilmalari integratsiyasi (Access Control)
- C# Windows Agent (Active Directory Support)
- Real-time monitoring va analytics
- Comprehensive reporting system
- Visitor Management System
- Policy-based monitoring rules

**Qamrovdan tashqari:**
- Video surveillance va CCTV monitoring
- Mobile application (Phase 2)
- Biometric authentication (fingerprint/face recognition) - Phase 2
- Payroll integration
- Leave management system

### 1.3 Texnologiyalar stack

**Backend:**
- NestJS v10+ (Node.js framework)
- TypeScript 5+
- NX Monorepo (workspace management)
- Prisma ORM v5+ (PostgreSQL)
- Redis (caching va sessions)
- Socket.IO (real-time events)
- JWT (authentication)
- Winston (logging)

**Frontend:** (Phase 2)
- React 18+ / Next.js 14+
- TypeScript
- TailwindCSS / Ant Design
- React Query (data fetching)
- Socket.IO Client (real-time updates)

**Database:**
- PostgreSQL 15+ (main database)
- Redis 7+ (cache, sessions, queues)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)
- PM2 (process manager)

**Agent Application:**
- C# .NET Framework / .NET 6+
- Windows Service
- Active Directory Integration
- HTTP Client (API communication)

## 2. ROLE-BASED ACCESS CONTROL (RBAC)

### 2.1 Foydalanuvchi Rollari va Huquqlari

#### 2.1.1 Admin Role

- **Scope**: Butun tizim
- **Permissions**:
  - Barcha organizations, departments, sub_departments CRUD
  - Barcha users va permissions boshqaruvi
  - Barcha employees va computer users boshqaruvi
  - Barcha devices va HIKVision settings
  - Barcha monitoring data va reports
  - Barcha visitors va policies
  - System settings va configurations
  - Barcha logs va change histories

#### 2.1.2 HR Role

- **Scope**: Bitta organization
- **Permissions**:
  - Faqat o'z organizationining departments/sub_departments CRUD
  - Faqat o'z organizationining employees CRUD
  - Faqat o'z organizationining computer users linking
  - Faqat o'z organizationining visitors management
  - Faqat o'z organizationining entry/exit logs
  - Faqat o'z organizationining monitoring reports
  - Faqat o'z organizationining policies

#### 2.1.3 Department Lead Role

- **Scope**: Bitta department yoki sub_department
- **Permissions**:
  - Faqat o'z department/sub_departmentining employees ko'rish
  - Faqat o'z department/sub_departmentining monitoring reports
  - Faqat o'z department/sub_departmentining entry/exit logs
  - Faqat o'z department/sub_departmentining productivity reports
  - O'z department/sub_departmentining visitors ko'rish

#### 2.1.4 Guard Role

- **Scope**: Entry/Exit monitoring
- **Permissions**:
  - Faqat employees entry/exit logs ko'rish
  - Visitors entry/exit logs ko'rish
  - Visitors entry/exit ko’rinishida ro’yxatga olish
  - Real-time entry/exit notifications olish
  - Basic employee va visitor ma'lumotlari ko'rish
  - HIKVision devices status ko'rish

### 2.2 Permission Matrix

| Resource        | Admin    | HR             | Department Lead | Guard           |
| --------------- | -------- | -------------- | --------------- | --------------- |
| Organizations   | CRUD     | Read (own)     | Read (own)      | None            |
| Departments     | CRUD     | CRUD (own org) | Read (own)      | None            |
| Employees       | CRUD     | CRUD (own org) | Read (own dept) | Read (basic)    |
| Computer Users  | CRUD     | CRUD (own org) | Read (own dept) | None            |
| Visitors        | CRUD     | CRUD (own org) | Read (own dept) | Read/Create     |
| Entry/Exit Logs | Read All | Read (own org) | Read (own dept) | Read All        |
| Monitoring Data | Read All | Read (own org) | Read (own dept) | None            |
| Devices         | CRUD     | None           | None            | Read (status)   |
| Reports         | All      | Own org        | Own dept        | Entry/Exit only |
| Users           | CRUD     | None           | None            | None            |
| Policies        | CRUD     | CRUD (own org) | None            | None            |

## 3. TIZIM ARXITEKTURASI

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Systems                          │
├─────────────────────────────────────────────────────────────────┤
│  HIKVision Devices        C# Windows Agents (Multiple PCs)      │
│  (Access Control)         (Active Directory Integrated)          │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
               │ HTTP/TCP                    │ HTTPS/REST
               ↓                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                     NX Monorepo Backend                          │
├──────────────────────────┬──────────────────────────────────────┤
│   apps/agent-api         │      apps/dashboard-api              │
│   (Port 3001)            │      (Port 3000)                     │
│   ├─ HIKVision Module    │      ├─ Auth Module (JWT + RBAC)     │
│   ├─ Agent Data Module   │      ├─ Organizations Module         │
│   ├─ Data Processing     │      ├─ Departments Module           │
│   └─ Events Handler      │      ├─ Employees Module             │
│                          │      ├─ Monitoring Module            │
│                          │      ├─ Reports Module               │
│                          │      ├─ Visitors Module              │
│                          │      ├─ Devices Module               │
│                          │      ├─ Policies Module              │
│                          │      └─ Users Module                 │
├──────────────────────────┴──────────────────────────────────────┤
│                    Shared Libraries (libs/)                      │
│   ├─ @staff/database (Prisma + Models)                          │
│   ├─ @staff/auth (Guards, Decorators, RBAC)                     │
│   ├─ @staff/common (DTOs, Interfaces, Interceptors)             │
│   ├─ @staff/utils (Helpers, Validators)                         │
│   └─ @staff/repository (Data Access Layer)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Data & Cache Layer                           │
├──────────────────────────┬──────────────────────────────────────┤
│   PostgreSQL 15+         │      Redis 7+                        │
│   ├─ Organizations       │      ├─ User Sessions                │
│   ├─ Departments         │      ├─ JWT Blacklist                │
│   ├─ Employees           │      ├─ Real-time Events Queue       │
│   ├─ Entry Logs          │      └─ Cache (Reports, etc.)        │
│   ├─ Monitoring Data     │                                      │
│   ├─ Devices             │                                      │
│   └─ Policies            │                                      │
└─────────────────────────────────────────────────────────────────┘

                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                          │
│   ├─ Web Dashboard (Admin, HR, Lead, Guard)                     │
│   ├─ Real-time Notifications (Socket.IO)                        │
│   └─ Report Exports (PDF, Excel, CSV)                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow Architecture

**1. HIKVision Device Flow:**
```
HIKVision Device → Agent API (/api/agent/hikvision/events) 
→ Validate & Process → Save to DB (actions, entry_logs)
→ Emit Socket.IO Event → Real-time Dashboard Update
```

**2. C# Agent Flow:**
```
C# Agent (PC) → Agent API (/api/agent/active-windows, /screenshots)
→ Validate Computer User → Save Monitoring Data
→ Process & Analyze → Analytics Dashboard
```

**3. Dashboard User Flow:**
```
User Login → JWT Auth → RBAC Check → Filtered Data
→ Organization/Department Scope → Display Dashboard
```

### 3.3 Security Architecture

**Authentication Flow:**
```
User → Login (POST /api/auth/login) → Validate Credentials
→ Generate JWT (Access: 15min, Refresh: 7days)
→ Store in Redis → Return Tokens → Client Storage
```

**Authorization Flow:**
```
API Request → JWT Validation → Extract User Role & Scope
→ RBAC Guard Check → Permission Verification
→ Data Filtering (Organization/Department) → Response
```

### 3.4 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Linux Server                             │
├─────────────────────────────────────────────────────────────────┤
│  Nginx (Reverse Proxy)                                          │
│  ├─ / → Web Frontend (Static)                                   │
│  ├─ /api → Backend (Load Balance)                               │
│  └─ /socket.io → WebSocket Connection                           │
├─────────────────────────────────────────────────────────────────┤
│  Docker Containers                                              │
│  ├─ agent-api (3 instances with PM2)                            │
│  ├─ dashboard-api (3 instances with PM2)                        │
│  ├─ postgresql-15                                               │
│  ├─ redis-7                                                     │
│  └─ nginx                                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 4. BACKEND TALABLARI (NestJS + NX Monorepo)

### 4.1 NX Monorepo Structure

```
/staff (root)
├── apps/
│   ├── agent-api/                    # External systems API
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app/
│   │   │   └── modules/
│   │   │       ├── agent/            # C# Agent endpoints
│   │   │       ├── hikvision/        # HIKVision integration
│   │   │       ├── data-processing/  # Data validation & processing
│   │   │       └── security/         # API Key validation
│   │   ├── project.json
│   │   └── webpack.config.js
│   │
│   ├── agent-api-e2e/                # E2E tests for agent-api
│   │
│   ├── dashboard-api/                # Main business logic API
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app/
│   │   │   ├── core/                 # Core functionality
│   │   │   │   ├── config/
│   │   │   │   ├── middleware/
│   │   │   │   └── filters/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # JWT + RBAC
│   │   │   │   ├── users/
│   │   │   │   ├── organizations/
│   │   │   │   ├── departments/
│   │   │   │   ├── employees/
│   │   │   │   ├── entry-logs/
│   │   │   │   ├── monitoring/
│   │   │   │   ├── devices/
│   │   │   │   ├── visitors/
│   │   │   │   ├── reports/
│   │   │   │   └── policies/
│   │   │   └── shared/               # Shared utilities
│   │   ├── project.json
│   │   └── webpack.config.js
│   │
│   └── dashboard-api-e2e/            # E2E tests for dashboard-api
│
├── shared/                            # Shared libraries
│   ├── auth/                          # Authentication library
│   │   ├── src/
│   │   │   ├── guards/                # RBAC guards
│   │   │   ├── decorators/            # Custom decorators
│   │   │   ├── strategies/            # Passport strategies
│   │   │   └── interfaces/
│   │   └── package.json
│   │
│   ├── common/                        # Common utilities
│   │   ├── src/
│   │   │   ├── interceptors/          # Response interceptors
│   │   │   ├── dto/                   # Base DTOs
│   │   │   ├── interfaces/            # Common interfaces
│   │   │   ├── swagger/               # Swagger config
│   │   │   └── lib/
│   │   └── package.json
│   │
│   ├── database/                      # Prisma & Database
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   ├── migrations/
│   │   │   └── models/                # Extended model types
│   │   ├── src/
│   │   │   ├── prisma.service.ts
│   │   │   ├── prisma.module.ts
│   │   │   └── lib/
│   │   └── package.json
│   │
│   ├── repository/                    # Data access layer
│   │   ├── src/
│   │   │   ├── base/                  # Base repository
│   │   │   └── lib/                   # Repository implementations
│   │   └── package.json
│   │
│   └── utils/                         # Helper utilities
│       ├── src/
│       │   ├── validators/
│       │   ├── formatters/
│       │   ├── constants/
│       │   └── lib/
│       └── package.json
│
├── docs/                              # Documentation
├── scripts/                           # Utility scripts
├── nx.json                            # NX configuration
├── package.json                       # Root package.json
├── pnpm-workspace.yaml                # PNPM workspace
├── tsconfig.base.json                 # Base TypeScript config
└── README.md
```

### 4.2 Module Responsibilities

#### Agent API Modules

**1. HIKVision Module** (`apps/agent-api/src/modules/hikvision/`)
- HIKVision qurilmalardan event qabul qilish
- Access control events (kirish/chiqish)
- Device status monitoring
- Event validation va processing
- Real-time event emission

**2. Agent Module** (`apps/agent-api/src/modules/agent/`)
- C# agent registration va authentication
- Active windows tracking
- Visited sites logging
- Screenshot upload va storage
- User session management

**3. Data Processing Module** (`apps/agent-api/src/modules/data-processing/`)
- Ma'lumotlarni validate qilish
- Data normalization
- Batch processing
- Error handling va retry logic

**4. Security Module** (`apps/agent-api/src/modules/security/`)
- API key validation
- Device authentication
- Agent authorization
- Rate limiting

#### Dashboard API Modules

**1. Auth Module** (`apps/dashboard-api/src/modules/auth/`)
- User authentication (JWT)
- Token generation va validation
- Refresh token mechanism
- RBAC implementation
- Password hashing (bcrypt)
- Session management

**2. Users Module** (`apps/dashboard-api/src/modules/users/`)
- User CRUD operations (Admin only)
- Role management
- Organization/Department assignment
- User permissions
- Change password functionality

**3. Organizations Module** (`apps/dashboard-api/src/modules/organizations/`)
- Organizations CRUD (Admin, HR-own)
- Multi-tenancy support
- Organization settings
- Soft delete mechanism

**4. Departments Module** (`apps/dashboard-api/src/modules/departments/`)
- Departments va Sub-departments CRUD
- Hierarchical structure management
- Organization-Department relationship
- Policy assignment

**5. Employees Module** (`apps/dashboard-api/src/modules/employees/`)
- Employee CRUD (Role-based)
- Card va Car assignment
- Computer user linking
- Photo upload
- Employee filtering by organization/department

**6. Entry-Logs Module** (`apps/dashboard-api/src/modules/entry-logs/`)
- Entry/Exit logs retrieval (Role-based)
- Today's logs dashboard
- Employee-specific logs
- Attendance reports
- Work hours calculation
- Late arrival detection

**7. Monitoring Module** (`apps/dashboard-api/src/modules/monitoring/`)
- Computer users management
- Active windows logs
- Visited sites logs
- Screenshots retrieval
- User sessions tracking
- Employee activity reports
- Productivity analysis

**8. Devices Module** (`apps/dashboard-api/src/modules/devices/`)
- HIKVision devices CRUD (Admin)
- Device connection testing
- Device status monitoring
- Device configuration

**9. Visitors Module** (`apps/dashboard-api/src/modules/visitors/`)
- Visitors CRUD (Role-based)
- QR code generation
- Visitor entry/exit logs
- Visitor reports

**10. Reports Module** (`apps/dashboard-api/src/modules/reports/`)
- Attendance reports
- Productivity reports
- Device usage reports
- Visitor reports
- Custom report generation
- Export to PDF/Excel/CSV

**11. Policies Module** (`apps/dashboard-api/src/modules/policies/`)
- Monitoring policies CRUD
- Website policy management
- Department policy assignment
- Policy rules definition

#### Shared Libraries

**1. @staff/auth** (`shared/auth/`)
- `RolesGuard`: Role-based authorization
- `JwtAuthGuard`: JWT token validation
- `@Roles()`: Role decorator
- `@CurrentUser()`: User extraction decorator
- RBAC permission checker

**2. @staff/common** (`shared/common/`)
- `ResponseInterceptor`: Standardize responses
- `ErrorFilter`: Global error handling
- Base DTOs (PaginationDto, FilterDto)
- Common interfaces (ApiResponse, PaginatedResponse)
- Swagger configuration

**3. @staff/database** (`shared/database/`)
- `PrismaService`: Database connection
- `PrismaModule`: Prisma configuration
- Database models va types
- Migration management
- Seed data

**4. @staff/repository** (`shared/repository/`)
- `BaseRepository`: CRUD operations
- Specific repositories per entity
- Query builders
- Transaction management

**5. @staff/utils** (`shared/utils/`)
- Date/Time utilities
- Validation helpers
- File upload utilities
- Password generators
- Constants va enums

### 4.3 API Endpointlari (NX Monorepo - Role-based)

#### 4.3.1 Agent API Endpoints (apps/agent-api)

```
POST /api/agent/active-windows           [Agent only]
POST /api/agent/visited-sites            [Agent only]
POST /api/agent/screenshots              [Agent only]
POST /api/agent/user-sessions            [Agent only]
POST /api/agent/hikvision/actions        [HIKVision only]
POST /api/agent/hikvision/events         [HIKVision only]
POST /api/agent/hikvision/device-status  [HIKVision only]
```

#### 4.3.2 Dashboard API Endpoints (apps/dashboard-api)

**Authentication:**

```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
```

**Organizations (Admin, HR-own):**

```
GET    /api/organizations                   [Admin, HR-filtered]
POST   /api/organizations                   [Admin only]
PUT    /api/organizations/:id               [Admin only]
DELETE /api/organizations/:id               [Admin only]
GET    /api/organizations/:id/departments   [Admin, HR-own]
```

**Departments (Admin, HR-own org, Lead-own dept):**

```
GET    /api/departments                     [Admin, HR-filtered, Lead-filtered]
POST   /api/departments                     [Admin, HR-own org]
PUT    /api/departments/:id                 [Admin, HR-own org]
DELETE /api/departments/:id                 [Admin, HR-own org]
GET    /api/departments/:id/sub-departments [Admin, HR-own org, Lead-own]
```

**Employees (Role-based access):**

```
GET    /api/employees                       [Admin, HR-own org, Lead-own dept, Guard-basic]
POST   /api/employees                       [Admin, HR-own org]
PUT    /api/employees/:id                   [Admin, HR-own org]
DELETE /api/employees/:id                   [Admin, HR-own org]
GET    /api/employees/:id/entry-logs        [Admin, HR-own org, Lead-own dept, Guard]
GET    /api/employees/:id/activity-report   [Admin, HR-own org, Lead-own dept]
GET    /api/employees/:id/computer-users    [Admin, HR-own org, Lead-own dept]
POST   /api/employees/:id/assign-card       [Admin, HR-own org]
POST   /api/employees/:id/assign-car        [Admin, HR-own org]
POST   /api/employees/:id/link-computer-user [Admin, HR-own org]
DELETE /api/employees/:id/unlink-computer-user/:computer_user_id [Admin, HR-own org]
```

**Entry/Exit Logs (Admin, HR-own org, Lead-own dept, Guard-all):**

```
GET    /api/entry-logs                     [Admin, HR-filtered, Lead-filtered, Guard]
GET    /api/entry-logs/today               [Admin, HR-filtered, Lead-filtered, Guard]
GET    /api/entry-logs/report              [Admin, HR-own org, Lead-own dept, Guard]
GET    /api/entry-logs/employee/:id        [Admin, HR-own org, Lead-own dept, Guard]
```

**Computer Monitoring (Admin, HR-own org, Lead-own dept):**

```
GET    /api/computer-users                  [Admin, HR-filtered, Lead-filtered]
GET    /api/computer-users/unlinked         [Admin, HR-own org]
POST   /api/computer-users/:id/link-employee [Admin, HR-own org]
DELETE /api/computer-users/:id/unlink-employee [Admin, HR-own org]
GET    /api/computers                       [Admin, HR-filtered, Lead-filtered]
GET    /api/computers/:id/users             [Admin, HR-filtered, Lead-filtered]
GET    /api/monitoring/active-windows       [Admin, HR-filtered, Lead-filtered]
GET    /api/monitoring/visited-sites        [Admin, HR-filtered, Lead-filtered]
GET    /api/monitoring/screenshots          [Admin, HR-filtered, Lead-filtered]
GET    /api/monitoring/user-sessions        [Admin, HR-filtered, Lead-filtered]
GET    /api/monitoring/employee/:employee_id/activity [Admin, HR-own org, Lead-own dept]
GET    /api/monitoring/computer-user/:computer_user_id/activity [Admin, HR-own org, Lead-own dept]
```

**Devices (Admin only, Guard-status):**

```
GET    /api/devices                         [Admin, Guard-status only]
POST   /api/devices                         [Admin only]
PUT    /api/devices/:id                     [Admin only]
DELETE /api/devices/:id                     [Admin only]
POST   /api/devices/:id/test-connection     [Admin only]
```

**Visitors (Role-based access):**

```
GET    /api/visitors                        [Admin, HR-own org, Lead-own dept, Guard-basic]
POST   /api/visitors                        [Admin, HR-own org]
PUT    /api/visitors/:id                    [Admin, HR-own org]
DELETE /api/visitors/:id                    [Admin, HR-own org]
POST   /api/visitors/:id/generate-code      [Admin, HR-own org]
GET    /api/visitors/:id/entry-logs         [Admin, HR-own org, Lead-own dept, Guard]
```

**Reports (Role-based filtered):**

```
GET    /api/reports/attendance              [Admin, HR-own org, Lead-own dept, Guard]
GET    /api/reports/productivity            [Admin, HR-own org, Lead-own dept]
GET    /api/reports/device-usage            [Admin only]
GET    /api/reports/visitor-logs            [Admin, HR-own org, Lead-own dept, Guard]
POST   /api/reports/custom                  [Admin, HR-own org, Lead-own dept]
```

**Policies (Admin, HR-own org):**

```
GET    /api/policies                        [Admin, HR-own org]
POST   /api/policies                        [Admin, HR-own org]
PUT    /api/policies/:id                    [Admin, HR-own org]
DELETE /api/policies/:id                    [Admin, HR-own org]

POST /api/policies/website

```

**Users Management (Admin only):**

```
GET    /api/users                           [Admin only]
POST   /api/users                           [Admin only]
PUT    /api/users/:id                       [Admin only]
DELETE /api/users/:id                       [Admin only]
POST   /api/users/:id/change-role           [Admin only]
POST   /api/users/:id/assign-organization   [Admin only]
POST   /api/users/:id/assign-department     [Admin only]
```

### 4.4 Database Schema (Prisma)

**Core Entities:**
```prisma
// Organizations
model Organization {
  id                Int           @id @default(autoincrement())
  fullName          String        @db.VarChar(255)
  shortName         String        @unique @db.VarChar(50)
  address           String?       @db.Text
  phone             String?       @db.VarChar(20)
  email             String?       @unique @db.VarChar(100)
  additionalDetails String?       @db.Text
  isActive          Boolean       @default(true)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  departments       Department[]
  users             User[]
}

// Departments (Parent)
model Department {
  id                Int              @id @default(autoincrement())
  organization_id   Int
  fullName          String           @db.VarChar(255)
  shortName         String           @db.VarChar(50)
  address           String?          @db.Text
  phone             String?          @db.VarChar(20)
  email             String?          @db.VarChar(100)
  additionalDetails String?          @db.Text
  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  
  organization      Organization     @relation(fields: [organization_id], references: [id])
  childrens         SubDepartment[]
  employees         Employee[]       @relation("DepartmentEmployees")
}

// Sub-Departments (Children)
model SubDepartment {
  id                Int          @id @default(autoincrement())
  parent_id         Int
  policy_id         Int?
  fullName          String       @db.VarChar(255)
  shortName         String       @db.VarChar(50)
  address           String?      @db.Text
  phone             String?      @db.VarChar(20)
  email             String?      @db.VarChar(100)
  additionalDetails String?      @db.Text
  isActive          Boolean      @default(true)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  
  parent            Department   @relation(fields: [parent_id], references: [id])
  policy            Policy?      @relation(fields: [policy_id], references: [id])
  employees         Employee[]
}

// Employees
model Employee {
  id                Int              @id @default(autoincrement())
  personal_id       String           @unique @db.VarChar(14)
  sub_department_id Int
  name              String           @db.VarChar(255)
  address           String?          @db.Text
  phone             String?          @db.VarChar(20)
  email             String?          @unique @db.VarChar(100)
  photo             String?          @db.Text
  additionalDetails String?          @db.Text
  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  
  sub_department    SubDepartment    @relation(fields: [sub_department_id], references: [id])
  department        Department?      @relation("DepartmentEmployees", fields: [department_id], references: [id])
  cards             Card[]
  cars              Car[]
  computer_users    ComputerUser[]
  entry_logs        EntryLog[]
  visitors          Visitor[]
}

// Computer & Monitoring
model Computer {
  id           Int            @id @default(autoincrement())
  computer_id  Int            @unique
  os           String         @db.VarChar(100)
  ipAddress    String?        @db.VarChar(45)
  macAddress   String?        @db.VarChar(17)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  
  computer_users ComputerUser[]
}

model ComputerUser {
  id           Int                @id @default(autoincrement())
  computer_id  Int
  employee_id  Int?
  sid_id       String             @unique @db.VarChar(255)
  name         String?            @db.VarChar(255)
  domain       String?            @db.VarChar(100)
  username     String             @db.VarChar(100)
  isAdmin      Boolean            @default(false)
  is_in_domain Boolean            @default(false)
  isActive     Boolean            @default(true)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
  
  computer     Computer           @relation(fields: [computer_id], references: [id])
  employee     Employee?          @relation(fields: [employee_id], references: [id])
  active_windows ActiveWindow[]
  visited_sites  VisitedSite[]
  screenshots    Screenshot[]
  user_sessions  UserSession[]
}

// Monitoring Data
model ActiveWindow {
  id                Int          @id @default(autoincrement())
  computer_user_id  Int
  processName       String       @db.VarChar(255)
  windowTitle       String       @db.Text
  startTime         DateTime
  endTime           DateTime?
  duration          Int?         // seconds
  createdAt         DateTime     @default(now())
  
  computer_user     ComputerUser @relation(fields: [computer_user_id], references: [id])
  
  @@index([computer_user_id, startTime])
}

model VisitedSite {
  id                Int          @id @default(autoincrement())
  computer_user_id  Int
  url               String       @db.Text
  title             String?      @db.Text
  visitTime         DateTime
  duration          Int?         // seconds
  createdAt         DateTime     @default(now())
  
  computer_user     ComputerUser @relation(fields: [computer_user_id], references: [id])
  
  @@index([computer_user_id, visitTime])
}

model Screenshot {
  id                Int          @id @default(autoincrement())
  computer_user_id  Int
  filePath          String       @db.Text
  capturedAt        DateTime
  fileSize          Int?         // bytes
  createdAt         DateTime     @default(now())
  
  computer_user     ComputerUser @relation(fields: [computer_user_id], references: [id])
  
  @@index([computer_user_id, capturedAt])
}

// HIKVision & Entry Logs
model Device {
  id           Int       @id @default(autoincrement())
  name         String    @db.VarChar(255)
  ipAddress    String    @unique @db.VarChar(45)
  port         Int       @default(80)
  username     String    @db.VarChar(100)
  password     String    @db.VarChar(255)
  entry_type   EntryType @default(both)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  actions      Action[]
}

model Action {
  id             Int        @id @default(autoincrement())
  device_id      Int
  action_time    DateTime
  entry_type     EntryType
  action_type    ActionType
  action_result  String     @db.VarChar(255)
  createdAt      DateTime   @default(now())
  
  device         Device     @relation(fields: [device_id], references: [id])
  entry_log      EntryLog?
  
  @@index([device_id, action_time])
}

model EntryLog {
  id          Int      @id @default(autoincrement())
  employee_id Int?
  visitor_id  Int?
  action_id   Int      @unique
  createdAt   DateTime @default(now())
  
  employee    Employee? @relation(fields: [employee_id], references: [id])
  visitor     Visitor?  @relation(fields: [visitor_id], references: [id])
  action      Action    @relation(fields: [action_id], references: [id])
  
  @@index([employee_id, createdAt])
  @@index([visitor_id, createdAt])
}

// Users & Authentication
model User {
  id              Int           @id @default(autoincrement())
  name            String        @db.VarChar(255)
  login           String        @unique @db.VarChar(100)
  password        String        @db.VarChar(255)
  role            Role          @default(guard)
  organization_id Int?
  department_id   Int?
  sub_department_id Int?
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  organization    Organization? @relation(fields: [organization_id], references: [id])
  refresh_tokens  RefreshToken[]
}

model RefreshToken {
  id          Int      @id @default(autoincrement())
  user_id     Int
  token       String   @unique @db.Text
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  @@index([user_id])
}

// Policies
model Policy {
  id                    Int              @id @default(autoincrement())
  name                  String           @db.VarChar(255)
  description           String?          @db.Text
  screenshotInterval    Int              @default(300) // seconds
  trackActiveWindows    Boolean          @default(true)
  trackVisitedSites     Boolean          @default(true)
  isActive              Boolean          @default(true)
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
  
  sub_departments       SubDepartment[]
  website_policies      WebsitePolicy[]
}

model WebsitePolicy {
  id          Int      @id @default(autoincrement())
  policy_id   Int
  url         String   @db.Text
  action      WebsiteAction @default(warn)
  createdAt   DateTime @default(now())
  
  policy      Policy   @relation(fields: [policy_id], references: [id], onDelete: Cascade)
  
  @@index([policy_id])
}

// Enums
enum Role {
  admin
  hr
  department_lead
  guard
}

enum EntryType {
  enter
  exit
  both
}

enum ActionType {
  card
  qr
  face
}

enum WebsiteAction {
  block
  warn
  allow
}
```

### 4.5 Database Connection & Optimization

**Connection Configuration:**
```typescript
// shared/database/src/lib/prisma.service.ts
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Connection Pool
  connection_limit = 20
  pool_timeout     = 20
}

// Logging
log = ["query", "error", "warn"]

// Extensions
extensions = [postgis, uuid-ossp]
```

**Optimization Strategies:**
- **Indexes**: Critical queries (employee_id, date ranges, etc.)
- **Connection Pooling**: Max 20 connections per instance
- **Query Optimization**: Use Prisma's select va include strategically
- **Pagination**: All list endpoints must be paginated
- **Caching**: Redis for frequent queries (users, organizations)
- **Soft Deletes**: isActive flag instead of hard delete

### 4.6 Caching Strategy (Redis)

**Cache Keys Structure:**
```
user:session:{userId}              → User session data (TTL: 15 min)
user:permissions:{userId}          → User permissions cache (TTL: 1 hour)
org:departments:{orgId}            → Organization departments (TTL: 1 hour)
report:cache:{reportId}            → Generated reports (TTL: 24 hours)
jwt:blacklist:{token}              → Blacklisted tokens (TTL: token expiry)
device:status:{deviceId}           → Device online status (TTL: 5 min)
realtime:entries:today             → Today's entries cache (TTL: 5 min)
```

**Cache Invalidation:**
- On entity update/delete → Clear related caches
- On user role change → Clear permission cache
- On policy update → Clear affected department caches

### 4.7 Real-time Features (Socket.IO)

**Events:**
```typescript
// Server → Client Events
'entry:new'              → Yangi kirish/chiqish
'entry:updated'          → Entry log yangilandi
'device:status'          → Qurilma holati o'zgarishi
'visitor:arrived'        → Mehmon keldi
'alert:triggered'        → Policy buzilishi alerti

// Client → Server Events
'subscribe:organization' → Organization eventlariga obuna
'subscribe:department'   → Department eventlariga obuna
'unsubscribe'           → Obunani bekor qilish
```

**Room-based Broadcasting:**
- `org:${organizationId}` → Organization-specific events
- `dept:${departmentId}` → Department-specific events
- `user:${userId}` → User-specific notifications
- `guard` → All guards realtime dashboard

## 5. NON-FUNCTIONAL REQUIREMENTS

### 5.1 Performance Requirements

**Response Time:**
- API endpoints: < 200ms (95th percentile)
- Complex reports: < 3 seconds
- Real-time events: < 100ms latency
- Database queries: < 100ms
- File uploads (photos/screenshots): < 5 seconds

**Throughput:**
- Agent API: 1000+ requests/second
- Dashboard API: 500+ concurrent users
- WebSocket connections: 500+ simultaneous
- HIKVision events: 100+ events/second processing

**Scalability:**
- Horizontal scaling capability
- Stateless API design
- Load balancing support
- Auto-scaling based on CPU/Memory

### 5.2 Security Requirements

**Authentication:**
- JWT-based authentication
- Bcrypt password hashing (salt rounds: 10)
- Refresh token rotation
- Token blacklisting for logout
- Session timeout: 15 minutes (access), 7 days (refresh)

**Authorization:**
- Role-Based Access Control (RBAC)
- Organization/Department scope filtering
- API endpoint protection
- Resource-level permissions

**Data Security:**
- HTTPS/TLS encryption
- SQL injection prevention (Prisma ORM)
- XSS prevention
- CSRF protection
- Rate limiting (100 req/min per IP)
- Input validation va sanitization
- Sensitive data encryption (passwords, API keys)

**Audit Trail:**
- User action logging
- Change history tracking
- Login/logout logs
- Failed authentication attempts

### 5.3 Reliability & Availability

**Uptime:**
- Target: 99.5% availability
- Planned maintenance windows
- Graceful degradation

**Backup:**
- Database: Daily automated backups
- Retention: 30 days
- Point-in-time recovery capability
- Screenshot/photo backups

**Error Handling:**
- Global exception filters
- Structured error responses
- Retry mechanisms for external systems
- Circuit breaker pattern for HIKVision devices

### 5.4 Maintainability

**Code Quality:**
- TypeScript strict mode
- ESLint + Prettier configuration
- Code review process
- Unit test coverage: > 70%
- E2E test coverage for critical paths

**Documentation:**
- Swagger/OpenAPI documentation
- Code comments for complex logic
- README files per module
- Architecture decision records (ADR)

**Monitoring:**
- Application logs (Winston)
- Performance monitoring
- Error tracking
- Health check endpoints

### 5.5 Usability Requirements

**API Design:**
- RESTful conventions
- Consistent response format
- Clear error messages
- Proper HTTP status codes
- Pagination support
- Filtering & sorting capabilities

**Internationalization:**
- Response messages in Uzbek/Russian
- Date/time formatting
- Time zone support

### 5.6 Compatibility

**Browser Support:** (Frontend - Phase 2)
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Operating Systems:**
- Backend: Linux (Ubuntu 20.04+)
- C# Agent: Windows 10/11, Windows Server 2016+

**Database:**
- PostgreSQL 15+
- Redis 7+

### 5.7 Data Retention

**Monitoring Data:**
- Active windows: 90 days
- Visited sites: 90 days
- Screenshots: 30 days
- User sessions: 30 days

**Entry Logs:**
- Permanent storage
- Archival after 1 year

**Reports:**
- Generated reports: 7 days cache
- Custom reports: On-demand generation

## 6. API STANDARDS & CONVENTIONS

### 6.1 Response Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "details": {} // Optional additional details
  }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

### 6.2 HTTP Status Codes

- **200**: Success (GET, PUT)
- **201**: Created (POST)
- **204**: No Content (DELETE)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate resource)
- **422**: Unprocessable Entity
- **429**: Too Many Requests (rate limit)
- **500**: Internal Server Error
- **503**: Service Unavailable

### 6.3 Error Codes

```typescript
enum ErrorCodes {
  // Authentication
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Authorization
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Resource
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CANNOT_DELETE = 'CANNOT_DELETE',
  
  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}
```

### 6.4 Naming Conventions

**API Endpoints:**
- Lowercase with hyphens: `/api/entry-logs`
- Plural nouns: `/api/employees`
- Resource hierarchy: `/api/organizations/:id/departments`

**Query Parameters:**
- snake_case: `?start_date=...&employee_id=...`
- Boolean: `?isActive=true`
- Arrays: `?roles[]=admin&roles[]=hr`

**Request/Response Fields:**
- snake_case for API: `employee_id`, `sub_department_id`
- camelCase in TypeScript: `employeeId`, `subDepartmentId`

### 6.5 Pagination

**Query Parameters:**
```
?page=1&limit=10
```

**Default Values:**
- page: 1
- limit: 10
- max limit: 100

## 7. TESTING STRATEGY

### 7.1 Unit Tests

**Coverage:**
- Services: Business logic tests
- Guards: RBAC permission tests
- Utilities: Helper function tests
- Target: > 70% coverage

**Tools:**
- Jest
- @nestjs/testing

### 7.2 Integration Tests

**Coverage:**
- API endpoints
- Database operations
- External system integrations (HIKVision, C# Agent)

**Tools:**
- Jest
- Supertest

### 7.3 E2E Tests

**Coverage:**
- Critical user flows
- Authentication/Authorization flows
- CRUD operations
- Role-based access scenarios

**Tools:**
- Jest
- NX e2e test projects

### 7.4 Performance Tests

**Coverage:**
- Load testing (concurrent users)
- Stress testing (peak loads)
- API response times
- Database query performance

**Tools:**
- Artillery / K6
- PostgreSQL EXPLAIN ANALYZE

## 8. DEPLOYMENT & DEVOPS

### 8.1 Environment Configuration

**Environments:**
- Development (local)
- Staging (test server)
- Production (live server)

**Environment Variables:**
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/staff_db"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# JWT
JWT_SECRET="your-secret-key"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# API Keys
AGENT_API_KEY="agent-secret-key"
HIKVISION_API_KEY="hikvision-secret-key"

# File Upload
UPLOAD_PATH="/uploads"
MAX_FILE_SIZE=10485760 # 10MB

# Server
PORT=3000
NODE_ENV="production"
```

### 8.2 Docker Configuration

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: staff_db
      POSTGRES_USER: staff_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
  
  agent-api:
    build:
      context: .
      dockerfile: apps/agent-api/Dockerfile
    environment:
      - DATABASE_URL
      - REDIS_HOST=redis
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
  
  dashboard-api:
    build:
      context: .
      dockerfile: apps/dashboard-api/Dockerfile
    environment:
      - DATABASE_URL
      - REDIS_HOST=redis
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
  
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - agent-api
      - dashboard-api

volumes:
  postgres_data:
  redis_data:
```

### 8.3 CI/CD Pipeline

**GitHub Actions / GitLab CI:**
```yaml
stages:
  - lint
  - test
  - build
  - deploy

lint:
  - npm run lint

test:
  - npm run test:cov
  - Coverage report

build:
  - npm run build
  - Docker image build

deploy:
  - Deploy to staging (auto)
  - Deploy to production (manual approval)
```

### 8.4 Monitoring & Logging

**Logging:**
- Winston logger
- Log levels: error, warn, info, debug
- Log rotation (daily, 30 days retention)
- Structured logging (JSON format)

**Monitoring:**
- PM2 monitoring
- Health check endpoints: `/health`, `/ready`
- Database connection status
- Redis connection status
- External service status (HIKVision)

**Alerting:**
- Critical errors → Email/Telegram notification
- Service downtime → Immediate alert
- High CPU/Memory usage → Warning

## 9. USE CASE LAR

### UC-1: Tizimga Kirish (Login)

**API**: POST /api/auth/login **Actor**: User (Admin/HR/Department Lead/Guard)
**Precondition**: User account mavjud va faol **Request Body**:

```json
{
  "login": "user@example.com",
  "password": "password123"
}
```

**Main Flow**:

1. User login sahifasiga kiradi
2. Login va parolni kiritadi
3. Frontend POST /api/auth/login ga request yuboradi
4. Server login va parolni tekshiradi:
   - User mavjudligini tekshiradi
   - Parol to'g'riligini tekshiradi (bcrypt)
   - User faolligini (isActive) tekshiradi
5. Muvaffaqiyatli bo'lsa:
   - JWT access token yaratadi (15 daqiqa)
   - JWT refresh token yaratadi (7 kun)
   - User ma'lumotlarini qaytaradi
6. Frontend tokenlarni localStorage ga saqlaydi
7. User dashboard sahifasiga yo'naltiriladi

**Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "login": "john@example.com",
      "role": "admin",
      "organization_id": 1,
      "department_id": 2
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_in": 900
    }
  }
}
```

**Alternative Flow - Muvaffaqiyatsiz Login**:

- Noto'g'ri login/parol (401 Unauthorized)
- User faol emas (403 Forbidden)
- Account bloklangan (423 Locked)

**Error Response (401)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Login yoki parol noto'g'ri"
  }
}
```

### UC-2: Tizimdan Chiqish (Logout)

**API**: POST /api/auth/logout **Actor**: Authenticated User **Precondition**:
User tizimga kirgan **Request Header**:

Authorization: Bearer \<access_token\>

**Main Flow**:

1. User "Logout" tugmasini bosadi
2. Frontend POST `/api/auth/logout` ga request yuboradi
3. Server access token ni tekshiradi
4. Refresh token ni database dan o'chiradi yoki blacklist ga qo'shadi
5. Server muvaffaqiyatli javob qaytaradi
6. Frontend localStorage dan tokenlarni o'chiradi
7. User login sahifasiga yo'naltiriladi

**Success Response (200)**:

```json
{
  "success": true,
  "message": "Muvaffaqiyatli chiqildi"
}
```

**Alternative Flow**:

- Token yaroqsiz bo'lsa ham logout amalga oshiriladi
- Frontend har doim tokenlarni o'chiradi

### UC-3: Token Yangilash (Refresh Token)

**API**: POST /api/auth/refresh-token **Actor**: Authenticated User (Automatic)
**Precondition**: Refresh token mavjud va yaroqli **Request Body**:

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Main Flow**:

1. Access token muddati tugaydi (15 daqiqa)
2. Frontend API request yuborayotganda 401 error oladi
3. Frontend avtomatik ravishda refresh token bilan yangi token so'raydi
4. Server refresh token ni tekshiradi:
   - Token formatini tekshiradi
   - Token muddatini tekshiradi (7 kun)
   - Token blacklist da emasligini tekshiradi
   - User faolligini tekshiradi
5. Muvaffaqiyatli bo'lsa:
   - Yangi access token yaratadi
   - Yangi refresh token yaratadi (ixtiyoriy)
   - Eski refresh token ni bekor qiladi
6. Frontend yangi tokenlarni saqlaydi
7. Asl API request qayta yuboriladi

**Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900
  }
}
```

**Alternative Flow - Token Yangilash Muvaffaqiyatsiz**:

- Refresh token yaroqsiz (401)
- Refresh token muddati tugagan (401)
- User account faol emas (403)

**Error Response (401)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token yaroqsiz yoki muddati tugagan"
  }
}
```

### UC-5: Tashkilotlar Ro'yxatini Olish (Role-based)

**API**: GET /api/organizations **Actor**: Admin/HR (role-based access)
**Precondition**: User tizimga kirgan

**Admin Flow**:

1. Admin "Organizations" sahifasini ochadi
2. Barcha organizations ro'yxati ko'rsatiladi
3. CRUD operations mavjud

**HR Flow**:

1. HR "Dashboard" sahifasini ochadi
2. Faqat o'z organizationining ma'lumotlari ko'rsatiladi
3. Faqat read-only access

**Success Response (Admin)**:

```json
{
  "success": true,
  "data": {
    "organizations": [...], // All organizations
    "user_permissions": {
      "can_create": true,
      "can_edit": true,
      "can_delete": true
    }
  }
}
```

**Success Response (HR)**:

```json
{
  "success": true,
  "data": {
    "organizations": [...], // Only user's organization
    "user_permissions": {
      "can_create": false,
      "can_edit": false,
      "can_delete": false
    }
  }
}
```

**API**: GET `/api/organizations` **Actor**: Admin/HR **Precondition**: User
tizimga kirgan va tegishli huquqlarga ega **Request Header**:

Authorization: Bearer \<access_token\>

**Query Parameters (ixtiyoriy)**:

```
?page=1&limit=10&search=tashkilot_nomi&isActive=true&sort=createdAt&order=desc
```

**Main Flow**:

1. Admin "Organizations" sahifasini ochadi
2. Frontend GET /api/organizations ga request yuboradi
3. Server user huquqlarini tekshiradi
4. Server database dan organizations ro'yxatini oladi:
   - Pagination (sahifalash)
   - Search filter (nom bo'yicha qidiruv)
   - Status filter (faol/nofaol)
   - Sorting (yaratilgan sana, nom, etc.)
5. Server tashkilotlar ro'yxatini qaytaradi

**Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "organizations": [
      {
        "id": 1,
        "fullName": "O'zbekiston Respublikasi Vazirlar Mahkamasi",
        "shortName": "VzM",
        "address": "Toshkent sh., Mustaqillik maydoni",
        "phone": "+998712391234",
        "email": "info@gov.uz",
        "additionalDetails": "Davlat boshqaruv organi",
        "isActive": true,
        "departments_count": 15,
        "employees_count": 245,
        "createdAt": "2024-01-15T09:00:00Z",
        "updatedAt": "2024-03-20T14:30:00Z"
      }
    ],
    "page": 1,
    "total": 25,
    "limit": 10
  }
}
```

### UC-6: Yangi Tashkilot Yaratish

**API**: POST /api/organizations **Actor**: Admin **Precondition**: Admin
huquqlari mavjud **Request Body**:

```json
{
  "fullName": "Aloqachi Technologies LLC",
  "shortName": "Aloqachi",
  "address": "Toshkent sh., Chilonzor tumani, 5-mavze",
  "phone": "+998901234567",
  "email": "info@aloqachi.uz",
  "additionalDetails": "IT kompaniyasi"
}
```

**Main Flow**:

1. Admin "Add Organization" tugmasini bosadi
2. Modal oyna ochiladi va forma ko'rsatiladi
3. Admin tashkilot ma'lumotlarini to'ldiradi
4. "Save" tugmasini bosadi
5. Frontend ma'lumotlarni validate qiladi:
   - Required fieldlar to'ldirilganligini tekshiradi
   - Email format tekshiradi
   - Phone format tekshiradi
6. Frontend POST /api/organizations ga request yuboradi
7. Server ma'lumotlarni validate qiladi:
   - Unique fields (email, shortName) tekshiradi
   - Data types va formatlarni tekshiradi
8. Server yangi tashkilot yaratadi
9. Server yaratilgan tashkilot ma'lumotlarini qaytaradi
10. Frontend success message ko'rsatadi va ro'yxatni yangilaydi

**Success Response (201)**:

```json
{
  "success": true,
  "message": "Tashkilot muvaffaqiyatli yaratildi",
  "data": {
    "organization": {
      "id": 26,
      "fullName": "Aloqachi Technologies LLC",
      "shortName": "Aloqachi",
      "address": "Toshkent sh., Chilonzor tumani, 5-mavze",
      "phone": "+998901234567",
      "email": "info@aloqachi.uz",
      "additionalDetails": "IT kompaniyasi",
      "isActive": true,
      "createdAt": "2024-08-24T12:00:00Z",
      "updatedAt": "2024-08-24T12:00:00Z"
    }
  }
}
```

**Alternative Flow - Validation Error**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ma'lumotlar noto'g'ri",
    "details": {
      "email": "Bu email allaqachon ishlatilgan",
      "phone": "Telefon raqam formati noto'g'ri"
    }
  }
}
```

### UC-7: Tashkilotni Tahrirlash

**API**: PUT /api/organizations/:id **Actor**: Admin **Precondition**: Tashkilot
mavjud va admin huquqlari bor **Request Body**:

```json
{
  "fullName": "Aloqachi Technologies LLC (Updated)",
  "shortName": "Aloqachi-Tech",
  "address": "Toshkent sh., Yashnobod tumani, 7-mavze",
  "phone": "+998901234568",
  "email": "contact@aloqachi.uz",
  "additionalDetails": "Software development company"
}
```

**Main Flow**:

1. Admin tashkilotlar ro'yxatidan birini tanlaydi
2. "Edit" tugmasini bosadi
3. Edit modal oyna ochiladi va mavjud ma'lumotlar ko'rsatiladi
4. Admin kerakli o'zgarishlarni kiritadi
5. "Update" tugmasini bosadi
6. Frontend o'zgarishlarni validate qiladi
7. Frontend PUT /api/organizations/:id ga request yuboradi
8. Server tashkilot mavjudligini tekshiradi
9. Server user huquqlarini tekshiradi
10. Server o'zgarishlarni validate qiladi
11. Server tashkilot ma'lumotlarini yangilaydi
12. Change history table ga o'zgarishlarni yozadi
13. Server yangilangan ma'lumotlarni qaytaradi
14. Frontend success message ko'rsatadi

**Success Response (200)**:

```json
{
  "success": true,
  "message": "Tashkilot ma'lumotlari yangilandi",
  "data": {
    "organization": {
      "id": 26,
      "fullName": "Aloqachi Technologies LLC (Updated)",
      "shortName": "Aloqachi-Tech",
      "address": "Toshkent sh., Yashnobod tumani, 7-mavze",
      "phone": "+998901234568",
      "email": "contact@aloqachi.uz",
      "additionalDetails": "Software development company",
      "isActive": true,
      "createdAt": "2024-08-24T12:00:00Z",
      "updatedAt": "2024-08-24T12:30:00Z"
    }
  }
}
```

**UC-8: Tashkilotni O'chirish**

**API**: DELETE /api/organizations/:id **Actor**: Admin **Precondition**:
Tashkilot mavjud va admin huquqlari bor **Path Parameter**: organization ID

**Main Flow**:

1. Admin tashkilotlar ro'yxatidan birini tanlaydi
2. "Delete" tugmasini bosadi
3. Confirmation modal ko'rsatiladi: "Bu tashkilotni o'chirmoqchimisiz? Bu amal
   qaytarib bo'lmaydi."
4. Admin "Confirm" tugmasini bosadi
5. Frontend DELETE /api/organizations/:id ga request yuboradi
6. Server tashkilot mavjudligini tekshiradi
7. Server user huquqlarini tekshiradi
8. Server bog'liqliklarni tekshiradi:
   - Departments mavjudmi?
   - Employees mavjudmi?
   - Active entries mavjudmi?
9. Agar bog'liqliklar mavjud bo'lsa - soft delete (isActive \= false)
10. Agar bog'liqliklar yo'q bo'lsa - hard delete
11. Change history ga yozuv qo'shadi
12. Server muvaffaqiyat javobini qaytaradi
13. Frontend ro'yxatdan o'chiradi va success message ko'rsatadi

**Success Response (200) - Soft Delete**:

```json
{
  "success": true,
  "message": "Tashkilot nofaol holga o'tkazildi",
  "data": {
    "deleted": false,
    "deactivated": true
  }
}
```

**Success Response (200) - Hard Delete**:

```json
{
  "success": true,
  "message": "Tashkilot butunlay o'chirildi",
  "data": {
    "deleted": true,
    "deactivated": false
  }
}
```

**Alternative Flow - Cannot Delete**:

```json
{
  "success": false,
  "error": {
    "code": "CANNOT_DELETE",
    "message": "Tashkilotni o'chirish mumkin emas",
    "details": {
      "reason": "Bu tashkilotda 15 ta department va 245 ta hodim mavjud",
      "suggestion": "Avval barcha departmentlar va hodimlarni o'chiring yoki boshqa tashkilotga o'tkazing"
    }
  }
}
```

**UC-9: Departmentlar Ro'yxatini Olish (Role-based)**

**API**: GET /api/departments **Actor**: Admin/HR/Department Lead
**Precondition**: User tizimga kirgan va tegishli huquqlarga ega

**Admin Flow**:

1. Admin "Departments" sahifasini ochadi
2. Frontend GET /api/departments ga request yuboradi (filter yo'q)
3. Server barcha departmentlarni qaytaradi
4. Admin barcha organizationlarning departmentlarini ko'radi

**HR Flow**:

1. HR "Departments" sahifasini ochadi
2. Frontend user.organization_id bilan filter qo'yib request yuboradi
3. Server faqat HR ning organizationiga tegishli departmentlarni qaytaradi
4. HR faqat o'z organizationining departmentlarini ko'radi

**Department Lead Flow**:

1. Department Lead "My Department" sahifasini ochadi
2. Frontend user.department_id va user.sub_department_id bilan filter qo'yib
   request yuboradi
3. Server faqat Lead ning department/sub_departmentini qaytaradi
4. Lead faqat o'z departmentini ko'radi

**Query Parameters**:

```
?organization_id=1&search=IT&isActive=true&sort=name&order=asc&page=1&limit=10
```

**Success Response (Admin - All departments)**:

```json
{
  "success": true,
  "data": {
    "departments": [
      {
        "id": 1,
        "organization_id": 1,
        "organizationName": "VzM",
        "fullName": "Iqtisodiyot va moliya departamenti",
        "shortName": "IMD",
        "address": "Toshkent sh., Mustaqillik maydoni, 1-bino",
        "phone": "+998712391235",
        "email": "econ@gov.uz",
        "additionalDetails": "Iqtisodiy masalalar",
        "isActive": true,
        "_count": {
          "childrens": 5,
          "employees": 5
        },
        "createdAt": "2024-01-20T09:00:00Z",
        "updatedAt": "2024-03-15T14:00:00Z"
      }
    ],
    "page": 1,
    "total": 75,
    "limit": 10,
    "user_permissions": {
      "can_create": true,
      "can_edit": true,
      "can_delete": true,
      "can_viewAll_orgs": true
    }
  }
}
```

**Success Response (HR - Own organization only)**:

```json
{
  "success": true,
  "data": {
    "departments": [
      {
        "id": 1,
        "organization_id": 1,
        "fullName": "Iqtisodiyot va moliya departamenti",
        "shortName": "IMD",
        "address": "Toshkent sh., Mustaqillik maydoni, 1-bino",
        "phone": "+998712391235",
        "email": "econ@gov.uz",
        "additionalDetails": "Iqtisodiy masalalar",
        "isActive": true,
        "sub_departments_count": 5,
        "employees_count": 45,
        "createdAt": "2024-01-20T09:00:00Z"
      }
    ],
    "page": 1,
    "total": 15,
    "limit": 10,
    "user_permissions": {
      "can_create": true,
      "can_edit": true,
      "can_delete": true,
      "can_viewAll_orgs": false
    }
  }
}
```

**Success Response (Department Lead - Own department only)**:

```json
{
  "success": true,
  "data": {
    "departments": [
      {
        "id": 1,
        "organization_id": 1,
        "fullName": "Iqtisodiyot va moliya departamenti",
        "shortName": "IMD",
        "sub_departments_count": 5,
        "employees_count": 45,
        "isActive": true
      }
    ],
    "user_permissions": {
      "can_create": false,
      "can_edit": false,
      "can_delete": false,
      "can_viewAll_orgs": false
    }
  }
}
```

**UC-10: Yangi Department Yaratish**

**API**: POST /api/departments **Actor**: Admin/HR **Precondition**: Admin yoki
HR huquqlari mavjud

**Admin Flow**:

1. Admin "Add Department" tugmasini bosadi
2. Modal ochiladi va barcha organizationlar dropdown da ko'rsatiladi
3. Admin istalgan organizationni tanlaydi
4. Department ma'lumotlarini to'ldiradi

**HR Flow**:

1. HR "Add Department" tugmasini bosadi
2. Modal ochiladi lekin organization avtomatik o'z organizationi bo'ladi
3. HR faqat o'z organizationiga department qo'sha oladi

**Request Body (Admin)**:

```json
{
  "organization_id": 2,
  "fullName": "Axborot texnologiyalari departamenti",
  "shortName": "ATD",
  "address": "Toshkent sh., Chilonzor tumani",
  "phone": "+998712391240",
  "email": "it@company.uz",
  "additionalDetails": "IT va dasturiy ta'minot"
}
```

**Request Body (HR - organization_id auto-filled)**:

```json
{
  "fullName": "Marketing departamenti",
  "shortName": "MD",
  "address": "Toshkent sh., Mirobod tumani",
  "phone": "+998712391241",
  "email": "marketing@company.uz",
  "additionalDetails": "Marketing va reklama"
}
```

**Success Response (201)**:

```json
{
  "success": true,
  "message": "Department muvaffaqiyatli yaratildi",
  "data": {
    "department": {
      "id": 26,
      "organization_id": 2,
      "fullName": "Axborot texnologiyalari departamenti",
      "shortName": "ATD",
      "address": "Toshkent sh., Chilonzor tumani",
      "phone": "+998712391240",
      "email": "it@company.uz",
      "additionalDetails": "IT va dasturiy ta'minot",
      "isActive": true,
      "createdAt": "2024-08-24T15:00:00Z",
      "updatedAt": "2024-08-24T15:00:00Z"
    }
  }
}
```

**UC-11: Department Tahrirlash**

**API**: PUT /api/departments/:id **Actor**: Admin/HR **Precondition**:
Department mavjud va tegishli huquq bor

**Permission Check Flow**:

1. User "Edit" tugmasini bosadi
2. Frontend department ID bilan PUT request yuboradi
3. Server department mavjudligini tekshiradi
4. Server permission tekshiradi:
   - Admin: Barcha departmentlarni tahrirlashi mumkin
   - HR: Faqat o'z organizationining departmentlarini

**Request Body**:

```json
{
  "fullName": "Axborot texnologiyalari departamenti (Updated)",
  "shortName": "AT-Dept",
  "address": "Toshkent sh., Yashnobod tumani, yangi ofis",
  "phone": "+998712391242",
  "email": "it-dept@company.uz",
  "additionalDetails": "IT, dasturiy ta'minot va kiberbezopaslik"
}
```

**Success Response (200)**:

```json
{
  "success": true,
  "message": "Department ma'lumotlari yangilandi",
  "data": {
    "department": {
      "id": 26,
      "organization_id": 2,
      "fullName": "Axborot texnologiyalari departamenti (Updated)",
      "shortName": "AT-Dept",
      "updatedAt": "2024-08-24T15:30:00Z"
    }
  }
}
```

**UC-12: Department O'chirish**

**API**: DELETE /api/departments/:id **Actor**: Admin/HR **Precondition**:
Department mavjud va tegishli huquq bor

**Dependency Check Flow**:

1. User "Delete" tugmasini bosadi
2. Frontend confirmation modal ko'rsatadi
3. User confirm qilsa, DELETE request yuboradi
4. Server dependency check qiladi:
   - Sub-departments mavjudmi?
   - Employees mavjudmi?
   - Active policies mavjudmi?
5. Agar dependency bo'lsa - soft delete
6. Agar dependency yo'q bo'lsa - hard delete yoki error

**Success Response - Soft Delete (200)**:

```json
{
  "success": true,
  "message": "Department nofaol holga o'tkazildi",
  "data": {
    "deleted": false,
    "deactivated": true,
    "reason": "5 ta sub-department va 25 ta hodim mavjud"
  }
}
```

**Error Response - Cannot Delete (400)**:

```json
{
  "success": false,
  "error": {
    "code": "CANNOT_DELETE",
    "message": "Departmentni o'chirish mumkin emas",
    "details": {
      "sub_departments": 5,
      "employees": 25,
      "suggestion": "Avval barcha sub-departmentlar va hodimlarni boshqa joyga o'tkazing"
    }
  }
}
```

**UC-13: Department Sub-departmentlarini Olish**

**API**: GET `/api/departments/:id/sub-departments` **Actor**:
Admin/HR/Department Lead **Precondition**: Department mavjud va access huquqi
bor

**Permission-based Access**:

- **Admin**: Barcha departmentning sub-departmentlari
- **HR**: Faqat o'z organizationining departmentlari
- **Department Lead**: Faqat o'z departmentining sub-departmentlari

**Main Flow**:

1. User department sahifasini ochadi
2. "Sub-departments" tabini tanlaydi
3. Frontend GET `/api/departments/:id/sub-departments` ga request yuboradi
4. Server permission check qiladi
5. Sub-departments ro'yxatini qaytaradi

**Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "department": {
      "id": 1,
      "fullName": "Iqtisodiyot va moliya departamenti",
      "shortName": "IMD",
      "organizationName": "VzM"
    },
    "sub_departments": [
      {
        "id": 1,
        "fullName": "Byudjet bo'limi",
        "shortName": "BB",
        "address": "1-bino, 2-qavat",
        "phone": "+998712391250",
        "email": "budget@gov.uz",
        "additionalDetails": "Byudjet rejalashtirish",
        "isActive": true,
        "employees_count": 12,
        "policy_id": 1,
        "policyName": "Standard Monitoring",
        "createdAt": "2024-02-01T09:00:00Z",
        "updatedAt": "2024-03-20T14:00:00Z"
      },
      {
        "id": 2,
        "fullName": "Moliyaviy tahlil bo'limi",
        "shortName": "MTB",
        "address": "1-bino, 3-qavat",
        "phone": "+998712391251",
        "email": "analysis@gov.uz",
        "additionalDetails": "Moliyaviy hisobotlar tahlili",
        "isActive": true,
        "employees_count": 8,
        "policy_id": 2,
        "policyName": "High Security Monitoring",
        "createdAt": "2024-02-15T10:00:00Z",
        "updatedAt": "2024-04-01T16:00:00Z"
      }
    ],
    "total_sub_departments": 5,
    "active_sub_departments": 5,
    "total_employees": 45,
    "user_permissions": {
      "can_create_sub_dept": true,
      "can_edit_sub_dept": true,
      "can_delete_sub_dept": true,
      "can_view_employees": true
    }
  }
}
```

**Actor**: Hodim **Precondition**: Hodim kartasi/QR kodi tayyor **Main Flow**:

1. Hodim HIKVision qurilmaga karta/QR kod ko'rsatadi
2. Qurilma ma'lumotni API serverga yuboradi
3. Server hodimni taniydi va entry log yozadi
4. Qurilma welcome message ko'rsatadi
5. Admin panel real-time notification oladi

**Alternative Flow**:

- Hodim tanilmasa, kirish rad etiladi
- Hodim faol bo'lmasa, ogohlantirish chiqadi

**UC-14: Hodimlar Ro'yxatini Olish (Role-based)**

**API**: GET `/api/employees` **Actor**: Admin/HR/Department Lead/Guard

**Admin Flow**:

1. Admin "Employees" sahifasini ochadi
2. Frontend GET `/api/employees` ga request yuboradi (filter yo'q)
3. Server barcha hodimlarni qaytaradi (barcha organizationlar)
4. Admin to'liq CRUD permissions oladi

**HR Flow**:

1. HR "Employees" sahifasini ochadi
2. Frontend user.organization_id bilan filter qo'yib request yuboradi
3. Server faqat HR ning organizationiga tegishli hodimlarni qaytaradi
4. HR to'liq ma'lumotlar va CRUD permissions oladi

**Department Lead Flow**:

1. Department Lead "My Team" sahifasini ochadi
2. Frontend user.department_id/sub_department_id bilan filter qo'yib request
   yuboradi
3. Server faqat Lead ning department/sub_department hodimlarini qaytaradi
4. Lead faqat read-only permissions oladi

**Guard Flow**:

1. Guard "Employees Directory" sahifasini ochadi
2. Frontend basic ma'lumotlar uchun request yuboradi
3. Server faqat basic ma'lumotlar qaytaradi (name, photo, department)
4. Guard faqat entry/exit logs ko'rish huquqiga ega

**Query Parameters**:

```
?organization_id=1&department_id=2&sub_department_id=3&search=John&isActive=true&sort=name&order=asc&page=1&limit=10
```

**Success Response (Admin - Full access)**:

```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": 1,
        "personal_id": "12345678901234",
        "sub_department_id": 1,
        "name": "Aliyev Vali Akramovich",
        "address": "Toshkent sh., Chilonzor tumani",
        "phone": "+998901234567",
        "email": "vali.aliyev@company.uz",
        "photo": "/uploads/photos/employee_1.jpg",
        "additionalDetails": "Senior Developer",
        "isActive": true,
        "organization": {
          "id": 1,
          "fullName": "Tech Company LLC",
          "shortName": "TechCorp"
        },
        "department": {
          "id": 1,
          "fullName": "IT Department",
          "shortName": "IT"
        },
        "sub_department": {
          "id": 1,
          "fullName": "Software Development",
          "shortName": "Dev"
        },
        "cards_count": 2,
        "cars_count": 1,
        "computer_users_count": 3,
        "createdAt": "2024-01-15T09:00:00Z",
        "updatedAt": "2024-03-20T14:30:00Z"
      }
    ],
    "page": 1,
    "total": 145,
    "limit": 10,
    "user_permissions": {
      "can_create": true,
      "can_edit": true,
      "can_delete": true,
      "can_view_sensitive_data": true,
      "canAssign_cards": true,
      "canAssign_cars": true,
      "can_link_computer_users": true
    }
  }
}
```

**UC-15: Yangi Hodim Yaratish**

**API**: POST /api/employees **Actor**: Admin/HR

**Admin Flow**:

1. Admin "Add Employee" tugmasini bosadi
2. Modal ochiladi va barcha organizationlar/departmentlar dropdown da
   ko'rsatiladi
3. Admin istalgan sub_department ni tanlaydi
4. Hodim ma'lumotlarini to'ldiradi

**HR Flow**:

1. HR "Add Employee" tugmasini bosadi
2. Modal ochiladi lekin faqat o'z organizationining departmentlari ko'rsatiladi
3. HR faqat o'z organizationiga hodim qo'sha oladi

**Request Body**:

```json
{
  "personal_id": "32145678901234",
  "sub_department_id": 3,
  "name": "Karimov Bobur Shavkatovich",
  "address": "Toshkent sh., Mirobod tumani, 15-uy",
  "phone": "+998901111222",
  "email": "bobur.karimov@company.uz",
  "photo": "base64_encoded_photo_string",
  "additionalDetails": "Junior Frontend Developer"
}
```

**Success Response (201)**:

```json
{
  "success": true,
  "message": "Hodim muvaffaqiyatli yaratildi",
  "data": {
    "employee": {
      "id": 146,
      "personal_id": "32145678901234",
      "sub_department_id": 3,
      "name": "Karimov Bobur Shavkatovich",
      "address": "Toshkent sh., Mirobod tumani, 15-uy",
      "phone": "+998901111222",
      "email": "bobur.karimov@company.uz",
      "photo": "/uploads/photos/employee_146.jpg",
      "additionalDetails": "Junior Frontend Developer",
      "isActive": true,
      "createdAt": "2024-08-24T16:00:00Z"
    }
  }
}
```

**UC-22: Hodim Tahrirlash**

**API**: PUT `/api/employees/:id` **Actor**: Admin/HR

**Permission Check Flow**:

1. User "Edit" tugmasini bosadi
2. Frontend employee ID bilan PUT request yuboradi
3. Server employee mavjudligini tekshiradi
4. Server permission tekshiradi:
   - Admin: Barcha hodimlarni tahrirlashi mumkin
   - HR: Faqat o'z organizationining hodimlarini

**Request Body**:

```json
{
  "name": "Karimov Bobur Shavkatovich",
  "address": "Toshkent sh., Yashnobod tumani, 22-uy",
  "phone": "+998901111333",
  "email": "bobur.karimov.new@company.uz",
  "additionalDetails": "Middle Frontend Developer"
}
```

**Backend Permission Logic**:

**Success Response (200)**:

```json
{
  "success": true,
  "message": "Hodim ma'lumotlari yangilandi",
  "data": {
    "employee": {
      "id": 146,
      "name": "Karimov Bobur Shavkatovich (Updated)",
      "address": "Toshkent sh., Yashnobod tumani, 22-uy",
      "phone": "+998901111333",
      "email": "bobur.karimov.new@company.uz",
      "updatedAt": "2024-08-24T16:30:00Z"
    }
  }
}
```

**UC-16: Hodim O'chirish**

**API**: DELETE `/api/employees/:id` **Actor**: Admin/HR

**Dependency Check Flow**:

1. User "Delete" tugmasini bosadi
2. Frontend confirmation modal ko'rsatadi
3. User confirm qilsa, DELETE request yuboradi
4. Server dependency check qiladi:
   - Entry/exit logs mavjudmi?
   - Computer users linked mi?
   - Cards va cars assigned mi?
5. Agar dependency bo'lsa - soft delete
6. Agar dependency yo'q bo'lsa - hard delete yoki error

**Success Response - Soft Delete (200)**:

```json
{
  "success": true,
  "message": "Hodim nofaol holga o'tkazildi va computer users o'zgartirildi",
  "data": {
    "deleted": false,
    "deactivated": true,
    "reason": "Entry logs, computer users va cards mavjud",
    "computer_users_unlinked": 2
  }
}
```

**UC-17: Hodim Entry/Exit Loglarini Olish**

**API**: GET `/api/employees/:id/entry-logs` **Actor**: Admin/HR/Department
Lead/Guard

**Permission-based Access**:

- **Admin**: Barcha hodimlarning entry logs
- **HR**: Faqat o'z organizationining hodimlar
- **Department Lead**: Faqat o'z departmentining hodimlar
- **Guard**: Barcha hodimlar (basic access)

**Query Parameters**:

```
?start_date=2024-08-01&end_date=2024-08-31&entry_type=both&limit=50&page=1
```

**Main Flow**:

1. User hodim sahifasida "Entry/Exit Logs" tabini tanlaydi
2. Frontend GET `/api/employees/:id/entry-logs` ga request yuboradi
3. Server permission check qiladi
4. Entry logs ro'yxatini qaytaradi

**Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 1,
      "name": "Aliyev Vali Akramovich",
      "photo": "/uploads/photos/employee_1.jpg",
      "department": "IT Department / Software Development"
    },
    "entry_logs": [
      {
        "id": 1,
        "employee_id": 1,
        "action": {
          "id": 101,
          "device_id": 1,
          "action_time": "2024-08-24T09:15:00Z",
          "entry_type": "enter",
          "action_type": "card",
          "action_result": "card_12345",
          "device": {
            "name": "Main Entrance",
            "ipAddress": "192.168.1.100"
          }
        },
        "createdAt": "2024-08-24T09:15:05Z"
      },
      {
        "id": 2,
        "employee_id": 1,
        "action": {
          "id": 102,
          "device_id": 1,
          "action_time": "2024-08-24T18:30:00Z",
          "entry_type": "exit",
          "action_type": "card",
          "action_result": "card_12345",
          "device": {
            "name": "Main Entrance",
            "ipAddress": "192.168.1.100"
          }
        },
        "createdAt": "2024-08-24T18:30:02Z"
      }
    ],
    "page": 1,
      "total": 245
    },
,      "total_entries": 123,
      "total_exits": 122,
      "avg_work_hours": "8.5"
    }
  }
}
```

**UC-18: Hodim Activity Report Olish**

**API**: `GET /api/employees/:id/activity-report` **Actor**: Admin/HR/Department
Lead

**Query Parameters**:

```
?start_date=2024-08-01&end_date=2024-08-31&report_type=detailed&include_screenshots=false
```

**Main Flow**:

1. Lead/HR "Employee Activity" sahifasini ochadi
2. Sana oralig'ini tanlaydi
3. Frontend `GET /api/employees/:id/activity-report` ga request yuboradi
4. Server comprehensive activity report yaratadi

**Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 1,
      "name": "Aliyev Vali Akramovich",
      "sub_department": "Software Development"
    },
    "report_period": {
      "start_date": "2024-08-01",
      "end_date": "2024-08-31",
      "total_days": 31,
      "working_days": 22
    },
    "computer_usage": {
      "linked_computers": 3,
      "total_screenshots": 1850,
      "avg_daily_screenshots": 84
    },
    "most_usedApplications": [
      {
        "processName": "Code.exe",
        "total_time": 145800,
        "usage_count": 342,
        "percentage": 45.2
      },
      {
        "processName": "chrome.exe",
        "total_time": 89400,
        "usage_count": 156,
        "percentage": 27.8
      }
    ],
    "most_visited_sites": [
      {
        "url": "github.com",
        "total_time": 32400,
        "visit_count": 89,
        "category": "development"
      },
      {
        "url": "stackoverflow.com",
        "total_time": 18600,
        "visit_count": 45,
        "category": "development"
      }
    ],
    "productivityAnalysis": {
      "productive_time": 198000,
      "neutral_time": 86400,
      "unproductive_time": 21600,
      "productivity_percentage": 64.7
    },
    "daily_sessions": [
      {
        "date": "2024-08-01",
        "sessions_count": 3,
        "avg_session_duration": 28800,
        "total_work_time": 30600
      }
    ]
  }
}
```

**UC-18: Hodim Computer Users Olish**

**API**: GET `/api/employees/:id/computer-users` **Actor**: Admin/HR/Department
Lead

**Main Flow**:

1. User employee sahifasida "Computer Access" tabini tanlaydi
2. Frontend GET `/api/employees/:id/computer-users` ga request yuboradi
3. Server employee bilan bog'langan barcha computer users ro'yxatini qaytaradi

**Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 1,
      "name": "Aliyev Vali Akramovich"
    },
    "computer_users": [
      {
        "id": 15,
        "sid_id": "S-1-5-21-123456789-987654321-111111111-1001",
        "name": "Vali Aliyev",
        "domain": "COMPANY",
        "username": "v.aliyev",
        "isAdmin": false,
        "is_in_domain": true,
        "isActive": true,
        "computer": {
          "id": 5,
          "computer_id": 12345,
          "os": "Windows 11 Pro",
          "ipAddress": "192.168.1.150",
          "macAddress": "00:1B:44:11:3A:B7"
        },
        "createdAt": "2024-07-15T10:00:00Z"
      }
    ],
    "summary": {
      "total_computer_users": 3,
      "active_computer_users": 2,
      "unique_computers": 3,
      "domain_users": 2,
      "local_users": 1
    }
  }
}
```

**UC-19: Hodimga Karta Biriktirish**

**API**: POST `/api/employees/:id/assign-card` **Actor**: Admin/HR

**Request Body**:

```json
{
  "card_number": "0012345678",
  "additionalDetails": "Asosiy kirish kartasi"
}
```

CARDALREADY_EXISTS

**Success Response (201)**:

```json
{
  "success": true,
  "message": "Karta muvaffaqiyatli biriktirildi",
  "data": {
    "card": {
      "id": 25,
      "employee_id": 1,
      "number": "0012345678",
      "additionalDetails": "Asosiy kirish kartasi",
      "isActive": true,
      "createdAt": "2024-08-24T17:00:00Z"
    }
  }
}
```

**UC-20: Hodimga Mashina Biriktirish**

**API**: POST `/api/employees/:id/assign-car` **Actor**: Admin/HR

**Request Body**:

```json
{
  "car_number": "01A123BC",
  "model": "Toyota Camry 2022",
  "additionalDetails": "Xizmat avtomobili"
}
```

**Success Response (201)**:

```json
{
  "success": true,
  "message": "Mashina muvaffaqiyatli biriktirildi",
  "data": {
    "car": {
      "id": 12,
      "employee_id": 1,
      "number": "01A123BC",
      "model": "Toyota Camry 2022",
      "additionalDetails": "Xizmat avtomobili",
      "isActive": true,
      "createdAt": "2024-08-24T17:15:00Z"
    }
  }
}
```

**UC-21: Computer User bilan Bog'lash**

**API**: POST `/api/employees/:id/link-computer-user`

**Role**: HR/Admin

1. Admin "Computer Management" sahifasiga kiradi
2. Bog'lanmagan computer users ro'yxatini ko'radi
3. Kerakli computer user ni tanlaydi
4. Employee ro'yxatidan tegishli hodimni tanlaydi
5. Link tugmasini bosadi
6. Tizim bog'lanishni saqlaydi

**Alternative Flow**:

- Agar hodim bir nechta kompyuterdan foydalansa, har birini alohida bog'lash
  kerak

**Request Body**:

```json
{
  "computer_user_id": 15
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Computer user muvaffaqiyatli bog'landi",
  "data": {
    "employee_id": 1,
    "computer_user_id": 15,
    "linkedAt": "2024-08-24T17:30:00Z"
  }
}
```

**UC-22: Computer User Bog'lanishini O'chirish**

**API**: DELETE `/api/employees/:id/unlink-computer-user/:computer_user_id`
**Actor**: Admin/HR

**Main Flow**:

1. User employee sahifasida computer user yonidagi "Unlink" tugmasini bosadi
2. Confirmation dialog ko'rsatiladi
3. Frontend DELETE request yuboradi
4. Server computer_user.employee_id ni null qiladi

**Success Response (200)**:

```json
{
  "success": true,
  "message": "Computer user bog'lanishi o'chirildi",
  "data": {
    "unlinked": {
      "employee_id": 1,
      "computer_user_id": 15,
      "unlinkedAt": "2024-08-24T17:45:00Z"
    }
  }
}
```

**UC-23: Agent O'rnatish va Computer User Registration**

**Main Flow**:

1. IT admin hodim kompyuteriga agent o'rnatadi
2. Agent ishga tushadi va tizim ma'lumotlarini yig'adi:
   - SID (Windows Security Identifier)
   - Computer ID (MAC address yoki unique identifier)
   - Username, Domain, OS info
3. Agent bu ma'lumotlarni API serverga yuboradi
4. Server yangi computer_user yozuvini yaratadi
5. Admin panelda "Unlinked Computer Users" ro'yxatida paydo bo'ladi

```csharp
public class PCInfo
{
    public string PCName            // Kompyuter nomi
    public string Hostname          // Domen nomi (yoki hostname)
    public string Mac               // MAC manzili (active adapter MAC addresi)
    public string IP                // Local IP manzili
    public string OSInfo            // Operatsion tizim haqida ma’lumot
    public string PCId              // Kompyuter uchun unikal ID
    public string Version           // Client dastur versiyasi
}

public class PersonInfo
{
    public string Username          // Foydalanuvchi login nomi
    public string Sid               // Foydalanuvchi unikal SID
    public string Givenname         // Ismi (AD mavjud bo‘lsa)
    public string Surname           // Familiyasi (AD mavjud bo‘lsa)
    public bool IsInDomain          // AD ga qo‘shilganmi yoki yo‘q
}

public class UserInfo
{
    public PCInfo PC
    public PersonInfo Person
}
```

**UC-24: Entry/Exit Loglar Ro'yxatini Olish (Role-based)**

**API**: GET `/api/entry-logs` **Actor**: Admin/HR/Department Lead/Guard

**Admin Flow**:

1. Admin "Entry/Exit Logs" sahifasini ochadi
2. Barcha organizations va devices bo'yicha loglarni ko'radi
3. Advanced filtering options mavjud (organization, department, device, time
   range)
4. Export va detailed analytics imkoniyatlari

**HR Flow**:

1. HR "Entry/Exit Monitoring" sahifasini ochadi
2. Faqat o'z organizationining hodimlar loglarini ko'radi
3. Department-level filtering imkoniyati
4. Organization-specific reports yarata oladi

**Department Lead Flow**:

1. Department Lead "Team Attendance" sahifasini ochadi
2. Faqat o'z department/sub-department hodimlarining loglarini ko'radi
3. Basic filtering (date, employee, entry type)
4. Team productivity insights

**Guard Flow**:

1. Guard "Live Monitoring" sahifasini ochadi
2. Real-time entry/exit loglarini ko'radi
3. Current status va alerts
4. Basic employee identification uchun

**Query Parameters**:

```
?start_date=2024-08-01&end_date=2024-08-31&organization_id=1&department_id=2&employee_id=5&device_id=3&entry_type=both&page=1&limit=50
```

**Success Response (Admin - All logs)**:

```json
{
  "success": true,
  "data": {
    "entry_logs": [
      {
        "id": 1,
        "employee": {
          "id": 1,
          "name": "Aliyev Vali Akramovich",
          "personal_id": "12345678901234",
          "photo": "/uploads/photos/employee_1.jpg",
          "department": "IT Department",
          "sub_department": "Software Development",
          "organization": "Tech Company LLC"
        },
        "action": {
          "id": 101,
          "device_id": 1,
          "action_time": "2024-08-24T09:15:00Z",
          "entry_type": "enter",
          "action_type": "card",
          "action_result": "card_12345",
          "device": {
            "id": 1,
            "name": "Main Entrance",
            "ipAddress": "192.168.1.100",
            "entry_type": "both"
          }
        },
        "createdAt": "2024-08-24T09:15:05Z"
      }
    ],
    "page": 1,
      "total": 1250,
      "limit": 50
,    "filters": {
      "applied": {
        "start_date": "2024-08-01",
        "end_date": "2024-08-31"
      },
      "available": {
        "organizations": [...],
        "departments": [...],
        "devices": [...]
      }
    }
  }
}
```

**UC-25: Bugungi Entry/Exit Loglar**

**API**: GET `/api/entry-logs/today` **Actor**: Admin/HR/Department Lead/Guard

**Real-time Dashboard Flow**:

1. User dashboard sahifasini ochadi
2. "Today's Activity" widget ko'rsatiladi
3. Frontend har 30 soniyada refresh qiladi
4. Live statistics va recent activities ko'rsatiladi

**Admin Flow - Today's Overview**:

1. Barcha organizationlar bo'yicha bugungi statistika
2. Device status monitoring
3. Unusual activities detection
4. Real-time entries/exits

**HR Flow - Organization Today**:

1. O'z organizationining bugungi attendance
2. Department-wise breakdown
3. Late arrivals va early departures
4. Missing employees list

**Department Lead Flow - Team Today**:

1. O'z jamoasining bugungi holati
2. Who's in/out status
3. Work hours tracking
4. Team attendance patterns

**Guard Flow - Current Status**:

1. Real-time entry/exit events
2. Current building occupancy
3. Recent alerts va incidents
4. Visitor vs employee tracking

**Query Parameters**:

```
  ?live_update=true&include_visitors=true&group_by=department
```

**Success Response (Admin)**:

```json
{
  "success": true,
  "data": {
    "date": "2024-08-24",
    "summary": {
      "total_entries": 245,
      "total_exits": 178,
      "current_occupancy": 67,
      "lateArrivals": 12,
      "early_departures": 8,
      "avgArrival_time": "08:45",
      "avg_departure_time": "17:30"
    },
    "recentActivities": [
      {
        "id": 1501,
        "employee": {
          "id": 1,
          "name": "Aliyev Vali",
          "photo": "/uploads/photos/employee_1.jpg",
          "department": "IT Department"
        },
        "action": {
          "action_time": "2024-08-24T09:15:00Z",
          "entry_type": "enter",
          "device": {
            "name": "Main Entrance"
          }
        }
      }
    ],
    "department_breakdown": [
      {
        "department": "IT Department",
        "total_employees": 25,
        "present": 22,
        "absent": 3,
        "late": 2
      }
    ],
    "device_status": [
      {
        "deviceName": "Main Entrance",
        "status": "online",
        "lastActivity": "2024-08-24T09:15:00Z",
        "today_events": 89
      }
    ]
  }
}
```

**UC-26: Entry/Exit Hisoboti**

**API**: GET `/api/entry-logs/report` **Actor**: Admin/HR/Department Lead/Guard

**Comprehensive Report Flow**:

1. User "Reports" sahifasini ochadi
2. Report type va parameters tanlaydi
3. Frontend complex report request yuboradi
4. Server detailed analytics yaratadi
5. Report PDF/Excel formatda export qilinadi

**Report Types**:

- **Attendance Report**: Daily/Weekly/Monthly attendance
- **Late Arrivals Report**: Employees with consistent tardiness
- **Work Hours Report**: Average work hours per employee/department
- **Device Usage Report**: Entry/exit patterns by device
- **Overtime Report**: Employees working beyond hours
- **Absence Report**: Missing employees tracking

**Query Parameters**:

```
?report_type=attendance&start_date=2024-08-01&end_date=2024-08-31&group_by=department&export_format=pdf&include_charts=true
```

**Success Response**:

```json
{
  "success": true,
  "data": {
    "report": {
      "id": "RPT-20240824-001",
      "title": "Attendance Report - August 2024",
      "type": "attendance",
      "period": {
        "start_date": "2024-08-01",
        "end_date": "2024-08-31",
        "working_days": 22
      },
      "summary": {
        "total_employees": 245,
        "avgAttendance_rate": 94.5,
        "total_entries": 5390,
        "total_exits": 5385,
        "avg_work_hours": 8.2
      },
      "departmentAnalysis": [
        {
          "department": "IT Department",
          "employees_count": 25,
          "attendance_rate": 96.8,
          "avg_work_hours": 8.5,
          "lateArrivals": 15,
          "early_departures": 8
        }
      ],
      "employeeDetails": [
        {
          "employee_id": 1,
          "name": "Aliyev Vali Akramovich",
          "department": "IT Department",
          "total_work_days": 22,
          "present_days": 21,
          "absent_days": 1,
          "late_days": 2,
          "avgArrival": "08:45",
          "avg_departure": "17:35",
          "avg_work_hours": 8.8,
          "overtime_hours": 12.5
        }
      ],
      "charts": {
        "dailyAttendance": [...],
        "department_comparison": [...],
        "work_hours_distribution": [...]
      }
    },
    "export_links": {
      "pdf": "/api/reports/download/RPT-20240824-001.pdf",
      "excel": "/api/reports/download/RPT-20240824-001.xlsx",
      "csv": "/api/reports/download/RPT-20240824-001.csv"
    },
    "generatedAt": "2024-08-24T15:30:00Z",
    "expiresAt": "2024-08-31T15:30:00Z"
  }
}
```

**UC-27: Muayyan Hodimning Entry Loglari**

**API**: GET /api/entry-logs/employee/:id **Actor**: Admin/HR/Department
Lead/Guard

**Employee-specific Analysis**:

1. User specific hodimni tanlaydi
2. "Entry History" sahifasi ochiladi
3. Detailed entry/exit pattern analysis
4. Work schedule compliance checking
5. Attendance trends and insights

**Individual Tracking Flow**:

- **Admin/HR**: Complete access to employee history
- **Department Lead**: Own department employees only
- **Guard**: Basic access for identification purposes

**Query Parameters**:

```
?start_date=2024-08-01&end_date=2024-08-31&include_patterns=true&includeAnalytics=true
```

**Success Response**:

```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 1,
      "name": "Aliyev Vali Akramovich",
      "personal_id": "12345678901234",
      "department": "IT Department / Software Development",
      "work_schedule": {
        "start_time": "09:00",
        "end_time": "18:00",
        "break_duration": 60,
        "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
      }
    },
    "period_summary": {
      "start_date": "2024-08-01",
      "end_date": "2024-08-31",
      "total_work_days": 22,
      "present_days": 21,
      "absent_days": 1,
      "lateArrivals": 3,
      "early_departures": 2,
      "avgArrival_time": "08:52",
      "avg_departure_time": "18:15",
      "total_work_hours": 184.5,
      "avg_daily_hours": 8.4
    },
    "entry_logs": [
      {
        "id": 1,
        "date": "2024-08-01",
        "entries": [
          {
            "action_time": "2024-08-01T08:45:00Z",
            "entry_type": "enter",
            "action_type": "card",
            "device": "Main Entrance",
            "status": "on_time"
          },
          {
            "action_time": "2024-08-01T18:20:00Z",
            "entry_type": "exit",
            "action_type": "card",
            "device": "Main Entrance",
            "status": "normal"
          }
        ],
        "work_duration": "09:35:00",
        "compliance": "compliant"
      }
    ],
    "patterns": {
      "most_commonArrival_time": "08:45-09:00",
      "most_common_departure_time": "18:00-18:30",
      "preferred_entrance": "Main Entrance",
      "attendance_trend": "consistent",
      "punctuality_score": 92.5
    },
    "analytics": {
      "monthly_comparison": [
        {
          "month": "2024-07",
          "attendance_rate": 95.2,
          "avg_work_hours": 8.2
        }
      ],
      "weekly_patterns": [
        {
          "day": "monday",
          "avgArrival": "08:50",
          "avg_departure": "18:10",
          "attendance_rate": 100
        }
      ]
    }
  }
}
```

## 10. IMPLEMENTATION ROADMAP

### 10.1 Phase 1: Core Backend Setup (Weeks 1-2)

**Week 1: Infrastructure & Setup**
- [ ] NX Monorepo initialization
- [ ] Project structure setup (apps, shared libs)
- [ ] Database schema design (Prisma)
- [ ] Environment configuration
- [ ] Docker setup (PostgreSQL, Redis)
- [ ] CI/CD pipeline basic setup

**Week 2: Shared Libraries**
- [ ] @staff/database - Prisma setup & migrations
- [ ] @staff/auth - JWT guards, RBAC decorators
- [ ] @staff/common - Base DTOs, interceptors, filters
- [ ] @staff/utils - Helper functions
- [ ] @staff/repository - Base repository pattern

### 10.2 Phase 2: Dashboard API Core (Weeks 3-4)

**Week 3: Authentication & User Management**
- [ ] Auth Module (login, logout, refresh token)
- [ ] Users Module (CRUD, role management)
- [ ] RBAC implementation
- [ ] Session management (Redis)
- [ ] Swagger documentation setup

**Week 4: Organizations & Structure**
- [ ] Organizations Module (CRUD)
- [ ] Departments Module (CRUD, hierarchical)
- [ ] Sub-departments Module
- [ ] Role-based filtering implementation
- [ ] Unit tests (>70% coverage)

### 10.3 Phase 3: Employees & Access Control (Weeks 5-6)

**Week 5: Employee Management**
- [ ] Employees Module (CRUD)
- [ ] Card assignment
- [ ] Car assignment
- [ ] Photo upload functionality
- [ ] Employee filtering (by org, dept)

**Week 6: Devices & HIKVision Integration**
- [ ] Devices Module (CRUD)
- [ ] HIKVision SDK integration
- [ ] Device connection testing
- [ ] Event webhook handler
- [ ] Real-time event processing

### 10.4 Phase 4: Agent API (Weeks 7-8)

**Week 7: Agent Infrastructure**
- [ ] Agent API setup (separate app)
- [ ] Agent authentication (API keys)
- [ ] Computer registration endpoint
- [ ] Computer User registration
- [ ] Employee linking mechanism

**Week 8: Monitoring Endpoints**
- [ ] Active windows endpoint
- [ ] Visited sites endpoint
- [ ] Screenshot upload endpoint
- [ ] User sessions endpoint
- [ ] Data validation & processing

### 10.5 Phase 5: Entry Logs & Monitoring (Weeks 9-10)

**Week 9: Entry/Exit Logs**
- [ ] Entry logs retrieval (role-based)
- [ ] Today's logs dashboard
- [ ] Employee-specific logs
- [ ] Real-time notifications (Socket.IO)
- [ ] Entry/exit analytics

**Week 10: Computer Monitoring**
- [ ] Computer users management
- [ ] Active windows logs retrieval
- [ ] Visited sites logs retrieval
- [ ] Screenshots retrieval
- [ ] Activity reports generation

### 10.6 Phase 6: Reports & Analytics (Weeks 11-12)

**Week 11: Reporting System**
- [ ] Attendance reports
- [ ] Productivity reports
- [ ] Device usage reports
- [ ] Custom report builder
- [ ] Report caching (Redis)

**Week 12: Export & Analytics**
- [ ] PDF export functionality
- [ ] Excel export functionality
- [ ] CSV export functionality
- [ ] Advanced analytics dashboard
- [ ] Data visualization endpoints

### 10.7 Phase 7: Additional Features (Weeks 13-14)

**Week 13: Visitors & Policies**
- [ ] Visitors Module (CRUD)
- [ ] QR code generation
- [ ] Visitor entry/exit logs
- [ ] Policies Module (CRUD)
- [ ] Website policies management

**Week 14: Optimization & Polish**
- [ ] Performance optimization
- [ ] Caching implementation
- [ ] Query optimization
- [ ] Code refactoring
- [ ] Documentation updates

### 10.8 Phase 8: Testing & Deployment (Weeks 15-16)

**Week 15: Comprehensive Testing**
- [ ] Unit tests completion (>70%)
- [ ] Integration tests
- [ ] E2E tests for critical flows
- [ ] Load testing
- [ ] Security audit

**Week 16: Production Deployment**
- [ ] Staging environment setup
- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Backup configuration
- [ ] Final documentation
- [ ] Training materials

## 11. C# WINDOWS AGENT REQUIREMENTS

### 11.1 Agent Architecture

```
┌─────────────────────────────────────────────┐
│         Windows Service (Background)        │
├─────────────────────────────────────────────┤
│  1. System Info Collector                   │
│     ├─ PC Name, MAC, IP                     │
│     ├─ OS Info                              │
│     └─ User Info (SID, Username, Domain)    │
│                                             │
│  2. Active Directory Integration            │
│     ├─ Domain User Detection                │
│     ├─ User Name Resolution                 │
│     └─ Domain Info                          │
│                                             │
│  3. Activity Monitor                        │
│     ├─ Active Window Tracker                │
│     ├─ Browser History Monitor              │
│     └─ Idle Time Detection                  │
│                                             │
│  4. Screenshot Service                      │
│     ├─ Configurable Interval                │
│     ├─ Screen Capture                       │
│     ├─ Image Compression                    │
│     └─ Upload Queue                         │
│                                             │
│  5. API Communication                       │
│     ├─ HTTP Client                          │
│     ├─ Retry Logic                          │
│     ├─ Queue Management                     │
│     └─ Error Handling                       │
│                                             │
│  6. Local Storage                           │
│     ├─ SQLite Cache                         │
│     ├─ Failed Uploads Queue                 │
│     └─ Configuration Storage                │
└─────────────────────────────────────────────┘
```

### 11.2 Agent Data Models

**C# Classes:**
```csharp
public class AgentConfig
{
    public string AgentId { get; set; }
    public string ApiEndpoint { get; set; }
    public string ApiKey { get; set; }
    public int ScreenshotInterval { get; set; } // seconds
    public bool TrackActiveWindows { get; set; }
    public bool TrackVisitedSites { get; set; }
    public bool CaptureScreenshots { get; set; }
}

public class PCInfo
{
    public string PCName { get; set; }
    public string Hostname { get; set; }
    public string Mac { get; set; }
    public string IP { get; set; }
    public string OSInfo { get; set; }
    public string PCId { get; set; }
    public string Version { get; set; }
}

public class PersonInfo
{
    public string Username { get; set; }
    public string Sid { get; set; }
    public string Givenname { get; set; }
    public string Surname { get; set; }
    public bool IsInDomain { get; set; }
}

public class UserInfo
{
    public PCInfo PC { get; set; }
    public PersonInfo Person { get; set; }
}

public class ActiveWindowData
{
    public string AgentId { get; set; }
    public string ProcessName { get; set; }
    public string WindowTitle { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int Duration { get; set; }
}

public class VisitedSiteData
{
    public string AgentId { get; set; }
    public string Url { get; set; }
    public string Title { get; set; }
    public DateTime VisitTime { get; set; }
    public int Duration { get; set; }
}
```

### 11.3 Agent Security & Configuration

**Installation Requirements:**
- Admin rights for Windows Service installation
- Firewall exceptions for API communication
- SSL/TLS for all API calls
- Unique API key per agent

**Local Configuration (appsettings.json):**
```json
{
  "ApiEndpoint": "https://api.company.com",
  "AgentId": "generated-guid",
  "ApiKey": "agent-secret-key",
  "LogLevel": "Info",
  "Monitoring": {
    "ScreenshotInterval": 300,
    "TrackActiveWindows": true,
    "TrackVisitedSites": true,
    "CaptureScreenshots": true,
    "ExcludedProcesses": ["notepad.exe"],
    "ExcludedUrls": ["localhost", "127.0.0.1"]
  }
}
```

## 12. BEST PRACTICES & CODE STANDARDS

### 12.1 TypeScript/NestJS Standards

**Dependency Injection:**
```typescript
@Injectable()
export class EmployeeService {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly logger: Logger,
  ) {}
}
```

**DTO Validation:**
```typescript
export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  @IsPositive()
  subDepartmentId: number;
}
```

**RBAC Decorators:**
```typescript
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeController {
  @Get()
  @Roles(Role.ADMIN, Role.HR)
  async findAll(@CurrentUser() user: User) {
    // Implementation
  }
}
```

### 12.2 Error Handling

```typescript
export class EmployeeNotFoundException extends HttpException {
  constructor(id: number) {
    super(
      {
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: `Hodim topilmadi (ID: ${id})`,
        },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
```

### 12.3 Database Best Practices

**Efficient Queries:**
```typescript
// Use include for relations
const employees = await prisma.employee.findMany({
  include: {
    department: true,
    sub_department: true,
  },
});

// Pagination
const employees = await prisma.employee.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});

// Transactions
await prisma.$transaction(async (tx) => {
  const employee = await tx.employee.create({ data: employeeData });
  await tx.card.create({ data: cardData });
});
```

### 12.4 Caching Strategy

```typescript
async getEmployee(id: number): Promise<Employee> {
  const cacheKey = `employee:${id}`;
  
  const cached = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const employee = await this.employeeRepository.findById(id);
  await this.redis.setex(cacheKey, 3600, JSON.stringify(employee));
  
  return employee;
}
```

## 13. GLOSSARY

**Technical Terms:**
- **RBAC**: Role-Based Access Control
- **JWT**: JSON Web Token
- **ORM**: Object-Relational Mapping
- **DTO**: Data Transfer Object
- **SID**: Security Identifier (Windows)
- **MAC**: Media Access Control Address
- **AD**: Active Directory

**Business Terms:**
- **Sub-department**: Department ichidagi bo'lim
- **Entry Log**: Kirish/chiqish yozuvi
- **Active Window**: Faol dastur oynasi
- **Screenshot**: Ekran tasviri
- **Productivity**: Ish samaradorligi
- **Attendance**: Davomat

## 14. APPENDIX

### Appendix A: Environment Variables

```bash
# .env.example
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://user:pass@localhost:5432/staff_db"
REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

AGENT_API_KEY=agent-secret-key
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

### Appendix B: Useful Commands

```bash
# NX Commands
npm run start:agent-api
npm run start:dashboard-api
npm run build:all
npm run test:all

# Prisma Commands
npx prisma migrate dev
npx prisma generate
npx prisma studio

# Docker Commands
docker-compose up -d
docker-compose logs -f
```

---

## DOCUMENT REVISION HISTORY

| Version | Date       | Author     | Changes |
|---------|------------|------------|---------|
| 1.0     | 2024-08-24 | PM Team    | Initial specification |
| 2.0     | 2025-11-06 | Senior PM  | Complete restructure with architecture, roadmap, security, C# agent specs, best practices |

---

**Document Status**: ✅ Approved for Development  
**Next Review**: 2025-12-06  
**Prepared by**: Senior Project Manager (10+ years experience)
