# Permission Naming Convention

## Overview
Bu loyihada ruxsatlar (permissions) uchun quyidagi naming convention qo'llaniladi:

## Format
```
<resource>:<action>:<scope>
```

### Resource (Resurs)
- `organization` - Tashkilot
- `user` - Foydalanuvchi
- `branch` - Filial
- `department` - Bo'lim
- `employee` - Xodim
- `device` - Qurilma
- `guest` - Mehmon
- `attendance` - Davomat
- `report` - Hisobot
- `audit` - Audit
- `admin` - Administrator

### Action (Harakat)
- `create` - Yaratish
- `read` - O'qish
- `update` - Yangilash
- `delete` - O'chirish
- `manage` - Boshqarish (CRUD + boshqa harakatlar)
- `approve` - Tasdiqlash
- `generate` - Yaratish/Hosil qilish

### Scope (Ko'lam)
- `:all` - Barcha ma'lumotlarga kirish (tashkilot bo'ylab)
- `:managed` - Faqat o'z mas'uliyatidagi ma'lumotlarga kirish (BRANCH_MANAGER uchun o'z filiallari)
- `:self` - Faqat o'z ma'lumotlariga kirish
- `:org` - Tashkilot darajasidagi ma'lumotlar
- `:branch` - Filial darajasidagi ma'lumotlar
- `:system` - Tizim darajasidagi ma'lumotlar

## Misollar

### Organization Permissions
- `organization:create` - Tashkilot yaratish
- `organization:read:all` - Barcha tashkilotlarni o'qish
- `organization:read:self` - O'z tashkilotini o'qish
- `organization:update:self` - O'z tashkilotini yangilash

### Employee Permissions
- `employee:create` - Xodim yaratish
- `employee:read:all` - Barcha xodimlarni o'qish
- `employee:read:self` - O'z ma'lumotlarini o'qish
- `employee:update:all` - Barcha xodimlarni yangilash
- `employee:update:managed` - O'z mas'uliyatidagi xodimlarni yangilash
- `employee:delete` - Xodimni o'chirish

### Device Permissions
- `device:create` - Qurilma yaratish
- `device:read:all` - Barcha qurilmalarni o'qish
- `device:manage:all` - Barcha qurilmalarni boshqarish
- `device:update:managed` - O'z mas'uliyatidagi qurilmalarni yangilash
- `device:manage:managed` - O'z mas'uliyatidagi qurilmalarni boshqarish

## Role-Permission Mapping

### SUPER_ADMIN
- Barcha `:all` va `:system` scope'li ruxsatlar
- Tizim darajasidagi boshqaruv

### ORG_ADMIN
- Tashkilot ichidagi barcha `:all` scope'li ruxsatlar
- `:org` va `:branch` scope'li ruxsatlar

### BRANCH_MANAGER
- O'z filiallaridagi `:managed` scope'li ruxsatlar
- Ba'zi `:all` scope'li ruxsatlar (o'z filiallari doirasida)

### EMPLOYEE
- Faqat `:self` scope'li ruxsatlar
- Minimal zaruriy ruxsatlar

## Implementation

Ruxsatlar `src/shared/constants/permissions.constants.ts` faylida konstantalar sifatida aniqlanadi:

```typescript
export const PERMISSIONS = {
  EMPLOYEE: {
    CREATE: 'employee:create',
    READ_ALL: 'employee:read:all',
    READ_SELF: 'employee:read:self',
    UPDATE_ALL: 'employee:update:all',
    UPDATE_MANAGED: 'employee:update:managed',
    DELETE: 'employee:delete',
  },
  // ...
} as const;
```

Controller'larda ishlatish:

```typescript
@Permissions(PERMISSIONS.EMPLOYEE.CREATE)
@Post()
async createEmployee() {
  // ...
}
```

## Naming Rules

1. **Consistency**: Bir xil resurs uchun bir xil naming pattern ishlatish
2. **Clarity**: Ruxsat nomi aniq va tushunarli bo'lishi kerak
3. **Hierarchy**: Scope'lar ierarxik tartibda: `system` > `all` > `org` > `branch` > `managed` > `self`
4. **No Redundancy**: Bir xil ma'noli ruxsatlarni takrorlamaslik

## Migration Strategy

Mavjud controller'larni bosqichma-bosqich yangilash:
1. Konstantalar yaratish
2. Auth service'da permission matrix'ni yangilash
3. Controller'larni yangilash
4. Test'larni yangilash
5. Eski string literal'larni olib tashlash