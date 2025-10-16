# Mini TDD: Agent Gateway Plugin Arxitekturasi

## 1. Kontekst va maqsad
- **Maqsad:** Gateway ichida turli qurilmalar va agent protokollariga moslasha oladigan modul tizimini yaratish.
- **Kontekst:** Gateway NestJS xizmatida ishlaydi va lokal qurilmalar (Hikvision, ZKTeco va boshqalar) hamda C# agentlardan keladigan ma'lumotlarni yig'adi.
- **Natija:** Birinchi navbatda Hikvision va ZKTeco adapterlari uchun PoC tayyorlab, kelajakda qo'shimcha vendorlarni oson integratsiya qilish.

## 2. Scope
- **In-scope:**
  - `IDeviceAdapter` interfeysi va agar kerak bo'lsa `ITransportAdapter` chuqurlashtirilgan interfeysi.
  - Adapter konfiguratsiyasini (statik fayl + remote override) o'qish va validatsiya qilish.
  - Dinamik yuklash (plug-in) va lifecycle boshqaruvi.
  - Xatoliklarni boshqarish, retry va circuit breaker strategiyalari.
  - Monitoring va audit log integratsiyasi.
- **Out-of-scope:**
  - Aniq vendor API implementatsiyalari (Hikvision, ZKTeco) – alohida ishlanadi.
  - UI konfiguratsiya ekranlari.
  - Gateway tashqi deployment jarayoni.

## 3. Talablar
- Adapterlar quyidagi vazifalarni bajara olishi kerak:
  - Qurilmaga ulanish (`connect`/`disconnect`).
  - Status va health ma'lumotlarini olish.
  - Ma'lumotlarni yig'ish (events/logs) hamda buyruqlarni yuborish.
  - Konfiguratsiya yangilanganda hot-reload yoki soft-reload qo'llab-quvvatlashi.
- Gateway bir vaqtda ko'p adapterlarni boshqara olishi, har biri izolyatsiya qilingan bo'lishi kerak.
- Xatoliklar audit logga tushishi va monitoring metrikalariga aks etishi lozim.

## 4. Arxitektura
- Adapterlar NestJS `DynamicModule` sifatida kiritiladi.
- Registratsiya registry orqali amalga oshadi (`AdapterRegistryService`).
- Adapterlar `@Injectable()` klass bo'lib, `IDeviceAdapter` interfeysini bajaradi.
- Dinamik yuklash uchun quyidagilar rejalashtiriladi:
  - Start paytida konfiguratsiya faylidan `enabledAdapters` ro'yxati o'qiladi.
  - Har bir adapter uchun `resolveAdapter(adapterType)` chaqiriladi.
  - Adapter lifecycle: `onModuleInit` → `connect` → `startPolling`.
- Xatolikdan himoya:
  - Har bir adapter uchun circuit breaker (masalan, `opossum` kutubxonasi) yoki custom retry logika.
  - Kutilmagan xatolik adapterni avtomatik qayta ishga tushirish yoki disable qilishni trigger qiladi.
- Monitoring:
  - Har bir adapter metriklari Prometheus registrida namespace asosida yoziladi (`adapter_<vendor>_<metric>`).
  - Loglar `gateway_audit_logs` ga yoziladi.

## 5. Interfeyslar va ma'lumot modeli
```typescript
export interface IDeviceAdapter {
  readonly type: string;
  init(config: AdapterConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<AdapterStatus>;
  fetchEvents(since: Date): Promise<DeviceEvent[]>;
  executeCommand(command: DeviceCommand): Promise<CommandResult>;
  supportsHotReload(): boolean;
  reload?(config: AdapterConfig): Promise<void>;
}
```

- `AdapterConfig`: umumiy (polling interval, retry, credentials) va vendor-spetsifik sozlamalarni qamrab oluvchi schema (`zod` bilan validatsiya).
- `AdapterStatus`: `connected`, `lastHeartbeat`, `errorState`, `metrics`.
- `DeviceEvent`: normalizatsiya qilingan event (`timestamp`, `payload`, `severity`).
- `DeviceCommand`: umumiy command modeli (`type`, `params`).

## 6. Konfiguratsiya
- Asosiy fayl: `/etc/staff-gateway/adapters.json` (JSON yoki YAML).
- Strukturasi:
```json
{
  "global": {
    "retry": { "attempts": 3, "delayMs": 5000 },
    "metrics": { "enabled": true }
  },
  "adapters": [
    {
      "type": "hikvision",
      "enabled": true,
      "config": {
        "host": "192.168.1.10",
        "username": "admin",
        "password": "...",
        "pollIntervalSec": 10
      }
    },
    {
      "type": "zkteco",
      "enabled": false,
      "config": { ... }
    }
  ]
}
```
- Remote override: Gateway agent API'dan yangilangan konfiguratsiyani olishi va hot-reload imkoniyatini taqdim etishi mumkin (future).

## 7. Xatoliklarni boshqarish
- Adapter init paytida xato: adapter disable qilinadi, audit log + alert.
- Runtime xatolik: retry strategiyasi (exponential backoff, circuit breaker).
- Event parsing xatolari: invalid event queue ga tushiriladi, keyinchalik manual ko'rib chiqish uchun saqlanadi.
- Buyruq bajarilmasa: `CommandResult` status `FAILED` bo'ladi va gateway `device_commands` jadvaliga natija qaytaradi.

## 8. Test strategiyasi
- **Unit tests:** Adapter registry, config parser, `supportsHotReload` logikasi.
- **Integration tests:** Mock device server bilan `fetchEvents` va `executeCommand` oqimi.
- **Resilience tests:** Adapter xatolarini emulyatsiya qilish, circuit breaker ishlashi.
- **PoC KPI:** Hikvision va ZKTeco adapterlari bilan real qurilma yoki simulator orqali event yig'ish.

## 9. Timeline va deliverables
1. `IDeviceAdapter` interfeysi va registry (2 kun).
2. Config parser va validator (1 kun).
3. Mock adapter (dummy) bilan e2e test (2 kun).
4. Hikvision PoC adapter (5 kun).
5. ZKTeco PoC adapter (5 kun).
6. Observability integratsiyasi (2 kun).

## 10. Ochiq savollar
- Adapterlar hot-upgrade vaqtida eski sessiyani qanday yopishi kerak?
- Gateway UI (agar bo'lsa) konfiguratsiyani qanday boshqaradi?
- Adapterni runtime paytida qo'shish/o'chirish talab qilinadimi yoki restart talab qilinadimi?
