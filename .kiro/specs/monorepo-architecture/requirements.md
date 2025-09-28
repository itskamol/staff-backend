# Staff Control System - Monorepo Architecture Requirements

## Introduction

Hozirgi staff control system loyi2. WHEN **Docker konfiguratsiyasi**
yaratilganda THEN har bir application uchun **alohida Dockerfile** bo'lishi
SHART 3. WHEN **docker-compose.yml** yaratilganda THEN **PostgreSQL, Redis** va
**ikkala NestJS service** bo'lishi SHART 4. WHEN **Prisma setup** qilinsganda
THEN **database migrations** va **seeding** ishlashi SHART 5. WHEN CI/CD
pipeline yaratilganda THEN u **affected applications**ni aniqlab test qilishi
SHART 6. WHEN deployment yaratilganda THEN **Agent API (3001)** va **Dashboard
API (3000)** alohida deploy qilinishi SHART 7. WHEN development muhiti
sozlanganda THEN **Prisma generate**, **migrate** va **concurrent start**
ishlashi SHARTi **NestJS** asosida monorepo arxitekturasiga o'tkazish va uni
**ikki asosiy backend service**ga bo'lish: **Agent API** (C# agentlardan
ma'lumot qabul qiluvchi) va **Dashboard API** (asosiy business logic va web
dashboard uchun).

### Technology Stack

**Framework:** NestJS v10+  
**Database:** PostgreSQL 15+  
**ORM:** Prisma v5+  
**Cache:** Redis 7+  
**Queue:** BullMQ  
**Authentication:** JWT + Passport  
**Validation:** class-validator + class-transformer  
**Documentation:** Swagger/OpenAPI  
**Monorepo:** NX Workspace  
**Package Manager:** pnpm

### Service Architecture

**Agent API (Port: 3001)**

- C# agentlardan kompyuter monitoring ma'lumotlarini qabul qiladi
- Ma'lumotlar: ActiveWindow, VisitedSite, Screenshot, UserSession
- Computer va computer user registration
- Agent authentication va health checks
- Bulk data processing va validation
- **Prisma Client** orqali PostgreSQL bilan ishlash

**Dashboard API (Port: 3000)**

- Asosiy business logic va web admin panel API
- Foydalanuvchi boshqaruvi (Authentication, Users, **faqat RBAC**)
- Organization/Department/Employee management
- **HIKVision device management va entry/exit tracking**
- Visitor management va QR code generation
- Computer monitoring data visualization (Agent API dan)
- Reports, analytics va real-time notifications
- WebSocket gateway
- **Prisma Client** orqali PostgreSQL bilan ishlash

## Requirements

### Requirement 1

**User Story:** Dasturchi sifatida, men loyihani **NestJS NX monorepo**
formatida tashkil qilishni xohlayman, **Prisma ORM** va **PostgreSQL** ishlatib,
Agent API va Dashboard API qismlarini alohida rivojlantira olaman.

#### Acceptance Criteria

1. WHEN **NX workspace** yaratilganda THEN `apps/dashboard-api/` va
   `apps/agent-api/` papkalari bo'lishi SHART
2. WHEN monorepo tuzilishi yaratilganda THEN `libs/shared/`, `libs/database/`,
   `libs/rbac/` papkalari bo'lishi SHART
3. WHEN **database library** yaratilganda THEN
   `libs/database/prisma/schema.prisma` fayli bo'lishi SHART
4. WHEN **Prisma konfiguratsiyasi** o'rnatilganda THEN **PostgreSQL connection**
   sozlangan bo'lishi SHART
5. WHEN workspace konfiguratsiyasi o'rnatilganda THEN **nx.json**,
   **package.json** va **tsconfig.base.json** to'g'ri sozlangan bo'lishi SHART
6. WHEN har bir application yaratilganda THEN **NestJS structure** bilan alohida
   `package.json` fayllari bo'lishi SHART

### Requirement 2

**User Story:** Backend dasturchi sifatida, men Agent API qismini yaratishni
xohlayman, u **faqat C# agentlardan** keladigan kompyuter monitoring
ma'lumotlarini qabul qilib, qayta ishlab, saqlaydi.

#### Acceptance Criteria

1. WHEN Agent API yaratilganda THEN u **kompyuter agentlaridan** keladigan
   ma'lumotlar uchun endpoint lar bo'lishi SHART (ActiveWindow, VisitedSite,
   Screenshot, UserSession)
2. WHEN Agent API yaratilganda THEN u **computer va computer user registration**
   endpoint lari bo'lishi SHART
3. WHEN Agent API yaratilganda THEN u **agent authentication** va **API key
   validation** bo'lishi SHART
4. WHEN Agent API ma'lumot qabul qilganda THEN u ma'lumotlarni **validation**
   qilishi SHART
5. WHEN Agent API ma'lumot qayta ishlaganda THEN u ma'lumotlarni **ma'lumotlar
   bazasiga saqlashi** SHART
6. WHEN Agent API yaratilganda THEN u **bulk data processing** va **health
   check** endpoint lari bo'lishi SHART
7. WHEN Agent API endpoint lar yaratilganda THEN ular **RESTful standartlariga**
   mos bo'lishi SHART
8. WHEN Agent API xatolik yuz berganda THEN u to'g'ri **error handling va
   logging** bo'lishi SHART

### Requirement 3

**User Story:** Backend dasturchi sifatida, men Dashboard API qismini yaratishni
xohlayman, u **asosiy business logic** va web admin panel uchun barcha
funksiyalarni taqdim etsin.

#### Acceptance Criteria

1. WHEN Dashboard API yaratilganda THEN u **foydalanuvchi boshqaruvi** endpoint
   lari bo'lishi SHART (Authentication, Users, **faqat RBAC**)
2. WHEN Dashboard API yaratilganda THEN u **organization management** endpoint
   lari bo'lishi SHART (Organization, Department, Employee)
3. WHEN Dashboard API yaratilganda THEN u **HIKVision device management**
   endpoint lari bo'lishi SHART (Device CRUD, test connection, configuration)
4. WHEN Dashboard API yaratilganda THEN u **entry/exit tracking** endpoint lari
   bo'lishi SHART (HIKVision webhooks, entry logs, attendance)
5. WHEN Dashboard API yaratilganda THEN u **visitor management** endpoint lari
   bo'lishi SHART (Visitor CRUD, QR code generation)
6. WHEN Dashboard API yaratilganda THEN u **computer monitoring views** endpoint
   lari bo'lishi SHART (Agent API dan ma'lumot olish)
7. WHEN Dashboard API yaratilganda THEN u **reports va analytics** endpoint lari
   bo'lishi SHART (attendance, productivity, exports)
8. WHEN Dashboard API yaratilganda THEN u **real-time notifications** va
   **WebSocket gateway** bo'lishi SHART
9. WHEN Dashboard API yaratilganda THEN u **RBAC system** (Admin, HR, Department
   Lead, Guard) bo'lishi SHART
10. WHEN Dashboard API yaratilganda THEN u **organization va department data
    scoping** bo'lishi SHART

### Requirement 4

**User Story:** Dasturchi sifatida, men **NestJS monorepo**da shared libraries
yaratishni xohlayman, shunda kod takrorlanishini oldini olaman va consistency
ta'minlayman.

#### Acceptance Criteria

1. WHEN **shared library** yaratilganda THEN u **common decorators** bo'lishi
   SHART (@Roles, @Permissions, @ApiResponse)
2. WHEN **shared library** yaratilganda THEN u **common DTOs** bo'lishi SHART
   (pagination, sorting, API responses)
3. WHEN **shared library** yaratilganda THEN u **common guards** bo'lishi SHART
   (JWT, **faqat RBAC**, organization scope)
4. WHEN **shared library** yaratilganda THEN u **common interceptors** bo'lishi
   SHART (response transform, logging)
5. WHEN **shared library** yaratilganda THEN u **common pipes va filters**
   bo'lishi SHART (validation, exception handling)
6. WHEN **database library** yaratilganda THEN u **Prisma schema**, **Prisma
   Client** va **PrismaService** bo'lishi SHART
7. WHEN **database library** yaratilganda THEN u **migrations**, **seeds** va
   **database utilities** bo'lishi SHART
8. WHEN **RBAC library** yaratilganda THEN u **role-based guards**, **role
   decorators** va **data scoping** bo'lishi SHART
9. WHEN shared libraries ishlatilganda THEN **Agent API va Dashboard API**
   ulardan foydalana olishi SHART

### Requirement 5

**User Story:** DevOps muhandis sifatida, men **NX workspace**da har bir
application uchun alohida build va deploy jarayonlarini sozlashni xohlayman.

#### Acceptance Criteria

1. WHEN **NX workspace** yaratilganda THEN **dashboard-api** va **agent-api**
   applications bo'lishi SHART
2. WHEN build skriptlari yaratilganda THEN har bir application uchun **alohida
   build** bo'lishi SHART (`nx build dashboard-api`, `nx build agent-api`)
3. WHEN **Docker konfiguratsiyasi** yaratilganda THEN har bir application uchun
   **alohida Dockerfile** bo'lishi SHART
4. WHEN **docker-compose.yml** yaratilganda THEN **postgres, redis** va **ikkala
   service** bo'lishi SHART
5. WHEN CI/CD pipeline yaratilganda THEN u **affected applications**ni aniqlab
   test qilishi SHART
6. WHEN deployment yaratilganda THEN **Agent API (3001)** va **Dashboard API
   (3000)** alohida deploy qilinishi SHART
7. WHEN development muhiti sozlanganda THEN **concurrent start** bilan barcha
   services ishga tushishi SHART

### Requirement 6

**User Story:** Dasturchi sifatida, men **services o'rtasida xavfsiz aloqa**
o'rnatishni xohlayman: C# agentlar ↔ Agent API ↔ Dashboard API.

#### Acceptance Criteria

1. WHEN **C# agentlar Agent API** bilan aloqa qilganda THEN ular **API key
   authentication** ishlatishi SHART
2. WHEN **Dashboard API Agent API** bilan aloqa qilganda THEN u **internal
   service authentication** ishlatishi SHART
3. WHEN **web dashboard Dashboard API** bilan aloqa qilganda THEN u **JWT
   authentication** va **RBAC authorization** ishlatishi SHART
4. WHEN **HIKVision devices Dashboard API** bilan aloqa qilganda THEN ular
   **webhook authentication** ishlatishi SHART
5. WHEN ma'lumot uzatilganda THEN u **HTTPS protokoli** orqali shifrlangan
   bo'lishi SHART
6. WHEN xatolik yuz berganda THEN u **structured error responses** va
   **centralized logging** bo'lishi SHART
7. WHEN CORS sozlanganda THEN u **frontend domains**ga ruxsat berishi SHART
8. WHEN rate limiting qo'llanilganda THEN u **agent requests**ni va **API
   calls**ni cheklashi SHART

### Requirement 7

**User Story:** Architecture sifatida, men **real-time features** va
**inter-service communication**ni to'g'ri tashkil qilishni xohlayman.

#### Acceptance Criteria

1. WHEN **real-time notifications** yaratilganda THEN **Dashboard API**da
   **WebSocket Gateway** bo'lishi SHART
2. WHEN **entry/exit events** yuz berganda THEN **Dashboard API** real-time
   **notification** yuborishi SHART
3. WHEN **Agent API** monitoring data qabul qilganda THEN u **Dashboard API**ga
   **event** yuborishi SHART
4. WHEN **Dashboard API** monitoring data ko'rsatganda THEN u **Agent API**dan
   **HTTP request** orqali olishi SHART
5. WHEN **bulk data processing** kerak bo'lganda THEN **message queue**
   (Redis/BullMQ) ishlatilishi SHART
6. WHEN **database transactions** kerak bo'lganda THEN **Prisma transactions**
   va **shared PostgreSQL database** ishlatilishi SHART
7. WHEN **database operations** bajarilganda THEN **Prisma Client** orqali
   **type-safe queries** ishlatilishi SHART

### Requirement 8

**User Story:** Database Developer sifatida, men **Prisma ORM** va
**PostgreSQL** yordamida **type-safe** va **performant** database layer
yaratishni xohlayman.

#### Acceptance Criteria

1. WHEN **Prisma schema** yaratilganda THEN barcha **entities** va
   **relationships** aniq belgilangan bo'lishi SHART
2. WHEN **database migrations** yaratilganda THEN ular **Prisma Migrate** orqali
   boshqarilishi SHART
3. WHEN **PrismaService** yaratilganda THEN u **NestJS DI container**ga to'g'ri
   integratsiya qilingan bo'lishi SHART
4. WHEN **database queries** yozilganda THEN ular **Prisma Client** orqali
   **type-safe** bo'lishi SHART
5. WHEN **database seeding** amalga oshirilganda THEN u **development** va
   **testing** uchun **sample data** yaratishi SHART
6. WHEN **database indexing** qo'llanilganda THEN **performance-critical**
   fields uchun **indexes** bo'lishi SHART
7. WHEN **database transactions** kerak bo'lganda THEN **Prisma transaction
   API** ishlatilishi SHART

### Requirement 9

**User Story:** DevOps muhandis sifatida, men **hozirgi single NestJS
application**dan **NX monorepo**ga **xavfsiz va bosqichma-bosqich** migration
qilishni xohlayman.

#### Acceptance Criteria

1. WHEN **migration boshlanganda** THEN **hozirgi application** to'liq
   **ishlayverishi** SHART (downtime yo'q)
2. WHEN **NX workspace** yaratilganda THEN **existing source code** va
   **database** **saqlanishi** SHART
3. WHEN **existing modules** ko'chirilganda THEN ular **dashboard-api**ga
   **refactor** qilinishi SHART
4. WHEN **Prisma schema** ko'chirilganda THEN u **libs/shared/database** papkaga
   **ko'chirilishi** SHART
5. WHEN **shared components** ajratilganda THEN ular **libs/** papkasiga
   **to'g'ri taqsimlanishi** SHART
6. WHEN **migration testlari** o'tkazilganda THEN **barcha existing
   functionality** **ishlashi** SHART
7. WHEN **migration yakunlanganda** THEN **eski va yangi system** **parallel**
   **test qilinishi** SHART
8. WHEN **migration tugaganda** THEN **deployment strategy** **yangilanishi**
   SHART

### Requirement 10

**User Story:** Backend dasturchi sifatida, men **existing codebase**ni
**minimal o'zgarishlar** bilan **NX monorepo structure**ga **moslashtirishni**
xohlayman.

#### Acceptance Criteria

1. WHEN **existing controllers** ko'chirilganda THEN ular
   **dashboard-api/src/modules** papkaga **joylashtirilishi** SHART
2. WHEN **existing services** ko'chirilganda THEN ular **o'z module**larida
   **qolishi** SHART
3. WHEN **Prisma service** ko'chirilganda THEN u **libs/shared/database** ga
   **shared service** sifatida **ko'chirilishi** SHART
4. WHEN **authentication system** ko'chirilganda THEN u **libs/shared/auth** ga
   **ko'chirilishi** SHART
5. WHEN **shared utilities** ajratilganda THEN ular **libs/shared/utils** ga
   **joylashtirilishi** SHART
6. WHEN **configuration** ko'chirilganda THEN u **har ikkala app** uchun
   **shared** bo'lishi SHART
7. WHEN **Docker configuration** yangilanganda THEN **existing database data**
   **saqlanishi** SHART
8. WHEN **package.json scripts** yangilanganda THEN **existing workflow**
   **buzilmasligi** SHART

### Requirement 11

**User Story:** Database administrator sifatida, men **migration jarayonida**
**database integrity** va **data consistency**ni **ta'minlashni** xohlayman.

#### Acceptance Criteria

1. WHEN **Prisma schema** ko'chirilganda THEN **hech qanday schema o'zgarishi**
   bo'lmasligi SHART
2. WHEN **database migrations** ko'chirilganda THEN ular **yangi location**da
   **ishlashi** SHART
3. WHEN **database seeds** ko'chirilganda THEN ular **monorepo environment**da
   **ishlashi** SHART
4. WHEN **database connections** ko'chirilganda THEN **har ikkala service**
   **bir xil database**ga **ulanishi** SHART
5. WHEN **migration test qilingan**da THEN **data integrity checks**
   **o'tkazilishi** SHART
6. WHEN **production migration** amalga oshirilganda THEN **database backup**
   **olinishi** SHART
7. WHEN **rollback** kerak bo'lganda THEN u **tez va xavfsiz** **amalga
   oshirilishi** SHART
