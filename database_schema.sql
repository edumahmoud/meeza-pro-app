-- ==========================================
-- MEEZA POS - DATABASE STRUCTURE v20.0
-- Focus: Accountability & Business Intelligence
-- ==========================================

-- 1. الفروع (Branches)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    operational_number TEXT UNIQUE,
    tax_number TEXT,
    commercial_register TEXT,
    status TEXT DEFAULT 'active',
    is_deleted BOOLEAN DEFAULT false,
    deletion_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. الوظائف (App Roles)
CREATE TABLE IF NOT EXISTS public.app_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key TEXT UNIQUE NOT NULL,
    role_name TEXT NOT NULL,
    seniority INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT false
);

-- 3. الموظفين (Users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role TEXT REFERENCES public.app_roles(role_key),
    salary NUMERIC DEFAULT 0,
    branch_id UUID REFERENCES public.branches(id),
    has_performance_tracking BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deletion_reason TEXT,
    days_worked_accumulated INTEGER DEFAULT 0,
    total_days_worked INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. الأصناف (Products)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    wholesale_price NUMERIC DEFAULT 0,
    retail_price NUMERIC DEFAULT 0,
    offer_price NUMERIC,
    stock NUMERIC DEFAULT 0,
    branch_id UUID REFERENCES public.branches(id),
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. المبيعات (Sales Invoices)
CREATE TABLE IF NOT EXISTS public.sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    items JSONB NOT NULL,
    total_before_discount NUMERIC NOT NULL,
    discount_value NUMERIC DEFAULT 0,
    net_total NUMERIC NOT NULL,
    created_by UUID REFERENCES public.users(id),
    branch_id UUID REFERENCES public.branches(id),
    timestamp BIGINT NOT NULL,
    is_deleted BOOLEAN DEFAULT false
);

-- 6. المصروفات (Expenses) - مع تتبع الموظف والفرع
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT DEFAULT 'general',
    branch_id UUID REFERENCES public.branches(id),
    created_by UUID REFERENCES public.users(id),
    timestamp BIGINT NOT NULL,
    notes TEXT
);

-- 7. المرتجعات (Returns) - مع تتبع الموظف والفرع
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.sales_invoices(id),
    items JSONB NOT NULL,
    total_refund NUMERIC NOT NULL,
    branch_id UUID REFERENCES public.branches(id),
    created_by UUID REFERENCES public.users(id),
    timestamp BIGINT NOT NULL,
    is_deleted BOOLEAN DEFAULT false
);

-- 8. سجل الرقابة (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username TEXT,
    action_type TEXT,
    entity_type TEXT,
    entity_id UUID,
    details TEXT,
    timestamp BIGINT NOT NULL
);

-- ==========================================
-- RELATIONAL QUERIES (BI SAMPLES)
-- ==========================================

-- A. جلب موظفي فرع معين:
-- SELECT * FROM users WHERE branch_id = 'BRANCH_ID' AND is_deleted = false;

-- B. ترتيب الأصناف حسب حجم المبيعات داخل فرع معين:
-- SELECT item->>'name' as product_name, SUM((item->>'quantity')::numeric) as total_sold
-- FROM sales_invoices, jsonb_array_elements(items) as item
-- WHERE branch_id = 'BRANCH_ID' AND is_deleted = false
-- GROUP BY product_name
-- ORDER BY total_sold DESC;

-- C. استعلام تتبع مالي لموظف (Accountability):
-- SELECT 'EXPENSE' as type, amount, description, timestamp FROM expenses WHERE created_by = 'USER_ID'
-- UNION ALL
-- SELECT 'SALE' as type, net_total as amount, 'Invoice Sale' as description, timestamp FROM sales_invoices WHERE created_by = 'USER_ID'
-- ORDER BY timestamp DESC;