# Multi-tenant Migration Summary

Bu migration quyidagi o'zgarishlarni amalga oshiradi:

## 1. OrganizationId qo'shilgan jadvallar:

### Policy Module:
- ✅ `Policy` - har bir tashkilot uchun alohida policy
- ✅ `ResourceGroup` - har bir tashkilot uchun alohida guruhlar  
- ✅ `Resource` - har bir tashkilot uchun alohida resurslar

### Employee Module:
- ✅ `EmployeeGroup` - har bir tashkilot uchun alohida employee guruhlar

### Organization Module:
- ✅ `Department` - har bir tashkilot uchun bo'limlar

## 2. Qo'shilgan Indexlar:

### Performance indexes:
- `organizationId` - har bir multi-tenant jadvalda
- `organizationId + isActive` - active ma'lumotlarni tez topish
- `organizationId + type` - type bo'yicha filter
- `organizationId + createdAt` - sanaga ko'ra filter

### Search indexes:
- `email`, `phone`, `username` - qidiruv uchun
- `datetime`, `actionTime` - vaqt bo'yicha qidiruv
- `url`, `processName` - monitoring uchun

### Unique constraints:
- `[organizationId, title]` - Policy
- `[organizationId, name, type]` - ResourceGroup
- `[organizationId, value, type]` - Resource
- `[organizationId, fullName]` - Department
- `[organizationId, name]` - EmployeeGroup

## 3. Cascade Delete:
- Organization o'chirilganda unga tegishli barcha ma'lumotlar o'chiriladi
- `onDelete: Cascade` - Policy, Groups, Resources, Departments, Employees
- `onDelete: SetNull` - Actions, Devices (log saqlash uchun)
- `onDelete: Restrict` - Users creating visitors (integrity)

## 4. Migration yaratish:

```bash
# Migration yaratish
npx prisma migrate dev --name add_multi_tenant_support

# Yoki prisma db push
npx prisma db push
```

## 5. Service layer'da o'zgarishlar kerak:

```typescript
// Har doim organizationId filter qo'shish
async findAll(user: UserContext) {
    return this.prisma.policy.findMany({
        where: {
            organizationId: user.organizationId,
        },
    });
}

// Yaratishda organizationId qo'shish
async create(dto: CreateDto, user: UserContext) {
    return this.prisma.policy.create({
        data: {
            ...dto,
            organizationId: user.organizationId,
        },
    });
}
```
