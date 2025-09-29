# Hodimlarni Nazorat Qilish Tizimi - Texnik Topshiriq

## 1. LOYIHA HAQIDA UMUMIY MA'LUMOT

### 1.1 Loyiha maqsadi

Tashkilot hodimlarining:

- Ishga kelish/ketish vaqtlarini HIKVision qurilmalari orqali nazorat qilish
- Kun davomida kompyuterlardagi faoliyatlarini agent dastur orqali monitoring
  qilish
- Tashrif buyuruvchilarni ro'yxatga olish va nazorat qilish
- Hodimlar mehnatini samaradorligini tahlil qilish

### 1.2 Texnologiyalar

- **Backend**: NestJS v10+ (NX Monorepo)
- **Frontend**: React.js
- **Ma'lumotlar bazasi**: PostgreSQL 15+ + Prisma ORM v5+
- **Cache**: Redis 7+
- **Queue**: BullMQ
- **Agent dastur**: C# (Windows Service)
- **HIKVision integratsiya**: SDK/API
- **Monorepo Tool**: NX
- **Package Manager**: pnpm

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

```
HIKVision Devices ←→ Agent API ←→ PostgreSQL + Prisma
                         ↕
C# Agent (Computers) ←→ Dashboard API ←→ Redis Cache
                         ↕
                    Web Interface
```

## 4. BACKEND TALABLARI (NestJS + NX Monorepo)

### 4.1 Asosiy modullar

#### Agent API (apps/agent-api):

- **Agent Data Controller** - C# agentlardan ma'lumot qabul qilish
- **HIKVision Controller** - HIKVision qurilmalaridan ma'lumot
- **Data Processing Service** - Ma'lumotlarni qayta ishlash

#### Dashboard API (apps/dashboard-api):

- **Authentication/Authorization** - JWT token \+ **RBAC only**
- **User Management** - Foydalanuvchilar boshqaruvi
- **Organization Management** - Tashkilot strukturasi
- **Device Management** - HIKVision qurilmalari boshqaruvi
- **Monitoring** - Hodimlar faoliyati monitoring
- **Reports** - Role-based hisobotlar yaratish
- **Visitors Management** - Mehmonlar boshqaruvi

#### Shared Libraries (libs/):

- **Prisma Database** - Database service va models
- **Auth Guards** - NestJS guards with RBAC
- **Common Types** - TypeScript interfaces
- **Utils** - Yordamchi funksiyalar

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

### 4.4 Database Connection

- **ORM**: Prisma ORM v5+
- **Connection Pool**: Maksimal 20 connection
- **Migrations**: Prisma migrate for database schema management

### 4.5 Real-time Features

- **Socket.IO** - Real-time entry/exit notifications
- **Event-driven architecture** - Hodisa asosidagi arxitektura

## 8. USE CASE LAR

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
   - User faolligini (is_active) tekshiradi
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
?page=1&limit=10&search=tashkilot_nomi&is_active=true&sort=created_at&order=desc
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
        "full_name": "O'zbekiston Respublikasi Vazirlar Mahkamasi",
        "short_name": "VzM",
        "address": "Toshkent sh., Mustaqillik maydoni",
        "phone": "+998712391234",
        "email": "info@gov.uz",
        "additional_details": "Davlat boshqaruv organi",
        "is_active": true,
        "departments_count": 15,
        "employees_count": 245,
        "created_at": "2024-01-15T09:00:00Z",
        "updated_at": "2024-03-20T14:30:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_records": 25,
      "limit": 10
    }
  }
}
```

### UC-6: Yangi Tashkilot Yaratish

**API**: POST /api/organizations **Actor**: Admin **Precondition**: Admin
huquqlari mavjud **Request Body**:

```json
{
  "full_name": "Aloqachi Technologies LLC",
  "short_name": "Aloqachi",
  "address": "Toshkent sh., Chilonzor tumani, 5-mavze",
  "phone": "+998901234567",
  "email": "info@aloqachi.uz",
  "additional_details": "IT kompaniyasi"
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
   - Unique fields (email, short_name) tekshiradi
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
      "full_name": "Aloqachi Technologies LLC",
      "short_name": "Aloqachi",
      "address": "Toshkent sh., Chilonzor tumani, 5-mavze",
      "phone": "+998901234567",
      "email": "info@aloqachi.uz",
      "additional_details": "IT kompaniyasi",
      "is_active": true,
      "created_at": "2024-08-24T12:00:00Z",
      "updated_at": "2024-08-24T12:00:00Z"
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
  "full_name": "Aloqachi Technologies LLC (Updated)",
  "short_name": "Aloqachi-Tech",
  "address": "Toshkent sh., Yashnobod tumani, 7-mavze",
  "phone": "+998901234568",
  "email": "contact@aloqachi.uz",
  "additional_details": "Software development company"
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
      "full_name": "Aloqachi Technologies LLC (Updated)",
      "short_name": "Aloqachi-Tech",
      "address": "Toshkent sh., Yashnobod tumani, 7-mavze",
      "phone": "+998901234568",
      "email": "contact@aloqachi.uz",
      "additional_details": "Software development company",
      "is_active": true,
      "created_at": "2024-08-24T12:00:00Z",
      "updated_at": "2024-08-24T12:30:00Z"
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
9. Agar bog'liqliklar mavjud bo'lsa - soft delete (is_active \= false)
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
?organization_id=1&search=IT&is_active=true&sort=name&order=asc&page=1&limit=10
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
        "organization_name": "VzM",
        "full_name": "Iqtisodiyot va moliya departamenti",
        "short_name": "IMD",
        "address": "Toshkent sh., Mustaqillik maydoni, 1-bino",
        "phone": "+998712391235",
        "email": "econ@gov.uz",
        "additional_details": "Iqtisodiy masalalar",
        "is_active": true,
        "sub_departments_count": 5,
        "employees_count": 45,
        "created_at": "2024-01-20T09:00:00Z",
        "updated_at": "2024-03-15T14:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 8,
      "total_records": 75,
      "limit": 10
    },
    "user_permissions": {
      "can_create": true,
      "can_edit": true,
      "can_delete": true,
      "can_view_all_orgs": true
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
        "full_name": "Iqtisodiyot va moliya departamenti",
        "short_name": "IMD",
        "address": "Toshkent sh., Mustaqillik maydoni, 1-bino",
        "phone": "+998712391235",
        "email": "econ@gov.uz",
        "additional_details": "Iqtisodiy masalalar",
        "is_active": true,
        "sub_departments_count": 5,
        "employees_count": 45,
        "created_at": "2024-01-20T09:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 2,
      "total_records": 15,
      "limit": 10
    },
    "user_permissions": {
      "can_create": true,
      "can_edit": true,
      "can_delete": true,
      "can_view_all_orgs": false
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
        "full_name": "Iqtisodiyot va moliya departamenti",
        "short_name": "IMD",
        "sub_departments_count": 5,
        "employees_count": 45,
        "is_active": true
      }
    ],
    "user_permissions": {
      "can_create": false,
      "can_edit": false,
      "can_delete": false,
      "can_view_all_orgs": false
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
  "full_name": "Axborot texnologiyalari departamenti",
  "short_name": "ATD",
  "address": "Toshkent sh., Chilonzor tumani",
  "phone": "+998712391240",
  "email": "it@company.uz",
  "additional_details": "IT va dasturiy ta'minot"
}
```

**Request Body (HR - organization_id auto-filled)**:

```json
{
  "full_name": "Marketing departamenti",
  "short_name": "MD",
  "address": "Toshkent sh., Mirobod tumani",
  "phone": "+998712391241",
  "email": "marketing@company.uz",
  "additional_details": "Marketing va reklama"
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
      "full_name": "Axborot texnologiyalari departamenti",
      "short_name": "ATD",
      "address": "Toshkent sh., Chilonzor tumani",
      "phone": "+998712391240",
      "email": "it@company.uz",
      "additional_details": "IT va dasturiy ta'minot",
      "is_active": true,
      "created_at": "2024-08-24T15:00:00Z",
      "updated_at": "2024-08-24T15:00:00Z"
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
  "full_name": "Axborot texnologiyalari departamenti (Updated)",
  "short_name": "AT-Dept",
  "address": "Toshkent sh., Yashnobod tumani, yangi ofis",
  "phone": "+998712391242",
  "email": "it-dept@company.uz",
  "additional_details": "IT, dasturiy ta'minot va kiberbezopaslik"
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
      "full_name": "Axborot texnologiyalari departamenti (Updated)",
      "short_name": "AT-Dept",
      "updated_at": "2024-08-24T15:30:00Z"
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
      "full_name": "Iqtisodiyot va moliya departamenti",
      "short_name": "IMD",
      "organization_name": "VzM"
    },
    "sub_departments": [
      {
        "id": 1,
        "full_name": "Byudjet bo'limi",
        "short_name": "BB",
        "address": "1-bino, 2-qavat",
        "phone": "+998712391250",
        "email": "budget@gov.uz",
        "additional_details": "Byudjet rejalashtirish",
        "is_active": true,
        "employees_count": 12,
        "policy_id": 1,
        "policy_name": "Standard Monitoring",
        "created_at": "2024-02-01T09:00:00Z",
        "updated_at": "2024-03-20T14:00:00Z"
      },
      {
        "id": 2,
        "full_name": "Moliyaviy tahlil bo'limi",
        "short_name": "MTB",
        "address": "1-bino, 3-qavat",
        "phone": "+998712391251",
        "email": "analysis@gov.uz",
        "additional_details": "Moliyaviy hisobotlar tahlili",
        "is_active": true,
        "employees_count": 8,
        "policy_id": 2,
        "policy_name": "High Security Monitoring",
        "created_at": "2024-02-15T10:00:00Z",
        "updated_at": "2024-04-01T16:00:00Z"
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
?organization_id=1&department_id=2&sub_department_id=3&search=John&is_active=true&sort=name&order=asc&page=1&limit=10
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
        "additional_details": "Senior Developer",
        "is_active": true,
        "organization": {
          "id": 1,
          "full_name": "Tech Company LLC",
          "short_name": "TechCorp"
        },
        "department": {
          "id": 1,
          "full_name": "IT Department",
          "short_name": "IT"
        },
        "sub_department": {
          "id": 1,
          "full_name": "Software Development",
          "short_name": "Dev"
        },
        "cards_count": 2,
        "cars_count": 1,
        "computer_users_count": 3,
        "created_at": "2024-01-15T09:00:00Z",
        "updated_at": "2024-03-20T14:30:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 15,
      "total_records": 145,
      "limit": 10
    },
    "user_permissions": {
      "can_create": true,
      "can_edit": true,
      "can_delete": true,
      "can_view_sensitive_data": true,
      "can_assign_cards": true,
      "can_assign_cars": true,
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
  "additional_details": "Junior Frontend Developer"
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
      "additional_details": "Junior Frontend Developer",
      "is_active": true,
      "created_at": "2024-08-24T16:00:00Z"
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
  "additional_details": "Middle Frontend Developer"
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
      "updated_at": "2024-08-24T16:30:00Z"
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
            "ip_address": "192.168.1.100"
          }
        },
        "created_at": "2024-08-24T09:15:05Z"
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
            "ip_address": "192.168.1.100"
          }
        },
        "created_at": "2024-08-24T18:30:02Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_records": 245
    },
    "summary": {
      "total_entries": 123,
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
    "most_used_applications": [
      {
        "process_name": "Code.exe",
        "total_time": 145800,
        "usage_count": 342,
        "percentage": 45.2
      },
      {
        "process_name": "chrome.exe",
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
    "productivity_analysis": {
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
        "is_admin": false,
        "is_in_domain": true,
        "is_active": true,
        "computer": {
          "id": 5,
          "computer_id": 12345,
          "os": "Windows 11 Pro",
          "ip_address": "192.168.1.150",
          "mac_address": "00:1B:44:11:3A:B7"
        },
        "created_at": "2024-07-15T10:00:00Z"
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
  "additional_details": "Asosiy kirish kartasi"
}
```

CARD_ALREADY_EXISTS

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
      "additional_details": "Asosiy kirish kartasi",
      "is_active": true,
      "created_at": "2024-08-24T17:00:00Z"
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
  "additional_details": "Xizmat avtomobili"
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
      "additional_details": "Xizmat avtomobili",
      "is_active": true,
      "created_at": "2024-08-24T17:15:00Z"
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
      "unlinked_at": "2024-08-24T17:45:00Z"
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
            "ip_address": "192.168.1.100",
            "entry_type": "both"
          }
        },
        "created_at": "2024-08-24T09:15:05Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 25,
      "total_records": 1250,
      "limit": 50
    },
    "filters": {
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
      "late_arrivals": 12,
      "early_departures": 8,
      "avg_arrival_time": "08:45",
      "avg_departure_time": "17:30"
    },
    "recent_activities": [
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
        "device_name": "Main Entrance",
        "status": "online",
        "last_activity": "2024-08-24T09:15:00Z",
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
        "avg_attendance_rate": 94.5,
        "total_entries": 5390,
        "total_exits": 5385,
        "avg_work_hours": 8.2
      },
      "department_analysis": [
        {
          "department": "IT Department",
          "employees_count": 25,
          "attendance_rate": 96.8,
          "avg_work_hours": 8.5,
          "late_arrivals": 15,
          "early_departures": 8
        }
      ],
      "employee_details": [
        {
          "employee_id": 1,
          "name": "Aliyev Vali Akramovich",
          "department": "IT Department",
          "total_work_days": 22,
          "present_days": 21,
          "absent_days": 1,
          "late_days": 2,
          "avg_arrival": "08:45",
          "avg_departure": "17:35",
          "avg_work_hours": 8.8,
          "overtime_hours": 12.5
        }
      ],
      "charts": {
        "daily_attendance": [...],
        "department_comparison": [...],
        "work_hours_distribution": [...]
      }
    },
    "export_links": {
      "pdf": "/api/reports/download/RPT-20240824-001.pdf",
      "excel": "/api/reports/download/RPT-20240824-001.xlsx",
      "csv": "/api/reports/download/RPT-20240824-001.csv"
    },
    "generated_at": "2024-08-24T15:30:00Z",
    "expires_at": "2024-08-31T15:30:00Z"
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
?start_date=2024-08-01&end_date=2024-08-31&include_patterns=true&include_analytics=true
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
      "late_arrivals": 3,
      "early_departures": 2,
      "avg_arrival_time": "08:52",
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
      "most_common_arrival_time": "08:45-09:00",
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
          "avg_arrival": "08:50",
          "avg_departure": "18:10",
          "attendance_rate": 100
        }
      ]
    }
  }
}
```
