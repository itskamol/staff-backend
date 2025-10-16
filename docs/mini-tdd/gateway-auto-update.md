# Mini TDD: Gateway Avtomatik Yangilanish Mexanizmi

## 1. Kontekst va maqsad
- **Maqsad:** Gateway dasturining o'zini o'zi yangilash mexanizmini xavfsiz, barqaror va auditga mos tarzda ishlab chiqish.
- **Kontekst:** Gateway mijoz infratuzilmasida (Raspberry Pi yoki mini server) ishlaydi, internetga cheklangan kirish bo'lishi mumkin. Yangilanishlar markaziy Agent API tomonidan boshqariladi.
- **Natija:** Manifest asosidagi update jarayonini, imzolangan paketlar va rollback strategiyasini hujjatlashtirish.

## 2. Scope
- **In-scope:**
  - Manifest formatini aniqlash.
  - Paketlarni yuklash, verifikatsiya qilish va o'rnatish jarayoni.
  - Failsafe (rollback) strategiyasi va audit loglari.
  - Versiya moslik tekshiruvi (Agent API versiyasi bilan).
- **Out-of-scope:**
  - Gateway qo'lda yangilash (manual installer).
  - UI orqali update boshqaruvi.

## 3. Talablar
- Gateway muntazam (masalan, 1 soatda bir marta) update manifestini tekshiradi.
- Manifest imzolangan bo'lishi va Gateway public key orqali tasdiqlashi kerak.
- Paket yuklab olingach, checksum va imzo tekshiriladi.
- Update jarayonida servis minimal downtime (sof restart) bilan tugashi lozim.
- Xatolik yuz bersa, oldingi versiyaga avtomatik qaytiladi.
- Update jarayoni audit logga yoziladi va Agent API ga status yuboriladi.

## 4. Arxitektura
- Gateway `UpdateService` moduli (NestJS) formata:
  - `ManifestChecker` – manifestni tekshiradi (`/v2/gateway/update-manifest`).
  - `Downloader` – paketni HTTPS orqali yuklab oladi.
  - `Validator` – imzo va checksumni tekshiradi.
  - `Installer` – paketni stajirovka direktoriyasiga unpack qiladi.
  - `Switcher` – agar health check muvaffaqiyatli bo'lsa, yangi versiyani aktiv qiladi.
  - `RollbackManager` – xatolik yuz bersa, eski versiyani qaytaradi.
- Paket formati: `.tar.gz` yoki `.zip`, ichida `manifest.json`, `app.bundle`.
- Health check: o'rnatgandan so'ng gateway lokal self-check (integratsion test), so'ng Agent API ga heartbeat.

## 5. Manifest formati
```json
{
  "version": "1.2.0",
  "build": "2025-10-10T12:00:00Z",
  "min_agent_api": "1.1.0",
  "checksum": "sha256:...",
  "package_url": "https://updates.example.com/gateway/1.2.0.tar.gz",
  "signature": "base64-encoded-signature",
  "release_notes": "Fixes security issue..."
}
```
- `min_agent_api`: gateway faqat mos versiyadan yuqori Agent API bilan ishlay olishi.
- Manifest ham imzolangan (JSON + detached signature).

## 6. Update jarayoni
1. Scheduler `ManifestChecker.check()` ni chaqiradi.
2. Agar versiya > current => `Downloader` paketni cache direktoriyasiga yuklaydi.
3. `Validator` podpis va checksumni tekshiradi.
4. `Installer` paketni `/opt/staff-gateway/releases/<version>` ga yozadi.
5. `Switcher` yangi versiyani test rejimida ishga tushiradi (background process) va health check (REST `/healthz`).
6. Agar success: symlink (`/opt/staff-gateway/current`) yangilanadi, eski versiya backup sifatida saqlanadi.
7. Gateway qayta ishga tushadi va yangi versiya bilan ishlaydi.
8. Audit log va Agent API ga `UpdateStatus` yuboriladi.
9. Agar xato: `RollbackManager` eski versiyani qayta yoqadi, audit logda status "FAILED".

## 7. Xavfsizlik
- Paketlar TLS orqali yuklanadi (mutual TLS yoki signed URL).
- Imzo uchun public/private key juftligi (server private key, gateway public key).
- Paketlar faqat trusted source'dan kelishi kerak.
- Update jarayonida credensiallar (API key) saqlanadigan `.env` fayl saqlanib qoladi.

## 8. Health check va monitoring
- Update davomida `UpdateStatus` eventlari Agent API ga yuboriladi (`STARTED`, `DOWNLOADED`, `INSTALLED`, `SWITCHED`, `SUCCESS`, `FAILED`).
- Prometheus metrikasi: `gateway_update_duration_seconds`, `gateway_update_failures_total`.
- Loglar `gateway_audit_logs` jadvaliga tushadi.

## 9. Test strategiyasi
- **Unit tests:** Manifest parser, checksum verifier, rollback logikasi.
- **Integration tests:** Fake update server bilan end-to-end o'rnatish.
- **Chaos tests:** Update vaqtida elektr o'chishi yoki disk to'lish senariysi.
- **Security tests:** Imzo noto'g'ri bo'lsa rad etilishi.

## 10. Deployment considerations
- Paket serveri CDN bilan himoyalangan.
- Release pipeline (CI/CD) manifestni imzolab, paketni joylashtiradi.
- Versioning semver (`major.minor.patch`). Major upgrade lar qo'shimcha tasdiq talab qilishi mumkin.

## 11. Ochiq savollar
- Update intervali (1 soat, 1 kun?) – Configurable bo'lishi kerakmi?
- Paket serveri bilan o'zaro autentifikatsiya qanday bo'ladi (mutual TLS yoki API key)?
- Gateway offline bo'lsa va kech qolgan update'larni qanday boshqaramiz?
