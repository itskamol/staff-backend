# **Technical Specification (TS): Sector Staff v2.1 (Multi-Organization, NestJS — Modular Monolith)**

Version: 2.1 (Organization-Branch-Department Model and Advanced Architectural Principles)

Date: 10.08.2025

Document Status: Final, Approved

## **1. Introduction and Architectural Principles**

### **1.1. System Overview and Objective**

This document defines the final technical specification (TS) for the **Sector Staff v2.1** system. It supersedes all previous versions and serves as the single source of truth for the project's development.

The system is a modular monolith application designed for multi-organization access control and attendance tracking. It adheres to a strict hierarchical data model: **System -> Organization -> Branch -> Department**. The primary objective of the system is to ensure complete data isolation for each organization while enabling the efficient management of complex hierarchical structures within an organization. This document should serve as the foundation for an AI code generator or a team of developers to create the system in a complete and automated manner.

### **1.2. Key Architectural Pillars**

To ensure the system's stability, scalability, and security, the following architectural principles are strictly followed:

* **Modular Monolith:** The application is built as a single deployable unit, but is internally separated into loosely coupled, domain-oriented modules (e.g., Auth, Organization, Employee). This approach balances the simplicity of the development process with the separation of logical responsibilities, creating a foundation for a future transition to microservices if necessary.  
* **Hierarchical Data Scoping and Isolation:** This is the cornerstone of the architecture. Access to data is strictly controlled and isolated at the Organization level. No user or service can access data outside their assigned organization boundary. This restriction is enforced mandatorily at the authentication guard layer.  
* **Event-Driven and Asynchronous Processing:** Time-consuming or non-critical tasks (e.g., report generation, processing device events, sending notifications) are offloaded to a background job queue (BullMQ). This ensures that API endpoints remain highly responsive and the system is resilient to sudden spikes in processing load.  
* **Stateless Services and JWT-based Authentication:** The API will be stateless. All necessary context for authorizing a request (userId, organizationId, branchIds, roles) is encoded within a JSON Web Token (JWT). This simplifies scaling and load balancing, as any server instance can handle any given request.

### **1.3. Scope Boundaries**

The following tasks are outside the scope of this project and should not be implemented by the AI or developers:

* **Biometric Matching Logic:** The core algorithm for fingerprint or facial matching is outside the project's scope. The system will only interact with a matching service via a defined IMatchingAdapter interface.  
* **Device-Specific API Integration:** Direct integration with hardware APIs (e.g., Hikvision SDK) is not within the project's scope. All such interactions are abstracted through an IDeviceAdapter.  
* **Frontend UI/UX:** This specification is only for the backend system.  
* **Implementation of Third-Party Providers:** The real implementations of SMS, Email, and Object Storage providers are not within the project's scope. The system will be built against INotificationAdapter and IStorageAdapter interfaces.

## **2. System Architecture and Technology Stack**

### **2.1. High-Level Architecture Diagram**

The system architecture includes the following components and interactions:

A client (e.g., a web browser or mobile app) sends requests through a Load Balancer. The Load Balancer directs the requests to one of the available instances of the NestJS application.

1. **NestJS Application (Modular Monolith):**  
   * **API Gateway/Controllers:** Receives incoming HTTP requests, passing them through Guards for authentication and authorization.  
   * **Services:** Contains the business logic. It interacts with the database via PrismaClient, with queues via BullMQ, and with other external services via Adapters.  
   * **Event Emitters:** When a significant event occurs within the business logic (e.g., GUEST_APPROVED), it emits these events to the system's internal event bus.  
   * **Queue Producers:** Adds tasks that need to be executed asynchronously (e.g., processing a RAW_DEVICE_EVENT) to the BullMQ queue.  
2. **Data Storage Layers:**  
   * **PostgreSQL:** The primary relational database. All core data (organizations, users, employees, etc.) is stored here. It is managed via the Prisma ORM.  
   * **Redis:** Serves two primary functions:  
     * **Broker for BullMQ:** Manages the queues for background jobs.  
     * **Cache:** Used for storing frequently requested but infrequently changing data (e.g., configurations) and for temporary states like the Idempotency-Key.  
   * **MinIO / S3-compatible service:** Used for object storage. Raw device events (e.g., images from a face scan), generated reports, and other large files are stored here.  
3. **Asynchronous Handlers (BullMQ Workers):**  
   * These are consumers that can run as separate processes from the NestJS application. They retrieve tasks from the queues in Redis and execute them in the background (e.g., generating a report, checking device status).

This architecture reduces component coupling, enhances system responsiveness, and allows for horizontal scaling.

### **2.2. Technology Stack Specification**

The selected technologies, their versions, and the reasons for their choice are provided in the table below.

| Technology | Recommended Version | Rationale for Choice |
| :---- | :---- | :---- |
| **Backend Framework** | NestJS (TypeScript) v10.x | For its scalable, modular architecture, full TypeScript support, and robust ecosystem. |
| **ORM** | Prisma v5.x | For strong type safety, easy migrations, and high-level integration with PostgreSQL. |
| **Database** | PostgreSQL v15.x | For its reliability, advanced SQL capabilities, and support for complex queries. |
| **Queue** | BullMQ (with Redis) | For reliable, high-performance background job management, retry strategies, and advanced features like FlowProducer. |
| **Cache** | Redis v7.x | For high-speed caching, session management, and as a broker for BullMQ. |
| **Object Storage** | MinIO / S3-compatible service | A scalable, standardized (S3 API), and cost-effective solution for storing large files. |
| **Authentication** | JWT, Passport.js | Industry standard for stateless authentication. Passport.js allows for easy integration of various strategies. |
| **Testing** | Jest (unit/integration), Supertest (e2e) | Deeply integrated into the NestJS ecosystem, providing comprehensive testing capabilities. |
| **CI/CD** | GitHub Actions | To simplify automated testing, build, and deployment processes. |
| **Containerization** | Docker, Docker Compose | To ensure consistency between development, testing, and production environments. |

### **2.3. Project Structure and Module Organization**

The system's source code (src) will have the following modular structure. This structure enables a clear separation of concerns and makes the codebase easy to manage.

```bash
src/  
├── app/                     // The application's main module and configuration  
│   └── app.module.ts  
├── core/                    // Common, core modules for the entire application  
│   ├── config/              // Environment variables and configuration  
│   ├── database/            // Prisma service and module  
│   ├── logger/              // Structured logging service  
│   └── queue/               // BullMQ modules and configuration  
├── shared/                  // Resources shared between modules  
│   ├── decorators/          // Custom decorators (e.g., @User(), @Public())  
│   ├── dto/                 // Common data transfer objects (DTOs)  
│   ├── enums/               // Common enumerations  
│   ├── guards/              // Common guards (e.g., RolesGuard, DataScopeGuard)  
│   ├── interfaces/          // Common interfaces  
│   └── utils/               // Helper functions  
├── modules/                 // Domain-oriented business modules  
│   ├── auth/                // Authentication and authorization  
│   ├── organization/        // Management of organizations  
│   ├── user/                // Management of users  
│   ├── branch/              // Management of branches  
│   ├── department/          // Management of departments  
│   ├── employee/            // Management of employees  
│   ├── device/              // Management of devices  
│   ├── guest/               // Management of guests  
│   ├── attendance/          // Attendance recording and management  
│   ├── reporting/           // Report generation  
│   ├── audit/               // Audit log tracking  
│   └── integration/         // Adapters for external systems  
│       ├── adapters/        // Adapter interfaces  
│       └── stubs/           // Stub implementations of adapters  
└── main.ts                  // The application's entry point
```

## **3. Database Schema and Models (Prisma)**

### **3.1. Full schema.prisma Definition**

Below is the final and complete Prisma schema for the system. This schema has been carefully designed to ensure data integrity, correct relationships, and query performance.

#### **3.1.1. Correct Modeling of the BRANCH_MANAGER Role**

In the initial technical specification, the BRANCH_MANAGER role was linked to a single branch via the managedBranchId field in the OrganizationUser model. This approach does not align with business requirements, as the branchIds array in the JWT token implies that a manager can manage multiple branches. To resolve this inconsistency and make the system scalable, it is necessary to model the "many-to-many" relationship through an explicit join table. This approach is recommended in Prisma's documentation and ensures logical correctness at the database level.

To solve this issue, the managedBranchId and managedBranch fields are removed from the OrganizationUser model, and a new ManagedBranch model is introduced to link the OrganizationUser and Branch models. This change fully aligns the data model with the authentication mechanism.

#### **3.1.2. Final Schema**

```js
// This is your Prisma schema file,  
// learn more about it in the docs: https://pris.ly/d/prisma-sche
generator client {  
  provider = "prisma-client-js"  
}

datasource db {  
  provider = "postgresql"  
  url      = env("DATABASE_URL")  
}

// 1. Core organization model  
model Organization {  
  id          String    @id @default(uuid())  
  name        String    @unique  
  description String?  
  createdAt   DateTime  @default(now())  
  updatedAt   DateTime  @updatedAt

  users       OrganizationUser[]  
  branches    Branch[]  
  employees   Employee[]  
  devices     Device[]  
  guestVisits GuestVisit[]  
  auditLogs   AuditLog[]  
}

// 2. Users and their roles  
model User {  
  id           String             @id @default(uuid())  
  email        String             @unique  
  passwordHash String  
  fullName     String?  
  isActive     Boolean            @default(true)  
  createdAt    DateTime           @default(now())  
  updatedAt    DateTime           @updatedAt

  organizationLinks OrganizationUser[]  
  auditLogs         AuditLog[]  
}

model OrganizationUser {  
  id             String       @id @default(uuid())  
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)  
  userId         String  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)  
  organizationId String  
  role           Role

  // This link shows which branch(es) this user manages  
  managedBranches ManagedBranch[]

  createdAt      DateTime     @default(now())

  @@unique([userId, organizationId])  
  @@index([organizationId])  
  @@index([userId])  
}

enum Role {  
  SUPER_ADMIN  
  ORG_ADMIN  
  BRANCH_MANAGER  
  EMPLOYEE  
}

// 3. Organization branches (locations)  
model Branch {  
  id             String    @id @default(uuid())  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)  
  organizationId String  
  name           String  
  address        String?  
  createdAt      DateTime  @default(now())  
  updatedAt      DateTime  @updatedAt

  departments    Department[]  
  employees      Employee[]  
  devices        Device[]  
  guestVisits    GuestVisit[]  
      
  // This link shows which manager(s) manage this branch  
  managers       ManagedBranch[]

  @@unique([organizationId, name])  
  @@index([organizationId])  
}

// 3.1. Many-to-many join table between Manager and Branch  
model ManagedBranch {  
  id        String       @id @default(uuid())  
  manager   OrganizationUser @relation(fields: [managerId], references: [id], onDelete: Cascade)  
  managerId String  
  branch    Branch       @relation(fields: [branchId], references: [id], onDelete: Cascade)  
  branchId  String  
  assignedAt DateTime    @default(now())

  @@unique([managerId, branchId])  
  @@index([managerId])  
  @@index([branchId])  
}

// 4. Departments within a branch  
model Department {  
  id        String   @id @default(uuid())  
  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)  
  branchId  String  
  name      String  
  parentId  String?  // For internal hierarchy (self-relation)  
  parent    Department? @relation("DepartmentHierarchy", fields: [parentId], references: [id], onDelete: SetNull)  
  children  Department[] @relation("DepartmentHierarchy")  
      
  createdAt DateTime @default(now())  
  updatedAt DateTime @updatedAt

  employees Employee[]

  @@unique([branchId, name])  
  @@index([branchId])  
}

// 5. Employees  
model Employee {  
  id             String     @id @default(uuid())  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)  
  organizationId String  
  branch         Branch     @relation(fields: [branchId], references: [id], onDelete: Cascade)  
  branchId       String  
  department     Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)  
  departmentId   String?  
      
  firstName      String  
  lastName       String  
  employeeCode   String     // Must be unique within the organization  
  email          String?    @unique  
  phone          String?  
  isActive       Boolean    @default(true)  
      
  createdAt      DateTime   @default(now())  
  updatedAt      DateTime   @updatedAt  
      
  attendances    Attendance[]

  @@unique([organizationId, employeeCode])  
  @@index([organizationId])  
  @@index([branchId])  
  @@index([departmentId])  
}

// 6. Devices  
model Device {  
  id             String       @id @default(uuid())  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)  
  organizationId String  
  branch         Branch       @relation(fields: [branchId], references: [id], onDelete: Cascade)  
  branchId       String

  name           String  
  type           DeviceType  
  host      String?  
  macAddress     String?      @unique  
  model          String?  
  status         DeviceStatus @default(ONLINE)  
  lastSeenAt     DateTime?  
      
  createdAt      DateTime     @default(now())  
  updatedAt      DateTime     @updatedAt

  events         DeviceEventLog[]  
  attendances    Attendance[]

  @@unique([organizationId, name])  
  @@index([branchId, status])  
}

enum DeviceType { CAMERA, CARD_READER, FINGERPRINT, ANPR, OTHER }  
enum DeviceStatus { ONLINE, OFFLINE, DEGRADED, ERROR }

// 7. Guest visits  
model GuestVisit {  
  id                      String    @id @default(uuid())  
  organization            Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)  
  organizationId          String  
  branch                  Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)  
  branchId                String  
      
  guestName               String  
  guestContact            String?  
  responsibleEmployeeId   String?   // Employee.id  
      
  scheduledEntryTime      DateTime  
  scheduledExitTime       DateTime  
      
  status                  GuestStatus @default(PENDING_APPROVAL)  
  accessCredentialType    AccessCredentialType  
  accessCredentialHash    String?      // Hashed value for QR code or temporary card  
      
  createdByUserId         String    // User.id  
  createdAt               DateTime  @default(now())  
  updatedAt               DateTime  @updatedAt

  attendances             Attendance[]

  @@index([branchId, status])  
  @@index([accessCredentialHash])  
}

enum GuestStatus { PENDING_APPROVAL, APPROVED, ACTIVE, COMPLETED, EXPIRED, REJECTED }  
enum AccessCredentialType { QR_CODE, TEMP_CARD }

// 8. Attendance  
model Attendance {  
  id             String       @id @default(uuid())  
  organizationId String  
  branchId       String  
      
  employee       Employee?    @relation(fields: [employeeId], references: [id], onDelete: SetNull)  
  employeeId     String?  
  guestVisit     GuestVisit?  @relation(fields: [guestId], references: [id], onDelete: SetNull)  
  guestId        String?  
  device         Device?      @relation(fields: [deviceId], references: [id], onDelete: SetNull)  
  deviceId       String?  
      
  eventType      AttendanceEventType  
  timestamp      DateTime     @default(now())  
  meta           Json?        // Additional information (e.g., temperature)  
      
  createdAt      DateTime     @default(now())

  @@index([organizationId, employeeId, timestamp])  
  @@index([organizationId, guestId, timestamp])  
}

enum AttendanceEventType { CHECK_IN, CHECK_OUT, GUEST_CHECK_IN, GUEST_CHECK_OUT, MANUAL_ENTRY }

// 9. Events and Audit logs  
model DeviceEventLog {  
  id             String    @id @default(uuid())  
  organizationId String  
  deviceId       String  
  device         Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)  
      
  eventType      String    // e.g., "face.scan", "card.read"  
  timestamp      DateTime  
  rawPayloadUrl  String?   // Reference to the raw data in S3/MinIO  
  metadata       Json?     // Processed data  
  isProcessed    Boolean   @default(false)  
      
  createdAt      DateTime  @default(now())

  @@index([organizationId, deviceId, timestamp])  
}

model AuditLog {  
  id             String       @id @default(uuid())  
  organizationId String?  
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)  
      
  userId         String  
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)  
      
  action         String       // e.g.: "CREATE_EMPLOYEE"  
  entity         String       // "Employee"  
  entityId       String?  
  oldValue       Json?  
  newValue       Json?  
      
  createdAt      DateTime     @default(now())

  @@index([organizationId, userId, createdAt])  
}
```

#### **3.1.3. Data Integrity and Performance**

* **onDelete Relation Policies:**  
  * onDelete: Cascade is used to ensure that dependent data is logically deleted along with the parent object. For example, when an Organization is deleted, all its Branch, Employee, and other related records are automatically removed. This prevents the creation of "orphaned" records.  
  * onDelete: SetNull is used in cases where the dependency is not mandatory. For example, when a Department is deleted, the linked Employee records are not deleted; only their departmentId field is set to null. This allows employee data to be preserved.  
* **Indexing (@@index, @unique):**  
  * The schema includes indexes (@@index) for frequently filtered and searched fields. Indexing fields like organizationId, branchId, and userId is crucial for dramatically improving query performance in a multi-tenant system.  
  * Uniqueness constraints (@unique, @@unique) guarantee data correctness at the database level (e.g., within the same organizationId, there cannot be two identical employeeCode values).

## **4. Authentication, Authorization, and Security**

### **4.1. JWT Structure and Claims (Access & Refresh Tokens)**

The system uses two types of JWT tokens: a short-lived accessToken and a long-lived refreshToken.

* **accessToken Payload:** This token, used in every authenticated request, contains the following claims. These claims provide the full context needed to process each request and reduce the number of additional database queries.

```json
{  
  "sub": "user-uuid",  
  "email": "user@example.com",  
  "organizationId": "org-uuid-or-null",  
  "branchIds": ["branch-uuid-1", "branch-uuid-2"],  
  "roles": ["ORG_ADMIN"],  
  "permissions": ["employee:create", "employee:read:all", "device:read"],  
  "iat": 1690000000,  
  "exp": 1690000900  
}
```

* `sub`: The unique identifier of the user (`User.id`).  
* `organizationId`: Indicates the organization context in which the user is operating. This value will be `null` for `SUPER_ADMIN`.  
* `branchIds`: For the `BRANCH_MANAGER` role, this is an array of IDs of the branches they manage. This data is retrieved from the `ManagedBranch` table. It will be an empty array for other roles.  
* `roles`: A list of roles assigned to the user (e.g., `["ORG_ADMIN"]`).  
* `permissions`: A list of permissions granted based on the roles. This is used for quick checks by the `RolesGuard`.  
* `exp`: The token's expiration time (e.g., 15 minutes).

* **refreshToken:** Used to obtain a new accessToken when the current one expires. It contains only the user sub and a token version, and has a much longer expiration time (e.g., 7 days).

### **4.2. Token Lifecycle and Management**

1. **Login (/api/v1/auth/login):** A user logs in with their email and password. After successful authentication, the system generates and returns a new accessToken and refreshToken pair.  
2. **Token Refresh (/api/v1/auth/refresh):** When the accessToken expires, the client sends the refreshToken to this endpoint. The system validates the refreshToken's authenticity and checks if it has been revoked (by checking a denylist in Redis). If it is valid, a new accessToken and refreshToken pair is returned. This process is known as "refresh token rotation" and enhances security.  
3. **Logout (/api/v1/auth/logout):** When a user logs out, their current refreshToken is added to a denylist in Redis. This prevents the user from obtaining a new accessToken with a stolen refreshToken.

### **4.3. Role-Based Access Control (RBAC)**

The roles and permissions system serves as the foundation for strictly controlling access to system functions. The following matrix clearly defines the permissions available for each role. This matrix is the primary document for implementing and testing the RolesGuard.

| Permission | SUPER_ADMIN | ORG_ADMIN | BRANCH_MANAGER | EMPLOYEE |
| :---- | :---- | :---- | :---- | :---- |
| organization:create | ✅ | ❌ | ❌ | ❌ |
| organization:read:all | ✅ | ❌ | ❌ | ❌ |
| organization:read:self | ✅ | ✅ | ❌ | ❌ |
| organization:update:self | ✅ | ✅ | ❌ | ❌ |
| user:create:org_admin | ✅ | ❌ | ❌ | ❌ |
| user:manage:org | ✅ | ✅ | ❌ | ❌ |
| branch:create | ❌ | ✅ | ❌ | ❌ |
| branch:read:all | ❌ | ✅ | ✅ | ❌ |
| branch:update:managed | ❌ | ✅ | ✅ | ❌ |
| department:create | ❌ | ✅ | ✅ | ❌ |
| department:manage:all | ❌ | ✅ | ✅ | ❌ |
| employee:create | ❌ | ✅ | ✅ | ❌ |
| employee:read:all | ❌ | ✅ | ✅ | ❌ |
| employee:read:self | ❌ | ✅ | ✅ | ✅ |
| employee:update:all | ❌ | ✅ | ✅ | ❌ |
| employee:delete | ❌ | ✅ | ✅ | ❌ |
| device:create | ❌ | ✅ | ✅ | ❌ |
| device:manage:all | ❌ | ✅ | ✅ | ❌ |
| guest:create | ❌ | ✅ | ✅ | ❌ |
| guest:approve | ❌ | ✅ | ✅ | ❌ |
| report:generate:org | ❌ | ✅ | ❌ | ❌ |
| report:generate:branch | ❌ | ✅ | ✅ | ❌ |
| audit:read:org | ❌ | ✅ | ❌ | ❌ |
| audit:read:system | ✅ | ❌ | ❌ | ❌ |

### **4.4. Implementation of Custom Guards**

To ensure system security, a multi-layered protection approach is used. Requests to each protected endpoint must pass through the following chain of Guards:

1. **JwtAuthGuard (AuthGuard('jwt')):** This is NestJS's standard Passport guard that extracts the accessToken from the Authorization header, verifies its signature and expiration. Upon successful verification, it decodes the token payload and places it in the request.user object. This lays the foundation for the subsequent guards to operate.  
2. **DataScopeGuard:** This is one of the most critical security components of the system. Its sole purpose is to enforce data isolation. This guard reads the organizationId and branchIds (if available) values from the request.user object in every request. It then places these values into a special field on the request object (request.scope). Service methods are then forced to accept this scope object as a parameter. This approach eliminates the reliance on each developer to remember to filter data and makes the security policy mandatory at the architectural level. If a user is an ORG_ADMIN, they can only see data for their own organization; if a BRANCH_MANAGER, they can only see data for their assigned branches.  
3. **RolesGuard:** This guard compares the permissions required for the endpoint (obtained via a custom decorator like @Permissions('employee:create')) with the permissions available in the request.user.permissions array. If the required permission is not found, the request is rejected with a 403 Forbidden error. This enforces the RBAC matrix in practice.

This chain sequentially verifies the token's validity, the request's data scope, and the user's permissions, providing comprehensive control over system access.

### **4.5. Password Hashing and Security Policy**

* **Hashing Algorithm:** User passwords are not stored in plain text in the database. Instead, they are stored as a hashed value with a strong salt using the bcrypt library. The number of salt rounds is set to at least 12, which provides sufficient protection against brute-force attacks.  
* **Password Policy:** When creating or changing a new password, the following minimum requirements are checked at the DTO (Data Transfer Object) validation level:  
  * Minimum length: 8 characters.  
  * At least one uppercase letter.  
  * At least one lowercase letter.  
  * At least one number.  
  * At least one special character (e.g., !@#$%^&*).

## **5. Modular API Specification (Endpoints)**

This section provides a detailed description of the API endpoints, their requirements, and business logic for each system module. As an example, the DeviceModule and its most important endpoint are described in detail.

### **5.6. DeviceModule (/api/v1/devices)**

#### **5.6.1. Module Overview**

This module is responsible for managing the lifecycle of physical devices (cameras, card readers, etc.) in an organization's branches. This includes registering devices, monitoring their status, and receiving events from them.

#### **5.6.2. Endpoint: POST /api/v1/events/raw**

* **Description:** The main entry point for receiving all raw events (e.g., face scans, card reads) from physical devices. This endpoint is designed for high throughput and reliability. Its primary task is to quickly accept the event, queue it for processing, and return an immediate response.  
* **Required Role(s):** None (authentication is done via a device-specific API key/secret, not a user JWT). A separate DeviceAuthGuard will be implemented for this purpose.  
* **Request Headers:** Idempotency-Key: `UUID` — Mandatory.  
* **Request Body:** A generic event payload. For example:

```json
{  
  "eventType": "card.read",  
  "timestamp": "2025-08-10T10:00:00Z",  
  "payload": {  
    "cardId": "HEX_CARD_ID",  
    "temperature": 36.6  
  }  
}
```

* **Successful Response (202):** 202 Accepted. The response must be returned immediately to confirm that the request has been received. Processing will occur asynchronously.  
* **Error Responses (4xx, 5xx):** The following table lists possible error codes and their causes for this endpoint.

| Code | Cause | Description |
| :---- | :---- | :---- |
| 400 | Bad Request | Idempotency-Key header is missing or in an invalid format. |
| 401 | Unauthorized | The device's API key is invalid. |
| 429 | Too Many Requests | The rate limit has been exceeded. |
| 503 | Service Unavailable | The queue service (Redis) is down. |

* Detailed Business Logic and Idempotency:  
  This endpoint is a critical entry point for state-changing data. Network interruptions can cause devices to send the same event multiple times, leading to duplicate attendance records. For this reason, implementing idempotency is not an "added convenience" but a fundamental requirement for data integrity.  
  To solve this problem, an approach is used that aligns with industry standards like the Stripe API. The client (device) generates a unique Idempotency-Key for each new operation and sends it in the request header. The server uses this key to check if the operation has already been performed.  
  The logic of the endpoint is as follows:  
  1. Authenticate the device via DeviceAuthGuard.  
  2. Extract the Idempotency-Key from the header. If it is missing, return 400 Bad Request.  
  3. Check for a cached response for this key in Redis (GET idempotency:response:`key`).  
  4. **If a response is found for the key:** Immediately return the cached response (e.g., 202 Accepted) and do not perform any further actions. This effectively handles duplicate requests.  
  5. If the key is not found:  
     a. Set a short-term lock in Redis to prevent race conditions (SET idempotency:lock:`key` "locked" NX EX 60). If the lock fails to set (meaning another parallel request has set the lock), either wait and retry or return a 409 Conflict.  
     b. Upload the incoming raw payload to S3/MinIO via IStorageAdapter.  
     c. Create a new DeviceEventLog record in PostgreSQL, storing a reference to the S3 object (rawPayloadUrl).  
     d. Add a task named RAW_DEVICE_EVENT to the events-queue in BullMQ. The payload includes the ID of the DeviceEventLog record.  
     e. Upon successful queuing, cache the 202 Accepted response in Redis along with the Idempotency-Key (SET idempotency:response:`key` '{"status": 202}' EX 86400).  
     f. Remove the lock (DEL idempotency:lock:`key`).  
     g. Return the 202 Accepted response to the client.

## **6. Asynchronous Processing and Background Jobs (BullMQ)**

### **6.1. Queue Architecture and Configuration**

Processing all background tasks in a single queue is a common anti-pattern that can lead to "head-of-line blocking." For example, a slow task like generating a large report could block a critical, real-time device event that needs to be processed.

To prevent this problem, the system uses multiple domain-specific queues. This approach allows each type of task to have its own priority and concurrency settings, which increases the overall stability and responsiveness of the system.

* **events-queue:** High priority. For processing real-time events from devices. Concurrency: high (e.g., 10-20).  
* **notifications-queue:** Medium priority. For sending email and SMS notifications. Concurrency: medium (e.g., 5).  
* **exports-queue:** Low priority. For generating and exporting large reports. Concurrency: low (e.g., 1-2), as these tasks are resource-intensive.  
* **system-health-queue:** Medium priority. For periodic system tasks such as checking device status or expiring guest tokens.

### **6.2. Job Definitions**

Below is a description of the main background jobs and the logic of their "workers."

#### **Job: ProcessRawDeviceEvent (Consumer for RAW_DEVICE_EVENT)**

* **Queue Name:** events-queue.  
* **Worker Logic:**  
  1. Retrieves the job containing the DeviceEventLog ID from the queue.  
  2. Loads the full log record from the database.  
  3. If necessary, downloads the raw data (via rawPayloadUrl) from S3/MinIO.  
  4. Parses the event data to identify the user (e.g., by the employeeCode from a card).  
  5. Executes business logic: determines if this is a CHECK_IN or CHECK_OUT (e.g., based on the type of the employee's last event).  
  6. Creates a new Attendance record in the database.  
  7. Emits an ATTENDANCE_RECORDED event for other systems (e.g., the notifications module) to consume.  
* Error Handling and Retry Strategy:  
  If the worker fails while executing a job (e.g., the database is temporarily down), a mechanism for reliably retrying the job is necessary. Simple retries that happen immediately would likely fail again if the problem is not resolved, putting an unnecessary load on the system.  
  Instead, BullMQ's advanced retry strategies are used. For each critical job, the following settings are defined:  
  * attempts: 5: Attempt to re-run the job 5 times after a failure.  
  * backoff: A strategy to control the delay between retries.  
    * type: 'exponential': Exponential backoff. Each subsequent retry happens after a delay twice as long as the previous one.  
    * delay: 1000: The initial delay is 1000 ms (1 second).  
      With these settings, retries will occur at intervals of approximately 1, 2, 4, 8, and 16 seconds. This gives the subsystem (e.g., the database) enough time to recover. If all 5 attempts fail, the job is moved to a failed queue and flagged for manual review by an administrator.

## **7. Integration and Adapter Layer**

### **7.1. Adapter Design Pattern**

The Adapter (or Port) design pattern is used to separate the system's core business logic from external infrastructure details (databases, messaging services, file storage). This approach offers the following advantages:

* **Testability:** It allows the business logic to be tested in isolation using mock adapters without needing the real implementations of external services.  
* **Flexibility:** It makes it easy to switch providers. For example, to migrate file storage from MinIO to AWS S3, one only needs to change the implementation of the StorageAdapter; the business logic remains unchanged.

### **7.2. Interface Definitions (TypeScript)**

Below are the core adapter interfaces and their methods. The AI or developers must create stub implementations for these interfaces.

* IStorageAdapter: Responsible for file storage and management.  
  The initial specification assumed the server would handle file uploads itself. However, uploading large files (e.g., video recordings) through a NestJS server monopolizes its network bandwidth and compute resources, which can block the event loop. Furthermore, it requires granting extensive S3 write permissions to the server, which is undesirable from a security perspective.  
  Instead, the best practice accepted in the industry—using pre-signed URLs—will be used. The client (or in our case, the logic that processes the device event) obtains a temporary URL with limited permissions from the server and uploads the file directly to the storage bucket. This offloads the upload burden from the server.

```typescript
interface IStorageAdapter {  
  /**  
   * Creates a pre-signed URL for a direct upload to S3/MinIO.  
   * @param bucket - The name of the storage bucket.  
   * @param key - The unique key (file path) for the object.  
   * @param expiresIn - The expiration time of the URL (in seconds).  
   * @param contentType - The MIME type of the file to be uploaded.  
   * @returns {Promise<string>} The URL intended for upload.  
   */  
  getPresignedUploadUrl(bucket: string, key: string, expiresIn: number, contentType: string): Promise<string>;

  /**  
   * Creates a pre-signed URL to view a protected file.  
   * @param bucket - The name of the storage bucket.  
   * @param key - The key of the object.  
   * @param expiresIn - The expiration time of the URL (in seconds).  
   * @returns {Promise<string>} The URL intended for download.  
   */  
  getPresignedDownloadUrl(bucket: string, key: string, expiresIn: number): Promise<string>;  
}
```

* **INotificationAdapter:** For sending email and SMS notifications.

```typescript
interface INotificationAdapter {  
  sendEmail(to: string, subject: string, body: string): Promise<void>;  
  sendSms(to: string, message: string): Promise<void>;  
}
```

* **IDeviceAdapter:** For sending commands to physical devices (e.g., opening a door).

```typescript
interface IDeviceAdapter {  
  openDoor(deviceId: string, duration: number): Promise<boolean>;  
  updateConfig(deviceId: string, config: Record<string, any>): Promise<boolean>;  
}
```

* **IMatchingAdapter:** For sending requests to an external service for biometric matching.

```typescript
interface IMatchingAdapter {  
  requestMatch(template: Buffer): Promise<{ isMatch: boolean; confidence?: number }>;  
}
```

Each stub implementation should either throw a NotImplementedException or log a message and return a fake response (e.g., // TODO: Implement real integration here).

## **8. Audit and Logging Strategy**

### **8.1. Structured Logging (JSON Format)**

To ensure the system's observability, all log entries must be written to stdout in JSON format. This approach allows modern log aggregation platforms like Datadog, ELK Stack, and Splunk to easily parse and index the logs. Each log entry must minimally include the following fields: timestamp, level (e.g., INFO, ERROR), message, context (e.g., the module name), and correlationId (for request tracing).

### **8.2. Audit Log Tracking**

To track all important changes in the system, entries will be automatically added to the AuditLog table. This allows for determining who made what changes, when, and is critical for security audits.

This functionality will be implemented in a centralized manner using a dedicated NestJS Interceptor (AuditLogInterceptor). This interceptor will be applied globally to all mutating endpoints (POST, PATCH, DELETE).

**Interceptor Logic:**

1. When a request arrives, the interceptor retrieves the request.user.id and other necessary information.  
2. It saves the data sent to the endpoint (request.body) as newValue.  
3. If the operation is PATCH or DELETE, it loads the current state of the object being modified or deleted (oldValue) from the database before the endpoint's core logic is executed.  
4. After the endpoint's core logic successfully completes, the interceptor adds a new entry to the AuditLog table. This entry includes information like userId, action (e.g., UPDATE_EMPLOYEE), entity (Employee), entityId, oldValue, and newValue.

This approach completely separates the audit logic from the business logic and guarantees its consistent application across all necessary areas.

## **9. Comprehensive Testing Strategy**

To ensure the system's reliability and correct functioning, a three-level testing strategy is employed: unit, integration, and end-to-end (E2E).

### **9.1. Unit Testing (Jest)**

* **Objective:** To test the business logic within services in complete isolation.  
* **Approach:** Separate tests are written for each service method. All external dependencies, including Prisma and adapters, are fully mocked using Jest's mocking functions (jest.fn(), mockResolvedValue). This ensures that the tests run quickly and focus solely on the code unit being tested.

### **9.2. Integration Testing (Jest + Testcontainers)**

* **Objective:** To verify that different components (services, Prisma, database) work correctly together.  
* Approach: Mocking the database can hide real-world problems (e.g., constraint violations, incorrect query logic). Therefore, integration tests must be run against a real database.  
  To achieve this effectively, the Testcontainers library is used. This library allows for programmatically spinning up ephemeral Docker containers for services like PostgreSQL and Redis before a test suite begins.  
  A global setup file for Jest (jest.setup.ts) will perform the following tasks:  
  1. Start the PostgreSQL and Redis containers before all tests begin (beforeAll).  
  2. Run the prisma migrate deploy command to create the schema in the test database.  
  3. Create a single PrismaClient instance connected to the test database and make it available globally for all test files.  
  4. Stop and remove the containers after all tests have finished (afterAll), ensuring a clean testing environment.

### **9.3. End-to-End Testing (Supertest + Testcontainers)**

* **Objective:** To test the system as a fully assembled unit, using real HTTP requests, from a user's perspective.  
* **Approach:** The Supertest library is used to send real HTTP requests to the NestJS application. These tests also run in a fully integrated environment (with PostgreSQL and Redis) created by Testcontainers. The following table lists the most critical E2E test scenarios that define the system's acceptance criteria.

| ID | Scenario Description | Expected Outcome |
| :---- | :---- | :---- |
| E2E-01 | **Main Flow:** A SUPER_ADMIN creates a new Organization and assigns an ORG_ADMIN to it. The ORG_ADMIN logs in and creates a new Branch and Department. | All operations are successful (201 Created, 200 OK). The created objects are verified via GET requests. |
| E2E-02 | **Employee and Attendance:** A BRANCH_MANAGER adds a new Employee to their branch. Then, an event about this employee's card is sent to the /events/raw endpoint. | The employee is successfully created. After the event is sent, a new "CHECK_IN" record is verified to exist in the Attendance table. |
| E2E-03 | **Guest Flow:** A Guest Visit is created and approved. Then, an event with their QR code is sent. | The guest's status changes to APPROVED. After the QR code event is sent, a GUEST_CHECK_IN record appears in the Attendance table. |
| E2E-04 | **Security (Isolation):** An ORG_ADMIN from Org A attempts to retrieve employee data from Org B (GET /api/v1/employees/:id). | A 404 Not Found error is returned. This is used instead of 403 Forbidden to prevent information leakage. |
| E2E-05 | **Security (Permissions):** A user logged in with the EMPLOYEE role attempts to create a new employee (POST /api/v1/employees). | A 403 Forbidden error is returned because this role does not have this permission. |
| E2E-06 | **Idempotency:** Two identical requests with the same Idempotency-Key header are sent sequentially to the /events/raw endpoint. | The first request returns 202 Accepted. The second request also immediately returns 202 Accepted. It is verified that only **one** Attendance record has been created in the database. |
| E2E-07 | **Background Job (Export):** A request to export a report (/api/v1/reports/attendance/export) is sent. | The endpoint immediately returns a 202 Accepted response, indicating that the background job has started. The result (e.g., a file link) is expected to arrive via a notification (which is verified via the stub). |

## **10. Deployment and Operations (CI/CD)**

### **10.1. Containerization**

A multi-stage Dockerfile is used to create an optimized and secure Docker image for running the application in a production environment.

* **First stage (build):** All application dependencies are installed in a full Node.js development environment, the code is compiled from TypeScript to JavaScript, and the Prisma client is generated.  
* **Second stage (production):** This stage starts with a minimal base image like node:alpine. Only the artifacts necessary for production (the dist folder, node_modules, prisma folder) are copied from the first stage. This significantly reduces the size of the final image and minimizes the attack surface.

### **10.2. CI/CD Pipeline (GitHub Actions)**

A complete CI/CD pipeline is defined in the .github/workflows/ci.yml file to ensure that every code change is automatically verified and integrated.  
The pipeline will consist of the following parallel jobs:

1. **lint-and-format:** Checks for code style and formatting compliance (ESLint, Prettier).  
2. **unit-tests:** Runs the unit tests. This job runs quickly because it has no external dependencies.  
3. **integration-tests:** Runs the integration and E2E tests. This job starts the PostgreSQL and Redis services using Testcontainers. It guarantees that every pull request is validated against a real database.  
4. **build:** If all preceding jobs are successful, it creates the Docker image for production and pushes it to a repository like Docker Hub or GitHub Container Registry.

### **10.3. Configuration Management**

The list of all necessary environment variables to properly configure the application in different environments (development, test, production) is provided in the following table. The README.md file should include an .env.example file with these variables and their sample values.

| Variable | Description | Environment | Mandatory |
| :---- | :---- | :---- | :---- |
| NODE_ENV | The application's runtime mode. | development, production, test | Yes |
| PORT | The port the application listens on. | development, production | Yes |
| DATABASE_URL | The connection string for the PostgreSQL database. | All | Yes |
| REDIS_URL | The connection string for the Redis server. | All | Yes |
| JWT_SECRET | The secret key for signing access tokens. | All | Yes |
| JWT_EXPIRATION_TIME | The expiration time of the access token (e.g., 15m). | All | Yes |
| REFRESH_TOKEN_SECRET | The secret key for signing refresh tokens. | All | Yes |
| REFRESH_TOKEN_EXPIRATION_TIME | The expiration time of the refresh token (e.g., 7d). | All | Yes |
| S3_ENDPOINT | The endpoint URL for the S3-compatible service. | All | Yes |
| S3_ACCESS_KEY | The access key for the S3 service. | All | Yes |
| S3_SECRET_KEY | The secret key for the S3 service. | All | Yes |
| S3_BUCKET_NAME | The name of the main S3 bucket where files are stored. | All | Yes |
| LOG_LEVEL | The logging level (info, debug, warn, error). | All | Yes |

This technical specification serves as a comprehensive and clear guide for the successful implementation of the Sector Staff v2.1 project. It incorporates the best practices of modern software development and is designed to ensure the system's long-term stability and scalability.

#### **Works cited**

1. Queues | NestJS - A progressive Node.js framework, accessed August 10, 2025, [https://docs.nestjs.com/techniques/queues](https://docs.nestjs.com/techniques/queues)  
2. NestJs Bullmq best practices : r/nestjs - Reddit, accessed August 10, 2025, [https://www.reddit.com/r/nestjs/comments/1lfxrl7/nestjs_bullmq_best_practices/](https://www.reddit.com/r/nestjs/comments/1lfxrl7/nestjs_bullmq_best_practices/)  
3. passport | NestJS - A progressive Node.js framework, accessed August 10, 2025, [https://docs.nestjs.com/recipes/passport](https://docs.nestjs.com/recipes/passport)  
4. A Step-by-Step Guide to Implement JWT Authentication in NestJS using Passport | Medium, accessed August 10, 2025, [https://medium.com/@camillefauchier/implementing-authentication-in-nestjs-using-passport-and-jwt-5a565aa521de](https://medium.com/@camillefauchier/implementing-authentication-in-nestjs-using-passport-and-jwt-5a565aa521de)  
5. Many-to-many relations | Prisma Documentation, accessed August 10, 2025, [https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations)  
6. Properly handling Many-to-Many relations with additional fields using Prisma Client #2429 - GitHub, accessed August 10, 2025, [https://github.com/prisma/prisma/discussions/2429](https://github.com/prisma/prisma/discussions/2429)  
7. Guards | NestJS - A progressive Node.js framework - NestJS Docs, accessed August 10, 2025, [https://docs.nestjs.com/guards](https://docs.nestjs.com/guards)  
8. How to get token claims on NestJS Passport? - jwt - Stack Overflow, accessed August 10, 2025, [https://stackoverflow.com/questions/70367236/how-to-get-token-claims-on-nestjs-passport](https://stackoverflow.com/questions/70367236/how-to-get-token-claims-on-nestjs-passport)  
9. Authentication | NestJS - A progressive Node.js framework, accessed August 10, 2025, [https://docs.nestjs.com/security/authentication](https://docs.nestjs.com/security/authentication)  
10. User Authentication with Passport JS and JWT in Nest JS - DEV Community, accessed August 10, 2025, [https://dev.to/andisiambuku/user-authentication-with-passport-js-and-jwt-in-nest-js-1ag3](https://www.google.com/search?q=https://dev.to/andisiambuku/user-authentication-with-passport-js-and-jwt-1ag3)  
11. Creating an Idempotent REST API with NestJS. | by Robert Stoia - Medium, accessed August 10, 2025, [https://medium.com/@robertstoia/creating-an-idempotent-rest-api-with-nestjs-7c8940e71d12](https://medium.com/@robertstoia/creating-an-idempotent-rest-api-with-nestjs-7c8940e71d12)  
12. Understanding Idempotency in NestJS | by Iftikhar Ahmed - Medium, accessed August 10, 2025, [https://iftikhar-ahmed.medium.com/understanding-idempotency-in-nestjs-558e56b1300a](https://iftikhar-ahmed.medium.com/understanding-idempotency-in-nestjs-558e56b1300a)  
13. Idempotency Explained: Ensuring Reliable API Calls. A practical example in Nestjs, accessed August 10, 2025, [https://dev.to/joaoreider/idempotency-explained-ensuring-reliable-and-repeated-api-calls-in-nestjs-5emc](https://dev.to/joaoreider/idempotency-explained-ensuring-reliable-and-repeated-api-calls-in-nestjs-5emc)  
14. Retrying failing jobs | BullMQ, accessed August 10, 2025, [https://docs.bullmq.io/guide/retrying-failing-jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)  
15. Pre-signed MultiPart Uploads with Minio | VanessaSaurus, accessed August 10, 2025, [https://vsoch.github.io/2020/s3-minio-multipart-presigned-upload/](https://vsoch.github.io/2020/s3-minio-multipart-presigned-upload/)  
16. Generate a presigned URL in modular AWS SDK for JavaScript | AWS Developer Tools Blog, accessed August 10, 2025, [https://aws.amazon.com/blogs/developer/generate-presigned-url-modular-aws-sdk-javascript/](https://aws.amazon.com/blogs/developer/generate-presigned-url-modular-aws-sdk-javascript/)  
17. Implementing Secure File Download/Upload to AWS S3 with NestJS | by Sam Xzo | Medium, accessed August 10, 2025, [https://medium.com/@sam.xzo.developing/implementing-secure-file-download-upload-to-aws-s3-with-nestjs-11144b789c75](https://www.google.com/search?q=https://medium.a/@sam.xzo.developing/implementing-secure-file-download-upload-to-aws-s3-with-nestjs-11144b789c75)  
18. Upload large files to AWS S3 using Multipart upload and presigned URLs - DEV Community, accessed August 10, 2025, [https://dev.to/magpys/upload-large-files-to-aws-s3-using-multipart-upload-and-presigned-urls-4olo](https://dev.to/magpys/upload-large-files-to-aws-s3-using-multipart-upload-and-presigned-urls-4olo)  
19. NestJS Testing Recipe: Mocking Prisma | by Bonaventuragal - Medium, accessed August 10, 2025, [https://medium.com/@bonaventuragal/nestjs-testing-recipe-mocking-prisma-274c212d4b80](https://medium.com/@bonaventuragal/nestjs-testing-recipe-mocking-prisma-274c212d4b80)  
20. Integration testing with Prisma | Prisma Documentation, accessed August 10, 2025, [https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing](https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing)  
21. Improving Integration/E2E Testing Using NestJS and TestContainers ..., accessed August 10, 2025, [https://blog.stackademic.com/improving-integration-e2e-testing-using-nestjs-and-testcontainers-4a815142d147](https://blog.stackademic.com/improving-integration-e2e-testing-using-nestjs-and-testcontainers-4a815142d147)  
22. Improving Integration/E2E testing using NestJS and TestContainers - DEV Community, accessed August 10, 2025, [https://dev.to/medaymentn/improving-intergratione2e-testing-using-nestjs-and-testcontainers-3eh0](https://dev.to/medaymentn/improving-intergratione2e-testing-using-nestjs-and-testcontainers-3eh0)
