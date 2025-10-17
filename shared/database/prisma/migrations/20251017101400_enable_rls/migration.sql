-- Enable RLS for all organization-scoped tables

-- Departments Table
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY department_rls ON "departments"
  USING (
    current_setting('app.current_role', true) = 'ADMIN' OR
    organization_id = current_setting('app.current_organization_id', true)::int
  );

-- Employees Table
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_rls ON "employees"
  USING (
    current_setting('app.current_role', true) = 'ADMIN' OR
    organization_id = current_setting('app.current_organization_id', true)::int
  );

-- Users Table
-- Users can have a NULL organization_id, so we need to handle that case.
-- Admins can see all users. Other users can only see users within their own organization.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_rls ON "users"
  USING (
    current_setting('app.current_role', true) = 'ADMIN' OR
    organization_id = current_setting('app.current_organization_id', true)::int
  );

-- Policies Table
ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_rls ON "policies"
  USING (
    current_setting('app.current_role', true) = 'ADMIN' OR
    organization_id = current_setting('app.current_organization_id', true)::int
  );

-- Resource Group Table
ALTER TABLE "resource_group" ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_group_rls ON "resource_group"
  USING (
    current_setting('app.current_role', true) = 'ADMIN' OR
    organization_id = current_setting('app.current_organization_id', true)::int
  );

-- Resources Table
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_rls ON "resources"
  USING (
    current_setting('app.current_role', true) = 'ADMIN' OR
    organization_id = current_setting('app.current_organization_id', true)::int
  );