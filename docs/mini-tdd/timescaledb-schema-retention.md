# Mini TDD: TimescaleDB Schema va Retention Dizayni

## 1. Kontekst va maqsad
- **Maqsad:** Monitoring ma'lumotlari (active windows, visited sites, screenshots, user sessions) uchun TimescaleDB asosida yuqori hajmli va vaqtga bog'liq saqlash strategiyasini ishlab chiqish.
- **Kontekst:** Agent Gateway va Agent API katta hajmli log/event ma'lumotlarini yuboradi, PostgreSQL bunday oqim uchun cheklangan.
- **Natija:** TimescaleDB hypertable konfiguratsiyasi, retention va compression siyosatlari, arxivlash hamda monitoring rejalarini belgilash.

## 2. Scope
- **In-scope:**
  - Hypertablelar dizayni (`active_windows`, `visited_sites`, `screenshots`, `user_sessions`).
  - Chunk intervali va `time_bucket` strategiyasi.
  - Compression, retention, continuous aggregate (agar kerak bo'lsa).
  - Prisma integratsiyasi (dual datasource).
  - Backup/restore va migratsiya bosqichlari.
- **Out-of-scope:**
  - Real-time analytics dashboardlari.
  - ETL pipeline (external data lake).

## 3. Talablar
- Kuniga ~100M+ eventga tayyor tizim (kelajak projektsiya).
- So'nggi 6 oy ma'lumotlari tezkor qidiruv uchun, undan keyingi ma'lumotlar siqilgan holatda saqlanishi.
- Retention siyosati: default 12 oy, org bo'yicha override qilish imkoniyati.
- Prisma modeli Timescale bilan mos bo'lishi (qo'shimcha datasource via `schema.prisma`).
- High availability: self-hosted (boshlang'ich), keyinchalik managed.

## 4. Hypertable dizayni
- Jadvallar `monitoring` schema ichida saqlanadi.
- Har bir jadval uchun `datetime` asosiy vaqt ustuni, `organization_id` va `users_on_computers_id` kabi tag ustunlar.
- Commandlar:
```sql
CREATE SCHEMA IF NOT EXISTS monitoring;

CREATE TABLE monitoring.active_windows (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL,
  users_on_computers_id INT NOT NULL,
  datetime TIMESTAMPTZ NOT NULL,
  title TEXT,
  process_name TEXT,
  icon TEXT,
  active_time INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT create_hypertable('monitoring.active_windows', 'datetime',
  chunk_time_interval => interval '1 day',
  migrate_data => true,
  if_not_exists => true);
```
- Chunk interval: 1 kun (expected ingestion). Monitoring qidiruvlari ko'proq so'nggi 7 kun/30 kun bo'yicha bo'ladi.
- Qo'shimcha dimension: `organization_id` (future: `create_hypertable` bilan hash based partition).

## 5. Compression va retention
- Compression `active_windows`, `visited_sites`, `screenshots`, `user_sessions` uchun `2` oylik ma'lumotlardan boshlab:
```sql
ALTER TABLE monitoring.active_windows SET (timescaledb.compress, timescaledb.compress_segmentby = 'organization_id');
SELECT add_compression_policy('monitoring.active_windows', interval '60 days');
```
- Retention siyosati standart: 1 yil.
```sql
SELECT add_retention_policy('monitoring.active_windows', interval '365 days');
```
- Org-specific retention: `retention_policies` jadvali bilan sinhronlash yoki per-org cleanup job.

## 6. Continuous aggregates (optional)
- Agar so'nggi 30 kunlik daily stats kerak bo'lsa:
```sql
CREATE MATERIALIZED VIEW monitoring.active_windows_daily
WITH (timescaledb.continuous) AS
SELECT
  organization_id,
  time_bucket('1 day', datetime) AS bucket,
  COUNT(*) AS total_windows,
  SUM(active_time) AS total_active_time
FROM monitoring.active_windows
GROUP BY organization_id, bucket;
```
- Refresh siyosati: `1 day`, retention `400 days` (aggregated).

## 7. Prisma integratsiyasi
- `schema.prisma` da qo'shimcha datasource:
```prisma
datasource monitoring {
  provider = "postgresql"
  url      = env("TIMESCALE_URL")
}
```
- Monitoring uchun alohida Prisma Client (e2e testlarda ehtiyot bo'lish).
- `monitoring` schema jadvallarini Prisma generator ixtiyoriy `previewFeatures` bilan qo'llab-quvvatlash (yangi versiya talab qilinishi mumkin).

## 8. Migratsiya strategiyasi
1. Timescale instansiyasini o'rnatish va `create_hypertable` bajarish.
2. Agent API ni dual write rejimiga o'tkazish (PostgreSQL + Timescale).
3. Eski ma'lumotlarni batch orqali ko'chirish (`INSERT INTO monitoring.active_windows SELECT ...` limit 50k, sleep)
4. Dual write validatsiyadan so'ng eski PostgreSQL jadvallarini read-only qilish.
5. Cleanup: eski jadval `truncate` + retention policy trigger.

## 9. Backup/restore
- `pg_dump --schema-only monitoring` + `pg_dump --data-only --table=monitoring.*` (chunk bo'yicha parallel).
- Self-hosted: PITR (Point in time recovery) konfiguratsiyasi.
- Managed ga migratsiya: logical replication yoki backup import.

## 10. Monitoring va alertlar
- Timescale `timescaledb_information` viewlari orqali chunk usage monitor.
- Metrikalar: chunk count, compression ratio, retention lag.
- Alertlar: ingest lag >5m, chunk yaratishda xatolik, disk usage 80%.

## 11. Test rejalari
- Load test: synthetic data generator bilan 100M row insert testi.
- Performance test: `time_bucket` so'rovlarining latency o'lchovi.
- Migration test: dual write + data diff (CRC) taqqoslash.

## 12. Ochiq savollar
- Har bir org uchun custom retention talab qilinganida, `retention_policies` jadvalidan Timescale policyga avtomatik map qilish qayerda bajariladi?
- Continuous aggregate'lar qaysi metriclar uchun zarur (faqat active_windowsmi yoki visited_sites ham)?
- Timescale versiya update jarayoni (self-hosted → managed) uchun downtime talablari qanday?
