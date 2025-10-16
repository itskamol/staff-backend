# Staff Control System v2.0 Migration Requirements

## Introduction

Staff Control System loyihasini v1.0 dan v2.0 ga migratsiya qilish uchun korporativ miqyosda barqaror, xavfsiz va kengaytiriladigan yechimga o'tkazish. Bu migratsiya yangi Agent Gateway servisi, TimescaleDB integratsiyasi, PostgreSQL RLS, fayl saqlash abstraksiyasi, device adapter platformasi va observability stack ni o'z ichiga oladi.

## Glossary

- **Agent_Gateway**: Mijoz LAN da joylashgan NestJS microservice, C# agentlar va device lar bilan lokal aloqa o'rnatuvchi
- **Agent_API**: Cloud da joylashgan NestJS service, gateway lardan ma'lumot qabul qiluvchi
- **Dashboard_API**: Cloud da joylashgan NestJS service, asosiy business logic va web admin panel uchun
- **TimescaleDB**: Vaqtga bog'liq ma'lumotlar uchun maxsus PostgreSQL extension
- **RLS**: Row Level Security - PostgreSQL da qator darajasida xavfsizlik
- **Device_Adapter**: Turli xil qurilmalar bilan ishlash uchun plugin pattern
- **Policy_Distribution**: Siyosat o'zgarishlarini gateway larga yetkazish mexanizmi
- **Observability_Stack**: Monitoring, logging va tracing uchun LGTM (Loki + Grafana + Tempo + Prometheus)

## Requirements

### Requirement 1

**User Story:** System administrator sifatida, men hozirgi v1.0 arxitekturasini minimal downtime bilan v2.0 ga migratsiya qilishni xohlayman, shunda barcha mavjud funksiyalar saqlanib qolsin va yangi imkoniyatlar qo'shilsin.

#### Acceptance Criteria

1. WHEN migratsiya boshlanganida, THE System SHALL mavjud ma'lumotlar bazasi va fayl saqlash tizimini to'liq saqlab qolishi
2. WHEN migratsiya jarayonida, THE System SHALL downtime ni 4 soatdan kam ushlab turishi
3. WHEN migratsiya tugaganida, THE System SHALL barcha mavjud API endpoint larini backward compatibility bilan qo'llab-quvvatlashi
4. WHEN rollback kerak bo'lganida, THE System SHALL 30 daqiqa ichida oldingi holatga qaytarish imkoniyatini berishi
5. WHEN performance baseline o'lchanganida, THE System SHALL API response time (95th percentile), database query latency va throughput metrikalarini pre-migration holatida yozib olishi
6. WHEN migratsiya yakunlanganida, THE System SHALL baseline API response time dan 20% yaxshiroq, database query latency dan 15% yaxshiroq ko'rsatkichlarni ta'minlashi
7. WHEN compliance audit qilinganida, THE System SHALL data encryption at rest va in transit, audit logging va data retention policy larni ta'minlashi

### Requirement 2

**User Story:** Network administrator sifatida, men Agent Gateway ni mijoz LAN da deploy qilishni xohlayman, shunda C# agentlar va device lar bilan xavfsiz lokal aloqa o'rnatilsin va ma'lumotlar batch tarzda cloud ga yuborilsin.

#### Acceptance Criteria

1. WHEN Agent_Gateway deploy qilinganida, THE Agent_Gateway SHALL C# agentlardan HTTP/gRPC orqali ma'lumot qabul qilishi
2. WHEN Agent_Gateway ishga tushganida, THE Agent_Gateway SHALL device adapter lar orqali ISAPI va vendor API lar bilan aloqa o'rnatishi
3. WHEN Agent_Gateway offline bo'lganida, THE Agent_Gateway SHALL SQLite buffer da ma'lumotlarni configurable retention period (default 7 kun) saqlashi
4. WHEN buffer storage 80% to'lganida, THE Agent_Gateway SHALL oldest records ni delete qilishi va alert yuborishi
5. WHEN buffer storage 95% to'lganida, THE Agent_Gateway SHALL incoming data ni reject qilishi va back-pressure mechanism ishlatishi
6. WHEN Agent_Gateway online bo'lganida, THE Agent_Gateway SHALL ma'lumotlarni configurable interval (default 30 soniya) bilan batch qilib Agent_API ga yuborishi
7. WHEN Agent_Gateway ishga tushganida, THE Agent_Gateway SHALL WebSocket orqali Agent_API bilan real-time control channel o'rnatishi
8. WHEN Agent_Gateway provisioning qilinganida, THE Agent_Gateway SHALL API key va mutual TLS orqali xavfsiz authentication qilishi
9. WHEN disk usage monitoring qilinganida, THE Agent_Gateway SHALL disk usage metrikalarini expose qilishi va threshold alerting ta'minlashi

### Requirement 3

**User Story:** Database administrator sifatida, men PostgreSQL da Row Level Security (RLS) ni implement qilishni xohlayman, shunda har bir organization o'z ma'lumotlariga ega bo'lsin va ADMIN roli global access ga ega bo'lsin.

#### Acceptance Criteria

1. WHEN RLS yoqilganida, THE System SHALL har bir request boshida app.current_organization_id va app.current_role o'rnatishi
2. WHEN ADMIN roli bilan request kelganida, THE System SHALL barcha organization larning ma'lumotlariga access berishi
3. WHEN boshqa rol bilan request kelganida, THE System SHALL faqat tegishli organization_id ga mos ma'lumotlarni qaytarishi
4. WHEN RLS policy yaratilganida, THE System SHALL barcha asosiy jadvallar uchun tegishli policy larni qo'llashi
5. WHEN background job ishlaganida, THE System SHALL SET LOCAL orqali to'g'ri context o'rnatishi
6. WHEN Prisma raw query ishlatilganida, THE System SHALL RLS wrapper orqali xavfsizlikni ta'minlashi
7. WHEN RLS policy o'zgartirilganida, THE System SHALL policy_audit_logs jadvalida change history ni saqlashi
8. WHEN access denied bo'lganida, THE System SHALL failed access attempts ni audit log da yozishi
9. WHEN RLS monitoring qilinganida, THE System SHALL policy violations va access patterns metrikalarini expose qilishi

### Requirement 4

**User Story:** DevOps engineer sifatida, men TimescaleDB ni monitoring ma'lumotlari uchun integrate qilishni xohlayman, shunda ActiveWindow, VisitedSite kabi katta hajmdagi time-series ma'lumotlar samarali saqlansin.

#### Acceptance Criteria

1. WHEN TimescaleDB o'rnatilganida, THE System SHALL monitoring schema da hypertable lar yaratishi
2. WHEN Prisma konfiguratsiya qilinganida, THE System SHALL ikkinchi datasource sifatida TimescaleDB ni qo'shishi
3. WHEN monitoring ma'lumotlari kelganida, THE Agent_API SHALL ularni TimescaleDB ga yozishi
4. WHEN retention policy o'rnatilganida, THE TimescaleDB SHALL eski ma'lumotlarni avtomatik tozalashi
5. WHEN ma'lumot migratsiyasi qilinganida, THE System SHALL mavjud monitoring ma'lumotlarni batch qilib TimescaleDB ga ko'chirishi
6. WHEN TimescaleDB connection failure aniqlanganda (3 consecutive failed health checks), THE System SHALL fallback sifatida PostgreSQL partition lardan foydalanishi
7. WHEN fallback mode da, THE System SHALL TimescaleDB recovery ni har 60 soniyada tekshirishi
8. WHEN TimescaleDB qayta ishlaganida, THE System SHALL buffered data ni TimescaleDB ga sync qilishi
9. WHEN TimescaleDB migration verification qilinganida, THE System SHALL data integrity checks va row count comparison ni bajarishi

### Requirement 5

**User Story:** Software architect sifatida, men fayl saqlash tizimini abstrakt qilishni xohlayman, shunda development da local disk, production da MinIO/S3 ishlatilsin va retention policy lar qo'llanilsin.

#### Acceptance Criteria

1. WHEN IFileStorageService yaratilganida, THE System SHALL upload, download, delete va list operatsiyalarini qo'llab-quvvatlashi
2. WHEN development muhitida, THE System SHALL LocalDisk implementation dan foydalanishi
3. WHEN production muhitida, THE System SHALL MinIO yoki S3 implementation dan foydalanishi
4. WHEN retention policy o'rnatilganida, THE System SHALL eski fayllarni avtomatik archive yoki delete qilishi
5. WHEN fayl upload qilinganida, THE System SHALL organization_id bilan scope qilishi
6. WHEN storage driver migration qilinganida, THE System SHALL data integrity verification (checksum comparison) ni bajarishi
7. WHEN storage migration jarayonida, THE System SHALL downtime window ni 2 soatdan kam ushlab turishi
8. WHEN migration tooling ishlatilganida, THE System SHALL progress tracking va rollback capability ni ta'minlashi
9. WHEN file encryption kerak bo'lganida, THE System SHALL AES-256 encryption at rest ni qo'llab-quvvatlashi

### Requirement 6

**User Story:** System integrator sifatida, men device adapter platformasini yaratishni xohlayman, shunda turli xil vendor lar (Hikvision, ZKTeco) bilan ishlash uchun plugin pattern ishlatilsin.

#### Acceptance Criteria

1. WHEN IDeviceAdapter interface yaratilganida, THE System SHALL connect, status, command va fetchLogs metodlarini ta'minlashi
2. WHEN device adapter registry yaratilganida, THE System SHALL device_adapters jadvalida type, vendor, version va config_schema ni saqlashi
3. WHEN Agent_Gateway ishga tushganida, THE System SHALL config file dan qaysi adapter larni yoqishni aniqlashi
4. WHEN Hikvision adapter yaratilganida, THE System SHALL ISAPI protokoli orqali device bilan aloqa o'rnatishi
5. WHEN ZKTeco adapter yaratilganida, THE System SHALL vendor SDK orqali device bilan aloqa o'rnatishi
6. WHEN device command yuborilganida, THE System SHALL tegishli adapter orqali device ga command yuborishi va natijani qaytarishi
7. WHEN adapter hot reload qilinganida, THE System SHALL running connections ni gracefully shutdown qilishi
8. WHEN adapter disable qilinganida, THE System SHALL device status ni offline qilib belgilashi
9. WHEN adapter failure aniqlanganda, THE System SHALL failure isolation qilishi va boshqa adapter larga ta'sir qilmasligi
10. WHEN adapter health monitoring qilinganida, THE System SHALL connection status, response time va error rate metrikalarini expose qilishi

### Requirement 7

**User Story:** Operations engineer sifatida, men policy distribution va agent restart mexanizmini implement qilishni xohlayman, shunda policy o'zgarishlari real-time da agent larga yetkazilsin.

#### Acceptance Criteria

1. WHEN policy o'zgartirilganida, THE Dashboard_API SHALL policy_versions jadvalida yangi version yaratishi
2. WHEN policy version yaratilganida, THE Agent_API SHALL gateway_commands queue ga PolicyUpdate command qo'shishi
3. WHEN Agent_Gateway WebSocket orqali command olganida, THE Agent_Gateway SHALL agent larga policy update yuborishi
4. WHEN agent policy ni qabul qilganida, THE Agent_Gateway SHALL policy hash bilan acknowledgment yuborishi
5. WHEN requires_restart true bo'lganida, THE Agent_Gateway SHALL agent ga restart signal yuborishi
6. WHEN command acknowledgment kelmasa, THE System SHALL exponential backoff (1s, 2s, 4s, 8s, 16s) bilan maximum 5 marta retry qilishi
7. WHEN retry limit oshganida, THE System SHALL command ni failed qilib belgilashi va alert yuborishi
8. WHEN command queue overflow bo'lganida, THE System SHALL oldest pending commands ni expire qilishi
9. WHEN policy distribution monitoring qilinganida, THE System SHALL success rate, retry count va distribution latency metrikalarini expose qilishi

### Requirement 8

**User Story:** Monitoring engineer sifatida, men observability stack ni implement qilishni xohlayman, shunda LGTM (Loki + Grafana + Tempo + Prometheus) orqali to'liq monitoring va alerting bo'lsin.

#### Acceptance Criteria

1. WHEN Prometheus exporter o'rnatilganida, THE System SHALL request latency, queue depth va DB latency metrikalarini export qilishi
2. WHEN OpenTelemetry SDK o'rnatilganida, THE System SHALL distributed tracing ma'lumotlarini Tempo ga yuborishi
3. WHEN Winston logger konfiguratsiya qilinganida, THE System SHALL structured JSON log larni Loki ga yuborishi va PII scrubbing qilishi
4. WHEN Grafana dashboard yaratilganida, THE System SHALL agent status, ingestion lag va device success rate ni ko'rsatishi
5. WHEN alert rule lar o'rnatilganida, THE System SHALL offline gateway, queue backlog va error rate uchun notification yuborishi
6. WHEN health check endpoint yaratilganida, THE System SHALL database, queue, storage va external dependencies ning health status ini qaytarishi
7. WHEN log retention policy o'rnatilganida, THE System SHALL log larni 90 kun saqlashi va keyin avtomatik delete qilishi
8. WHEN sensitive data logging qilinganida, THE System SHALL password, API key va PII ma'lumotlarni mask qilishi
9. WHEN dependency health monitoring qilinganida, THE System SHALL PostgreSQL, TimescaleDB, Redis va File Storage ning availability ni track qilishi

### Requirement 9

**User Story:** Security engineer sifatida, men gateway auto-update mexanizmini implement qilishni xohlayman, shunda gateway lar xavfsiz tarzda avtomatik yangilansin va failsafe rollback bo'lsin.

#### Acceptance Criteria

1. WHEN Agent_Gateway versiya tekshirganida, THE System SHALL /v2/gateway/update-manifest endpoint dan imzolangan manifest olishi
2. WHEN yangi versiya mavjud bo'lganida, THE Agent_Gateway SHALL paket imzosini digital signature bilan tasdiqlashi
3. WHEN paket yuklab olinganida, THE Agent_Gateway SHALL checksum tekshirish va staging katalogiga o'rnatishi
4. WHEN health check muvaffaqiyatli bo'lganida, THE Agent_Gateway SHALL eski versiyani yangi versiya bilan almashtirishi
5. WHEN yangilanish muvaffaqiyatsiz bo'lganida, THE Agent_Gateway SHALL avtomatik ravishda oldingi versiyani tiklashi
6. WHEN upgrade jarayoni, THE System SHALL gateway_audit_logs va gateway_status_snapshots da status ni yozishi
7. WHEN package provenance tekshirilganida, THE System SHALL faqat allowed host list dan (releases.staff-control.com) paket yuklab olishi
8. WHEN update scheduling konfiguratsiya qilinganida, THE System SHALL maintenance window va update frequency ni respect qilishi
9. WHEN security vulnerability aniqlanganda, THE System SHALL emergency update capability ni ta'minlashi

### Requirement 10

**User Story:** Data engineer sifatida, men ma'lumot oqimlarini optimize qilishni xohlayman, shunda ingestion, policy distribution va device control efficient tarzda ishlashi.

#### Acceptance Criteria

1. WHEN agent ma'lumoti kelganida, THE System SHALL Agent → Gateway → Agent_API → TimescaleDB/PostgreSQL oqimini ta'minlashi
2. WHEN batch processing qilinganida, THE System SHALL configurable interval (30s) bilan ma'lumotlarni yuborishi
3. WHEN WebSocket connection uzilganida, THE System SHALL automatic reconnection va message queue ni ta'minlashi
4. WHEN device control command yuborilganida, THE System SHALL Dashboard_API → Agent_API → Gateway → Device oqimini ta'minlashi
5. WHEN offline/online monitoring qilinganida, THE System SHALL heartbeat interval (30s) bilan status yangilanishini ta'minlashi
6. WHEN idempotency token yaratilganida, THE System SHALL token ni Redis da 24 soat saqlashi
7. WHEN duplicate batch aniqlanganda, THE System SHALL idempotency token orqali duplicate processing ni oldini olishi
8. WHEN token expiry qilinganida, THE System SHALL expired token larni avtomatik tozalashi

### Requirement 11

**User Story:** Project manager sifatida, men migratsiya jarayonini bosqichma-bosqich amalga oshirishni xohlayman, shunda har bir bosqich test qilinsin va risk minimal bo'lsin.

#### Acceptance Criteria

1. WHEN Phase 1 exit criteria baholanganida, THE System SHALL IFileStorageService tests 90% pass rate va RLS policy verification ni ta'minlashi
2. WHEN Phase 2 Go/No-Go decision qilinganida, THE System SHALL Gateway MVP load test (100 req/s) va WebSocket stability test ni o'tkazishi
3. WHEN Phase 3 rollback trigger aniqlanganda, THE System SHALL policy distribution failure rate 5% dan oshganda avtomatik rollback qilishi
4. WHEN Phase 4 success criteria tekshirilganida, THE System SHALL TimescaleDB data integrity 99.9% va migration performance baseline ni ta'minlashi
5. WHEN Phase 5 validation qilinganida, THE System SHALL Hikvision adapter connection success rate 95% dan yuqori bo'lishi
6. WHEN Phase 6 completion criteria baholanganida, THE System SHALL observability stack uptime 99.5% va alert response time 30s dan kam bo'lishi
7. WHEN har bir phase uchun rollback plan ishlatilganida, THE System SHALL 15 daqiqa ichida oldingi stable state ga qaytarish imkoniyatini berishi
8. WHEN phase transition qilinganida, THE System SHALL smoke test suite ni avtomatik ishga tushirishi

### Requirement 12

**User Story:** Quality assurance engineer sifatida, men har xil test strategiyalarini implement qilishni xohlayman, shunda migration quality va system reliability ta'minlansin.

#### Acceptance Criteria

1. WHEN unit test lar yozilganida, THE System SHALL adapter lar, storage service, policy service, gateway auto-update va TimescaleDB migration uchun test coverage 85% dan yuqori bo'lishi
2. WHEN integration test lar yozilganida, THE System SHALL Gateway ↔ Agent_API WebSocket/HTTPS va Prisma RLS testlarini o'tkazishi
3. WHEN load test lar yozilganida, THE System SHALL TimescaleDB ingest (1000 msg/s) va queue backlog stress testini bajarishi
4. WHEN security test lar yozilganida, THE System SHALL gateway auth, TLS validation va penetration testlarini o'tkazishi
5. WHEN end-to-end test lar yozilganida, THE System SHALL device simulator → Gateway → Agent_API → Dashboard_UI oqimini testlashi
6. WHEN performance test lar yozilganida, THE System SHALL baseline metrics bilan comparison qilishi
7. WHEN gateway adapter test lar yozilganida, THE System SHALL Hikvision va ZKTeco adapter lar uchun mock device testlarini o'tkazishi
8. WHEN auto-update test lar yozilganida, THE System SHALL update success, rollback va security validation scenariolarini testlashi
9. WHEN TimescaleDB migration test lar yozilganida, THE System SHALL data consistency, performance va fallback mechanism testlarini bajarishi

### Requirement 13

**User Story:** Operations manager sifatida, men migration jarayonida user communication va training ni ta'minlashni xohlayman, shunda barcha stakeholder lar yangi system dan to'g'ri foydalana olsinlar.

#### Acceptance Criteria

1. WHEN migration boshlanishidan 2 hafta oldin, THE System SHALL barcha admin user larga email notification yuborishi
2. WHEN migration jarayonida, THE System SHALL real-time status page (status.staff-control.com) ni ta'minlashi
3. WHEN yangi Gateway install qilinganida, THE System SHALL step-by-step installation guide va video tutorial ni ta'minlashi
4. WHEN v2.0 features ishga tushganida, THE System SHALL user training materials va documentation ni ta'minlashi
5. WHEN migration tugaganida, THE System SHALL what's new summary va feature comparison guide ni ta'minlashi
6. WHEN support kerak bo'lganida, THE System SHALL migration period da 24/7 technical support ni ta'minlashi
