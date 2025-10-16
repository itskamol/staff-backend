# Staff Control System

<div align="center">

**Zamonaviy hodimlar nazorat va boshqaruv tizimi**  
*Enterprise Employee Monitoring & Management Platform*

[![NestJS](https://img.shields.io/badge/nestjs-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![NX](https://img.shields.io/badge/nx-143055?style=for-the-badge&logo=nx&logoColor=white)](https://nx.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

---

## 📋 Loyiha haqida

**Staff Control System** - bu zamonaviy korxona va tashkilotlar uchun ishlab chiqilgan to'liq funksional hodimlar nazorat va boshqaruv platformasidir. Tizim **Nx monorepo** arxitekturasi asosida qurilgan bo'lib, mikroservis yondashuvini qo'llab-quvvatlaydi.

### 🎯 Asosiy imkoniyatlar

#### 📊 Dashboard API (Bosh boshqaruv tizimi)
- **👥 Hodimlar boshqaruvi** - To'liq CRUD operatsiyalari, profil va lavozimlar
- **🏢 Tashkilot strukturasi** - Bo'limlar, lavozimlar va ierarxiya boshqaruvi
- **🔐 Autentifikatsiya va avtorizatsiya** - JWT, role-based access control (RBAC)
- **💻 Kompyuter foydalanuvchilari** - Ishchi stansiyalari monitoring
- **🎫 Mehmonlar tizimi** - Tashrif nazorati va bir martalik kodlar
- **🖥️ Qurilmalar boshqaruvi** - Tizimga ulangan qurilmalar nazorati
- **📈 Hisobotlar** - Tahlil va statistika, Excel/PDF eksport
- **⚙️ Siyosatlar** - Korporativ qoidalar va cheklovlar
- **👤 Foydalanuvchilar** - Tizim foydalanuvchilari va ruxsatlar

#### 🤖 Agent API (Real-time ma'lumotlar yig'ish)
- **📡 Agent boshqaruvi** - C# agent orqali real-time ma'lumotlar
- **🔄 Ma'lumotlar qayta ishlash** - Avtomatik ma'lumotlar agregatsiyasi
- **📹 Hikvision integratsiyasi** - Video nazorat tizimlari bilan ishlash
- **🔒 Xavfsizlik** - Agent autentifikatsiya va shifrlash

### 🏗️ Arxitektura

#### Monorepo struktura (Nx Workspace)
```
staff/
├── apps/
│   ├── dashboard-api/        # Asosiy boshqaruv API (Port: 3000)
│   ├── dashboard-api-e2e/    # E2E testlar
│   ├── agent-api/            # Agent uchun API (Port: 3001)
│   └── agent-api-e2e/        # E2E testlar
└── shared/
    ├── auth/                 # Autentifikatsiya kutubxonasi
    ├── common/               # Umumiy resurslar
    ├── database/             # Prisma ORM va ma'lumotlar bazasi
    ├── repository/           # Ma'lumotlar bazasi repository pattern
    └── utils/                # Yordamchi funksiyalar
```

### 🛠️ Texnologik stek

| Kategoriya | Texnologiya | Versiya |
|-----------|-------------|---------|
| **Runtime** | Node.js | 18+ |
| **Framework** | NestJS | 11.0+ |
| **Til** | TypeScript | Latest |
| **Ma'lumotlar bazasi** | PostgreSQL | 14+ |
| **ORM** | Prisma | 6.16+ |
| **Build tool** | Nx | 21.5+ |
| **Paket menejeri** | pnpm | 8+ |
| **Auth** | JWT + Passport | Latest |
| **Validatsiya** | class-validator | 0.14+ |
| **Logger** | Winston | 3.17+ |
| **API docs** | Swagger/OpenAPI | 11.2+ |
| **Testing** | Jest | Latest |
| **Monitoring** | Morgan + Winston | Latest |

## 🚀 Tezkor boshlash

### Tizim talablari

| Komponent | Minimal versiya | Tavsiya etilgan |
|-----------|----------------|-----------------|
| Node.js | 18.x | 20.x LTS |
| PostgreSQL | 14.x | 15.x+ |
| pnpm | 8.x | Latest |
| RAM | 4GB | 8GB+ |
| Disk | 2GB | 5GB+ |

### O'rnatish

#### 1️⃣ Repository klonlash

```bash
git clone https://github.com/itskamol/staff.git
cd staff
```

#### 2️⃣ Bog'liqliklarni o'rnatish

```bash
# pnpm orqali barcha bog'liqliklarni o'rnatish
pnpm install

# Prisma Client generatsiya qilish
pnpm db:generate
```

#### 3️⃣ Muhit o'zgaruvchilarini sozlash

**Dashboard API** uchun `.env` fayli yarating:

```bash
# apps/dashboard-api/.env
DATABASE_URL="postgresql://username:password@localhost:5432/staff_db"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
```

**Agent API** uchun `.env` fayli yarating:

```bash
# apps/agent-api/.env
DATABASE_URL="postgresql://username:password@localhost:5432/staff_db"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3001
NODE_ENV="development"
AGENT_SECRET_KEY="your-agent-secret-key"
```

#### 4️⃣ Ma'lumotlar bazasini sozlash

```bash
# Ma'lumotlar bazasini yaratish va migratsiyalarni bajarish
pnpm db:migrate

# Boshlang'ich ma'lumotlarni yuklash (seed)
pnpm db:seed

# Prisma Studio ochish (ixtiyoriy)
pnpm db:studio
```

## 🛠️ Ishga tushirish

### Development rejimida

```bash
# Dashboard API ni ishga tushirish (Port: 3000)
npx nx serve dashboard-api

# Agent API ni ishga tushirish (Port: 3001)
npx nx serve agent-api

# Ikkala API ni parallel ishga tushirish
npx nx run-many --target=serve --projects=dashboard-api,agent-api
```

### Production build

```bash
# Shared kutubxonalarni build qilish
npx nx run-many --target=build --projects=auth,database,utils,shared-common

# Dashboard API build
npx nx build dashboard-api

# Agent API build
npx nx build agent-api

# Barcha loyihalarni build qilish
npx nx run-many --target=build --all
```

### Ma'lumotlar bazasi boshqaruvi

```bash
# Prisma Studio ochish (GUI interface)
pnpm db:studio

# Yangi migratsiya yaratish
pnpm db:migrate

# Ma'lumotlar bazasini push qilish (migratsiyasiz)
pnpm db:push

# Ma'lumotlar bazasini reset qilish (⚠️ faqat development!)
npx prisma migrate reset --force
```

### API hujjatlari

Serverlar ishga tushgandan so'ng, Swagger dokumentatsiyasiga quyidagi manzillardan kirishingiz mumkin:

- **Dashboard API**: http://localhost:3000/api/docs
- **Agent API**: http://localhost:3001/api/docs

## 📁 Loyiha strukturasi

```
staff/ (root)
│
├── 📱 apps/                           # Ilovalar
│   ├── dashboard-api/                 # Bosh boshqaruv API (Port: 3000)
│   │   ├── src/
│   │   │   ├── app/                   # Asosiy modul
│   │   │   ├── core/                  # Yadro xizmatlari
│   │   │   │   ├── config/            # Konfiguratsiya
│   │   │   │   └── logger/            # Logger xizmati
│   │   │   ├── modules/               # Biznes modullar
│   │   │   │   ├── auth/              # 🔐 Autentifikatsiya
│   │   │   │   ├── user/              # 👤 Foydalanuvchilar
│   │   │   │   ├── organization/      # 🏢 Tashkilotlar
│   │   │   │   ├── department/        # 📊 Bo'limlar
│   │   │   │   ├── employee/          # 👥 Hodimlar
│   │   │   │   ├── computer-users/    # 💻 Kompyuter foydalanuvchilari
│   │   │   │   ├── visitor/           # 🎫 Tashrif buyuruvchilar
│   │   │   │   ├── visitors/          # 🚶 Mehmonlar tarixi
│   │   │   │   ├── onetime-codes/     # 🔢 Bir martalik kodlar
│   │   │   │   ├── devices/           # 🖥️ Qurilmalar
│   │   │   │   ├── policy/            # ⚖️ Siyosatlar
│   │   │   │   └── reports/           # 📈 Hisobotlar
│   │   │   ├── shared/                # Umumiy resurslar
│   │   │   └── main.ts                # Kirish nuqtasi
│   │   ├── webpack.config.js          # Webpack konfiguratsiyasi
│   │   └── project.json               # Nx loyiha konfiguratsiyasi
│   │
│   ├── dashboard-api-e2e/             # Dashboard API E2E testlari
│   │   └── src/
│   │       ├── staff-control-system/  # Test senariylari
│   │       └── support/               # Test yordamchilari
│   │
│   ├── agent-api/                     # Agent API (Port: 3001)
│   │   ├── src/
│   │   │   ├── app/                   # Asosiy modul
│   │   │   ├── modules/
│   │   │   │   ├── agent/             # 🤖 Agent boshqaruvi
│   │   │   │   ├── data-processing/   # 🔄 Ma'lumotlar qayta ishlash
│   │   │   │   ├── hikvision/         # 📹 Hikvision integratsiyasi
│   │   │   │   └── security/          # 🔒 Xavfsizlik
│   │   │   └── main.ts
│   │   └── project.json
│   │
│   └── agent-api-e2e/                 # Agent API E2E testlari
│       └── src/
│
├── 📦 shared/                         # Shared kutubxonalar
│   ├── auth/                          # 🔐 Autentifikatsiya kutubxonasi
│   │   ├── src/lib/                   # Auth utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── common/                        # 📚 Umumiy kutubxona
│   │   ├── src/lib/                   # Umumiy utillar
│   │   └── package.json
│   │
│   ├── database/                      # 🗄️ Ma'lumotlar bazasi kutubxonasi
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Prisma schema
│   │   │   ├── seed.ts                # Seed skript
│   │   │   ├── migrations/            # Migratsiyalar
│   │   │   └── models/                # Model fayllar
│   │   ├── src/lib/                   # Database utilities
│   │   └── package.json
│   │
│   ├── repository/                    # 📂 Repository pattern
│   │   ├── src/lib/                   # Repository klasslari
│   │   └── package.json
│   │
│   └── utils/                         # 🛠️ Yordamchi funksiyalar
│       ├── src/lib/                   # Utility funksiyalar
│       └── package.json
│
├── 📝 logs/                           # Log fayllar
├── 🔧 scripts/                        # Yordamchi skriptlar
│   └── restart.sh                     # Qayta ishga tushirish skripti
│
├── 📄 Konfiguratsiya fayllari
│   ├── nx.json                        # Nx workspace konfiguratsiyasi
│   ├── package.json                   # Root paket fayli
│   ├── pnpm-workspace.yaml            # pnpm workspace
│   ├── pnpm-lock.yaml                 # Dependency lock
│   ├── tsconfig.base.json             # TypeScript base config
│   ├── jest.config.ts                 # Jest test config
│   ├── jest.preset.js                 # Jest preset
│   └── eslint.config.mjs              # ESLint konfiguratsiyasi
│
└── README.md                          # Bu fayl
```

### Loyiha bog'liqliklar

```mermaid
graph TD
    A[dashboard-api] --> B[database]
    A --> C[auth]
    A --> D[utils]
    
    E[agent-api] --> B
    E --> C
    E --> D
    
    F[shared-common] --> C
    F --> D
    
    G[repository] --> D
    G --> C
```

## 🗄️ Ma'lumotlar bazasi sxemasi

Tizim **PostgreSQL** ma'lumotlar bazasi va **Prisma ORM** dan foydalanadi. Barcha modellar `shared/database/prisma/schema.prisma` faylida aniqlangan.

### Asosiy modellar

| Model | Tavsif | Maydonlar soni |
|-------|--------|----------------|
| 👤 **User** | Tizim foydalanuvchilari | ~15 |
| 🏢 **Organization** | Tashkilotlar | ~10 |
| 📊 **Department** | Bo'limlar | ~12 |
| 👥 **Employee** | Hodimlar ma'lumotlari | ~20 |
| 🎫 **Visitor** | Tashrif buyuruvchilar | ~15 |
| 💻 **Computer** | Ishchi stansiyalari | ~18 |
| 🖥️ **ComputerUser** | Kompyuter foydalanuvchilari | ~10 |
| 🔗 **UsersOnComputers** | Foydalanuvchi-kompyuter aloqasi | ~8 |

### Monitoring va faoliyat modellari

| Model | Tavsif | Ma'lumot turi |
|-------|--------|---------------|
| 🪟 **ActiveWindow** | Faol oynalar tarixi | Real-time |
| 🌐 **VisitedSite** | Tashrif buyurilgan saytlar | Real-time |
| 📸 **Screenshot** | Ekran rasmlari | Binary/URL |
| 🕐 **UserSession** | Foydalanuvchi seanslari | Time tracking |
| 📋 **Action** | Hodimlar faoliyati | Audit log |
| 🎫 **OneTimeCode** | Bir martalik kirish kodlari | Temporary |

### Ma'lumotlar bazasi statistikasi

- **Jami modellar**: 15+
- **Jami migratsiyalar**: Tarixiy barcha o'zgarishlar
- **Indekslar**: Tez qidiruv uchun optimallashtirish
- **Constraints**: Ma'lumotlar yaxlitligi ta'minlangan

### Prisma bilan ishlash

```bash
# Schema ni tahrirlash
nano shared/database/prisma/schema.prisma

# Client qayta generatsiya qilish
pnpm db:generate

# Yangi migratsiya yaratish
pnpm db:migrate

# Studio orqali ma'lumotlarni ko'rish
pnpm db:studio
```

## 🔧 API Endpoints

### 🌐 Dashboard API (Port: 3000)

#### Autentifikatsiya
- `POST /auth/login` - Tizimga kirish
- `POST /auth/refresh` - Token yangilash
- `POST /auth/logout` - Tizimdan chiqish

#### Foydalanuvchilar boshqaruvi
- `GET /users` - Barcha foydalanuvchilar
- `GET /users/:id` - Bitta foydalanuvchi
- `POST /users` - Yangi foydalanuvchi
- `PUT /users/:id` - Foydalanuvchini tahrirlash
- `DELETE /users/:id` - Foydalanuvchini o'chirish

#### Tashkilotlar
- `GET /organizations` - Tashkilotlar ro'yxati
- `POST /organizations` - Yangi tashkilot
- `PUT /organizations/:id` - Tashkilotni tahrirlash
- `DELETE /organizations/:id` - Tashkilotni o'chirish

#### Bo'limlar
- `GET /departments` - Bo'limlar ro'yxati
- `GET /departments/:id` - Bo'lim ma'lumotlari
- `POST /departments` - Yangi bo'lim
- `PUT /departments/:id` - Bo'limni tahrirlash
- `DELETE /departments/:id` - Bo'limni o'chirish

#### Hodimlar
- `GET /employees` - Hodimlar ro'yxati (pagination, filter, sort)
- `GET /employees/:id` - Hodim ma'lumotlari
- `POST /employees` - Yangi hodim
- `PUT /employees/:id` - Hodimni tahrirlash
- `DELETE /employees/:id` - Hodimni o'chirish

#### Kompyuter foydalanuvchilari
- `GET /computer-users` - Kompyuter foydalanuvchilari
- `GET /computer-users/:id` - Foydalanuvchi ma'lumotlari
- `POST /computer-users` - Yangi foydalanuvchi

#### Mehmonlar
- `GET /visitors` - Mehmonlar ro'yxati
- `GET /visitors/:id` - Mehmon ma'lumotlari
- `POST /visitors` - Yangi mehmon ro'yxatdan o'tkazish
- `PUT /visitors/:id` - Mehmon ma'lumotlarini yangilash

#### Bir martalik kodlar
- `GET /onetime-codes` - Kodlar ro'yxati
- `POST /onetime-codes` - Yangi kod generatsiya
- `POST /onetime-codes/verify` - Kodni tekshirish

#### Qurilmalar
- `GET /devices` - Qurilmalar ro'yxati
- `GET /devices/:id` - Qurilma ma'lumotlari
- `POST /devices` - Yangi qurilma qo'shish

#### Siyosatlar
- `GET /policy` - Siyosatlar ro'yxati
- `POST /policy` - Yangi siyosat
- `PUT /policy/:id` - Siyosatni tahrirlash

#### Hisobotlar
- `GET /reports/daily` - Kunlik hisobot
- `GET /reports/weekly` - Haftalik hisobot
- `GET /reports/monthly` - Oylik hisobot
- `GET /reports/employee/:id` - Hodim bo'yicha hisobot
- `POST /reports/export` - Hisobotni eksport qilish

### 🤖 Agent API (Port: 3001)

#### Agent boshqaruvi
- `POST /agent/register` - Agent ro'yxatdan o'tkazish
- `POST /agent/heartbeat` - Agent faolligini bildirish
- `GET /agent/config` - Agent konfiguratsiyasi
- `POST /agent/sync` - Ma'lumotlarni sinxronlash

#### Ma'lumotlar qayta ishlash
- `POST /data-processing/job` - Yangi vazifa qo'shish
- `GET /data-processing/queue` - Navbat holati
- `GET /data-processing/status/:jobId` - Vazifa holati
- `POST /data-processing/batch` - Batch ma'lumotlar yuklash

#### Hikvision integratsiyasi
- `POST /hikvision/events` - Hodisalarni qabul qilish
- `GET /hikvision/devices` - Qurilmalar ro'yxati
- `POST /hikvision/capture` - Surat olish

#### Xavfsizlik
- `POST /security/verify` - Agent autentifikatsiyasi
- `POST /security/encrypt` - Ma'lumotni shifrlash
- `GET /security/status` - Xavfsizlik holati

### 📚 API hujjatlari

Swagger UI orqali to'liq API dokumentatsiyasini ko'rish:

- **Dashboard API**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Agent API**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

## 🧪 Test qilish

### Unit testlar

```bash
# Dashboard API testlari
npx nx test dashboard-api

# Agent API testlari
npx nx test agent-api

# Barcha unit testlar
npx nx run-many --target=test --all

# Test coverage bilan
npx nx test dashboard-api --coverage

### E2E testlar

```bash
# Dashboard API E2E testlari
npx nx e2e dashboard-api-e2e

# Agent API E2E testlari
npx nx e2e agent-api-e2e

# Barcha E2E testlar
npx nx run-many --target=e2e --all
```

### Linting va formatlash

```bash
# ESLint tekshiruvi
pnpm lint

# ESLint avtomatik tuzatish
npx nx run-many --target=lint --all --fix

# Prettier formatlash
pnpm format
```

### Test coverage

```bash
# Coverage hisoboti
npx nx test dashboard-api --coverage
npx nx test agent-api --coverage

# Coverage umumiy hisobot
npx nx run-many --target=test --all --coverage
```

## 📊 Monitoring va Logging

Tizimda **Winston** logger va **Morgan** middleware orqali keng qamrovli logging tizimi mavjud.

### Log tizimlari

| Logger | Maqsad | Fayl joylashuvi |
|--------|--------|-----------------|
| 📝 **Access logs** | HTTP so'rovlar | `logs/access-*.log` |
| ❌ **Error logs** | Xatolar | `logs/error-*.log` |
| 📋 **Combined logs** | Barcha loglar | `logs/combined-*.log` |
| 🔍 **Audit logs** | Tizim faoliyati | `logs/audit-*.log` |

### Log funksiyalari

- ✅ **Daily rotation** - Kunlik log fayllar almashuvi
- 📦 **Compression** - Eski loglarni siqish
- 🗑️ **Auto cleanup** - Avtomatik tozalash (30 kun)
- 🎨 **Colored output** - Ranglar bilan konsolda ko'rsatish
- 📊 **Structured logging** - JSON formatda saqlash

### Monitoring vositalari

```bash
# Loglarni kuzatish
tail -f logs/combined-*.log

# Xatolarni kuzatish
tail -f logs/error-*.log

# Real-time monitoring
npx nx serve dashboard-api --verbose
```

## 🔒 Xavfsizlik

Tizim zamonaviy xavfsizlik standartlariga mos ravishda ishlab chiqilgan.

### Autentifikatsiya

- ✅ **JWT Tokens** - Access va Refresh tokenlar
- ✅ **Passport.js** - Strategy-based autentifikatsiya
- ✅ **Bcrypt** - Parollar xavfsiz hash qilish
- ✅ **Token expiration** - Tokenlar amal qilish muddati

### Avtorizatsiya

- ✅ **RBAC** - Role-Based Access Control
- ✅ **Guards** - NestJS Guards orqali himoya
- ✅ **Decorators** - Custom decorators orqali tekshirish
- ✅ **Permissions** - Maydon darajasidagi ruxsatlar

### Ma'lumotlar himoyasi

- ✅ **Input validation** - class-validator orqali
- ✅ **SQL injection protection** - Prisma ORM orqali
- ✅ **XSS protection** - Helmet middleware
- ✅ **CORS** - Sozlanuvchi CORS policy
- ✅ **Rate limiting** - API cheklovlari
- ✅ **Data encryption** - Sensitiv ma'lumotlar shifrlash

### Xavfsizlik best practices

```typescript
// Guards ishlatish
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')

// Validatsiya
@IsString()
@MinLength(8)
@MaxLength(20)
password: string;

// Sanitization
@Transform(({ value }) => sanitize(value))
```

## 🚀 Production deployment

### Build qilish

```bash
# Shared kutubxonalarni build
npx nx run-many --target=build --projects=auth,database,utils,shared-common

# Ilovalarni production build
npx nx build dashboard-api --configuration=production
npx nx build agent-api --configuration=production

# Barcha loyihalarni build
npx nx run-many --target=build --all --configuration=production
```

### Production sozlamalari

#### Environment variables

```bash
# Production .env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/staff_prod
JWT_SECRET=super-secret-production-key
JWT_EXPIRES_IN=7d
LOG_LEVEL=info
```

### PM2 bilan ishga tushirish

```bash
# PM2 o'rnatish
npm install -g pm2

# Ilovalarni ishga tushirish
pm2 start dist/apps/dashboard-api/main.js --name dashboard-api
pm2 start dist/apps/agent-api/main.js --name agent-api

# Auto-restart sozlash
pm2 startup
pm2 save

# Loglarni ko'rish
pm2 logs

# Monitoring
pm2 monit
```

### Docker deployment

```dockerfile
# Dockerfile misoli
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm db:generate
RUN npx nx build dashboard-api --prod

EXPOSE 3000

CMD ["node", "dist/apps/dashboard-api/main.js"]
```

### Performance optimizatsiya

- ✅ **Caching** - Redis orqali keshlash
- ✅ **Database indexing** - Tez qidiruv uchun indekslar
- ✅ **Connection pooling** - Ma'lumotlar bazasi ulanishlari
- ✅ **Compression** - Gzip siqish
- ✅ **CDN** - Static fayllar uchun

## 🔄 Nx Workspace xususiyatlari

### Nx Cloud

```bash
# Nx Cloud-ga ulanish (ixtiyoriy)
npx nx connect-to-nx-cloud

# Distributed caching
npx nx run-many --target=build --all --parallel
```

### Dependency graph

```bash
# Loyiha bog'liqliklarini ko'rish
npx nx graph

# Muayyan loyiha uchun
npx nx graph --focus=dashboard-api
```

### Code generation

```bash
# Yangi modul yaratish
npx nx g @nx/nest:module my-module --project=dashboard-api

# Controller yaratish
npx nx g @nx/nest:controller my-controller --project=dashboard-api

# Service yaratish
npx nx g @nx/nest:service my-service --project=dashboard-api

# Yangi kutubxona yaratish
npx nx g @nx/js:library my-lib --directory=shared/my-lib
```

### Affected commands

```bash
# Faqat o'zgargan loyihalarni test qilish
npx nx affected:test

# O'zgargan loyihalarni build qilish
npx nx affected:build

# O'zgargan loyihalarni lint qilish
npx nx affected:lint

# Affected loyihalarni ko'rish
npx nx affected:graph
```

## 📚 Qo'shimcha resurslar

### Package.json scriptlar

| Script | Tavsif |
|--------|--------|
| `pnpm db:generate` | Prisma Client generatsiya |
| `pnpm db:migrate` | Ma'lumotlar bazasi migratsiya |
| `pnpm db:push` | Schema push (migratsiyasiz) |
| `pnpm db:seed` | Seed ma'lumotlarni yuklash |
| `pnpm db:studio` | Prisma Studio ochish |
| `pnpm lint` | Barcha loyihalarni lint qilish |
| `pnpm test` | Barcha testlarni ishga tushirish |
| `pnpm format` | Kodni formatlash |

### Muhim fayllar

- 📝 `nx.json` - Nx workspace konfiguratsiyasi
- 📝 `tsconfig.base.json` - TypeScript path mappings
- 📝 `jest.config.ts` - Test konfiguratsiyasi
- 📝 `eslint.config.mjs` - Linting qoidalari
- 📝 `pnpm-workspace.yaml` - Workspace struktura
- 📝 `shared/database/prisma/schema.prisma` - Ma'lumotlar bazasi schema

## 🐛 Troubleshooting

### Umumiy muammolar

#### Prisma Client topilmayapti

```bash
pnpm db:generate
```

#### Port band

```bash
# Portni bo'shatish (Linux/macOS)
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

#### Node modules muammolari

```bash
# Tozalash va qayta o'rnatish
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

#### Build xatolari

```bash
# Nx cache tozalash
npx nx reset

# Qayta build qilish
npx nx build dashboard-api --skip-nx-cache
```

#### Ma'lumotlar bazasi muammolari

```bash
# Migratsiyalarni reset qilish
npx prisma migrate reset --force

# Schema push qilish
pnpm db:push

# Seed qayta yuklash
pnpm db:seed
```

## 📈 Kelajak rejalari

- [ ] 🎨 **Frontend** - React/Next.js admin panel
- [ ] 📱 **Mobile app** - React Native mobil ilova
- [ ] 🔔 **Real-time notifications** - WebSocket/Socket.io
- [ ] 📊 **Advanced analytics** - Grafana dashboard
- [ ] 🤖 **AI/ML features** - Hodimlar faoliyati tahlili
- [ ] 🌍 **Multi-tenancy** - Ko'p tashkilotlar uchun SaaS
- [ ] 📧 **Email integration** - Xabarnomalar tizimi
- [ ] 🔄 **Backup system** - Avtomatik zaxira nusxa
- [ ] 🚀 **Microservices** - Kengaytirilgan arxitektura
- [ ] 🔐 **SSO integration** - Single Sign-On

## 👥 Hissa qo'shish

Loyihaga hissa qo'shish uchun:

1. Fork qiling
2. Feature branch yarating (`git checkout -b feature/AmazingFeature`)
3. O'zgarishlarni commit qiling (`git commit -m 'Add some AmazingFeature'`)
4. Branch-ga push qiling (`git push origin feature/AmazingFeature`)
5. Pull Request oching

## 📝 Litsenziya

Bu loyiha **MIT** litsenziyasi ostida tarqatiladi.

## 📞 Aloqa

- **Repository**: [github.com/itskamol/staff](https://github.com/itskamol/staff)
- **Issues**: [GitHub Issues](https://github.com/itskamol/staff/issues)

---

<div align="center">

**Staff Control System** 🚀

Ishlab chiqildi 💚 va ☕ bilan

*2024 - 2025*

</div>
