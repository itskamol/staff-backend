# Darhol amalga oshirish kerak bo'lgan o'zgarishlar

## 1. Adapter Consolidation
```
src/shared/adapters/ → src/infrastructure/adapters/
├── 📁 device-adapters/
│   ├── 📁 hikvision/
│   ├── 📁 zkteco/
│   └── 📁 base/
├── 📁 notification-adapters/
└── 📁 storage-adapters/
```

## 2. Domain Services Separation
```
src/modules/device/
├── 📁 domain/                 # Business rules
│   ├── device.entity.ts
│   ├── device.service.ts      # Pure business logic
│   └── device.events.ts
├── 📁 application/            # Use cases
│   ├── create-device.usecase.ts
│   ├── sync-device.usecase.ts
│   └── monitor-device.usecase.ts
├── 📁 infrastructure/         # External dependencies
│   ├── device.repository.ts
│   └── device.adapter.service.ts
└── 📁 presentation/           # API layer
    ├── device.controller.ts
    └── device.dto.ts
```

## 3. Event System Enhancement
```
src/core/events/
├── 📁 domain-events/
├── 📁 integration-events/
└── 📁 event-bus/
```

## 4. Configuration Management
```
src/config/
├── 📁 environments/
├── 📁 features/
│   ├── device.config.ts
│   ├── notification.config.ts
│   └── security.config.ts
└── 📁 validation/
```
