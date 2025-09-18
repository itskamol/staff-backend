# Permission Matrix Analysis

## Required Permissions Matrix (from TZ.md)

| Permission | SUPER_ADMIN | ORG_ADMIN | BRANCH_MANAGER | EMPLOYEE |
| :---- | :---- | :---- | :---- | :---- |
| organization:create | ✅ | ❌ | ❌ | ❌ |
| organization:read:all | ✅ | ❌ | ❌ | ❌ |
| organization:read:self | ✅ | ✅ | ❌ | ❌ |
| organization:update:self | ✅ | ✅ | ❌ | ❌ |
| user:create:org_admin | ✅ | ❌ | ❌ | ❌ |
| user:manage:org | ✅ | ✅ | ❌ | ❌ |
| branch:create | ❌ | ✅ | ❌ | ❌ |
| branch:read:all | ❌ | ✅ | ✅ | ❌ |
| branch:update:managed | ❌ | ✅ | ✅ | ❌ |
| department:create | ❌ | ✅ | ✅ | ❌ |
| department:manage:all | ❌ | ✅ | ✅ | ❌ |
| employee:create | ❌ | ✅ | ✅ | ❌ |
| employee:read:all | ❌ | ✅ | ✅ | ❌ |
| employee:read:self | ❌ | ✅ | ✅ | ✅ |
| employee:update:all | ❌ | ✅ | ✅ | ❌ |
| employee:delete | ❌ | ✅ | ✅ | ❌ |
| device:create | ❌ | ✅ | ✅ | ❌ |
| device:manage:all | ❌ | ✅ | ✅ | ❌ |
| guest:create | ❌ | ✅ | ✅ | ❌ |
| guest:approve | ❌ | ✅ | ✅ | ❌ |
| report:generate:org | ❌ | ✅ | ❌ | ❌ |
| report:generate:branch | ❌ | ✅ | ✅ | ❌ |
| audit:read:org | ❌ | ✅ | ❌ | ❌ |
| audit:read:system | ✅ | ❌ | ❌ | ❌ |

## Implemented Permissions Matrix (from auth.service.ts)

### SUPER_ADMIN
- organization:create ✅
- organization:read:all ✅
- organization:read:self ✅
- organization:update:self ✅
- user:create:org_admin ✅
- user:manage:org ✅
- audit:read:system ✅

### ORG_ADMIN
- organization:read:self ✅
- organization:update:self ✅
- user:manage:org ✅
- branch:create ✅
- branch:read:all ✅
- branch:update:managed ✅
- department:create ✅
- department:manage:all ✅ (duplicated)
- employee:create ✅
- employee:read:all ✅
- employee:read:self ✅
- employee:update:all ✅
- employee:delete ✅
- device:create ✅
- device:manage:all ✅
- guest:create ✅
- guest:approve ✅
- report:generate:org ✅
- report:generate:branch ✅
- audit:read:org ✅

### BRANCH_MANAGER
- branch:read:all ✅
- branch:update:managed ✅
- department:create ✅
- department:manage:all ✅ (duplicated)
- employee:create ✅
- employee:read:all ✅
- employee:read:self ✅
- employee:update:all ✅
- employee:delete ✅
- device:create ✅
- device:manage:all ✅
- guest:create ✅
- guest:approve ✅
- report:generate:branch ✅

### EMPLOYEE
- employee:read:self ✅

## Issues Found

### 1. Permission Matrix Issues
- **Duplicate permission in ORG_ADMIN**: `department:manage:all` is listed twice
- **Duplicate permission in BRANCH_MANAGER**: `department:manage:all` is listed twice

### 2. Missing Permissions in Matrix
The following permissions are used in controllers but NOT defined in the role matrix:

#### Queue Controller (admin permissions)
- `admin:queue:read`
- `admin:queue:manage` 
- `admin:system:manage`

#### Guest Controller
- `guest:read:all` (used but matrix has no guest read permissions)
- `guest:update:managed` (used but not in matrix)
- `guest:manage` (used but not in matrix)

#### Attendance Controller
- `attendance:create` (used but not in matrix)
- `attendance:read:all` (used but not in matrix)
- `attendance:delete:managed` (used but not in matrix)

#### Device Controller
- `device:read:all` (used but not in matrix)
- `device:manage:managed` (used but matrix has `device:manage:all`)
- `device:update:managed` (used but not in matrix)

#### Employee Controller
- `employee:update:managed` (used but matrix has `employee:update:all`)

### 3. Inconsistent Permission Naming
- Matrix defines `device:manage:all` but controller uses `device:manage:managed`
- Matrix defines `employee:update:all` but controller uses `employee:update:managed`

### 4. Missing Role Assignments
Many permissions used in controllers are not assigned to any role in the permission matrix, meaning no user can access these endpoints.
#
# Summary of Changes Made

### 1. Fixed Jest Configuration
- Changed `moduleNameMapping` to `moduleNameMapper` in package.json
- This was causing module resolution issues in tests

### 2. Updated Permission Matrix in AuthService
The permission matrix in `src/modules/auth/auth.service.ts` has been updated to include all permissions actually used in controllers:

#### SUPER_ADMIN permissions added:
- `admin:queue:read`, `admin:queue:manage`, `admin:system:manage`

#### ORG_ADMIN permissions added:
- `device:read:all`, `device:update:managed`, `device:manage:managed`
- `guest:read:all`, `guest:update:managed`, `guest:manage`
- `attendance:create`, `attendance:read:all`, `attendance:delete:managed`

#### BRANCH_MANAGER permissions added:
- `employee:update:managed` (in addition to `employee:update:all`)
- `device:read:all`, `device:update:managed`, `device:manage:managed`
- `guest:read:all`, `guest:update:managed`, `guest:manage`
- `attendance:create`, `attendance:read:all`, `attendance:delete:managed`

#### EMPLOYEE permissions added:
- `attendance:create` (employees should be able to create their own attendance records)

### 3. Removed Duplicate Permissions
- Removed duplicate `department:manage:all` entries from ORG_ADMIN and BRANCH_MANAGER roles

### 4. Updated Tests
- Fixed the EMPLOYEE role test to expect 2 permissions instead of just 1

## Remaining Issues to Address

### 1. Test Dependencies
The auth service tests are failing due to missing CacheService dependency. The test setup needs to be fixed to properly mock all dependencies.

### 2. Permission Naming Inconsistencies
Some controllers use different permission names than what's in the original specification:
- Controllers use `employee:update:managed` but spec defines `employee:update:all`
- Controllers use `device:manage:managed` but spec defines `device:manage:all`

### 3. Missing Permissions in Original Spec
The original specification doesn't include several permissions that are actually needed:
- Attendance-related permissions
- Device read permissions
- Guest read/update permissions
- Admin system permissions

## Recommendations

1. **Standardize Permission Naming**: Decide whether to use `:all` or `:managed` suffixes consistently
2. **Update Specification**: Add the missing permissions to the official specification document
3. **Fix Test Setup**: Add proper mocking for all service dependencies
4. **Add Permission Constants**: Create a constants file to avoid hardcoding permission strings
5. **Implement Permission Validation**: Add runtime validation to ensure all used permissions are defined in the matrix