# Staf# Staff Control System

<div align="center">

**Zamonaviy hodimlar nazorat tizimi - Employee Monitoring & Management
Platform**

[![NestJS](https://img.shields.io/badge/nestjs-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![NX](https://img.shields.io/badge/nx-143055?style=for-the-badge&logo=nx&logoColor=white)](https://nx.dev/)

</div>

## 📋 Loyiha haqida

Staff Control System - bu zamonaviy korxona va tashkilotlar uchun mo'ljallangan
keng qamrovli hodimlar nazorat va boshqaruv tizimidir. Tizim quyidagi asosiy
funksiyalarni taqdim etadi:

### 🎯 Asosiy imkoniyatlar

- **Hodimlar boshqaruvi** - To'liq ma'lumotlar bazasi va profil boshqaruvi
- **Tashkilot strukturasi** - Bo'limlar va ierarxiyalar boshqaruvi
- **Kompyuter monitoring** - Ishchi stansiyalari faoliyatini kuzatish
- **Tashrif nazorati** - Mehmonlar ro'yxati va kirish nazorati
- **Hisobotlar tizimi** - Batafsil analitika va statistikalar
- **Agent API** - C# agent orqali real-time ma'lumotlar yig'ish

### 🏗️ Texnologik stek

- **Backend**: NestJS v11+ (TypeScript)
- **Ma'lumotlar bazasi**: PostgreSQL + Prisma ORM v6.14
- **Monorepo**: Nx workspace
- **Paket menejeri**: pnpm
- **Autentifikatsiya**: JWT + Role-based access control
- **API hujjatlari**: Swagger/OpenAPI

## 🚀 Tezkor boshlash

### Talablar

- Node.js 18+
- PostgreSQL 14+
- pnpm 8+

### O'rnatish

1. **Repository klonlash**:

```bash
git clone <repository-url>
cd staff
```

2. **Bog'liqliklarni o'rnatish**:

```bash
pnpm install
```

3. **Muhit o'zgaruvchilarini sozlash**:

```bash
cp .env.example .env
# .env faylida ma'lumotlar bazasi ulanishini sozlang
```

4. **Ma'lumotlar bazasini sozlash**:

```bash
# Migratsiyalarni bajarish
npx prisma migrate dev

# Boshlang'ich ma'lumotlarni yuklash
npx prisma db seed
```

## 🛠️ Ishga tushirish

### Barcha xizmatlarni ishga tushirish

```bash
# Dashboard API (port 3000)
npx nx serve dashboard-api

# Agent API (port 3001)
npx nx serve agent-api
```

### Shared kutubxonalarni build qilish

```bash
npx nx build shared-auth
npx nx build shared-database
npx nx build shared-utils
```

### Ma'lumotlar bazasi boshqaruvi

```bash
# Prisma Studio ochish
npx prisma studio

# Yangi migratsiya yaratish
npx prisma migrate dev --name migration_name

# Ma'lumotlar bazasini reset qilish (faqat development)
npx prisma migrate reset
```

## 📁 Loyiha strukturasi

```
staff/
├── apps/
│   ├── dashboard-api/          # Asosiy web API (port 3000)
│   │   ├── src/
│   │   │   ├── modules/        # Biznes modullar
│   │   │   │   ├── auth/       # Autentifikatsiya
│   │   │   │   ├── user/       # Foydalanuvchilar
│   │   │   │   ├── organization/ # Tashkilotlar
│   │   │   │   ├── department/ # Bo'limlar
│   │   │   │   ├── employee/   # Hodimlar
│   │   │   │   ├── visitor/    # Tashrif buyuruvchilar
│   │   │   │   └── reports/    # Hisobotlar
│   │   │   └── core/           # Asosiy xizmatlar
│   │   └── ...
│   ├── agent-api/              # Agent API (port 3001)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── agent/      # Agent boshqaruvi
│   │   │   │   ├── data-processing/ # Ma'lumotlarni qayta ishlash
│   │   │   │   ├── hikvision/  # Hikvision integratsiyasi
│   │   │   │   └── security/   # Xavfsizlik
│   │   │   └── ...
│   ├── dashboard-api-e2e/      # E2E testlar
│   └── agent-api-e2e/          # E2E testlar
├── shared/
│   ├── auth/                   # Umumiy autentifikatsiya
│   ├── database/               # Prisma schema va migratsiyalar
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Ma'lumotlar bazasi sxemasi
│   │   │   ├── migrations/     # Migratsiya fayllar
│   │   │   └── seed.ts         # Boshlang'ich ma'lumotlar
│   │   └── src/
│   └── utils/                  # Umumiy utilities
├── staff-control-system/       # Frontend (kelajakda)
└── docs/                       # Hujjatlar
```

## 🗄️ Ma'lumotlar bazasi sxemasi

### Asosiy modellar

- **User** - Tizim foydalanuvchilari
- **Organization** - Tashkilotlar
- **Department** - Bo'limlar
- **Employee** - Hodimlar
- **Visitor** - Tashrif buyuruvchilar
- **Computer** - Ishchi stansiyalari
- **ComputerUser** - Kompyuter foydalanuvchilari
- **UsersOnComputers** - Foydalanuvchi-kompyuter bog'lanishlari

### Monitoring modellari

- **ActiveWindow** - Faol oynalar tarixi
- **VisitedSite** - Tashrif buyurilgan saytlar
- **Screenshot** - Ekran rasmlari
- **UserSession** - Foydalanuvchi seanslari
- **Action** - Hodimlar faoliyati

## 🔧 API Endpoints

### Dashboard API (port 3000)

- `POST /auth/login` - Tizimga kirish
- `GET /users` - Foydalanuvchilar ro'yxati
- `GET /organizations` - Tashkilotlar
- `GET /departments` - Bo'limlar
- `GET /employees` - Hodimlar
- `GET /visitors` - Tashrif buyuruvchilar
- `GET /reports/*` - Turli hisobotlar

### Agent API (port 3001)

- `POST /agent/register` - Agent ro'yxatdan o'tkazish
- `POST /data-processing/job` - Ma'lumotlarni qayta ishlash
- `GET /data-processing/queue` - Navbat holati
- `POST /hikvision/events` - Hikvision hodisalari

## 🧪 Test qilish

```bash
# Unit testlar
npx nx test dashboard-api
npx nx test agent-api

# E2E testlar
npx nx e2e dashboard-api-e2e
npx nx e2e agent-api-e2e

# Barcha testlar
npx nx run-many --target=test
```

## 📊 Monitoring va Logging

Tizimda quyidagi monitoring vositalari mavjud:

- **Health checks** - Xizmatlar sog'ligi nazorati
- **Metrics** - Performance ko'rsatkichlari
- **Logging** - Batafsil loglar
- **Queue monitoring** - Navbat holati kuzatuvi

## 🔒 Xavfsizlik

- JWT tokenlar orqali autentifikatsiya
- Role-based access control (RBAC)
- API rate limiting
- Ma'lumotlar validatsiyasi
- SQL injection himoyasi
- CORS sozlamalari

## 🚀 Production deploy

```bash
# Production build
npx nx build dashboard-api --prod
npx nx build agent-api --prod

# Docker orqali ishga tushirish
docker-compose up -d
```
