-- =====================================================================
-- COMPRA DO MÊS LOGÍSTICA / MEGA CESTA - SETUP DO BANCO DE DADOS
-- =====================================================================
-- Este script configura o banco de dados completo do Supabase para a
-- nova franquia/unidade "MEGA CESTA". 
-- Execute este script completo no EDITOR SQL do seu novo projeto
-- Supabase (MEGA CESTA).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HABILITAR EXTENSÕES E SCHEMAS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. CRIAÇÃO DE TABELAS (SEM TRIGGERS NESTE MOMENTO)
-- ---------------------------------------------------------------------

-- Tabela: profiles (Perfis de Usuários)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text UNIQUE,
    role text CHECK (role = ANY (ARRAY['gerente'::text, 'vendedor'::text, 'entregador'::text, 'cliente'::text])),
    phone text,
    status text DEFAULT 'ativo'::text CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'pendente'::text])),
    avatar text,
    last_location jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cpf text UNIQUE,
    commission_rate numeric,
    base_salary numeric,
    start_date timestamp with time zone,
    sales_count integer DEFAULT 0,
    deliveries_count integer DEFAULT 0,
    last_login_at timestamp with time zone
);

-- Tabela: basket_models (Modelos de Cestas)
CREATE TABLE IF NOT EXISTS public.basket_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    price numeric NOT NULL,
    weight text,
    image text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    is_best_seller boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    display_order integer DEFAULT 0,
    rating numeric DEFAULT 4.8
);

-- Tabela: supplies (Insumos/Produtos de Cestas)
CREATE TABLE IF NOT EXISTS public.supplies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    unit text NOT NULL,
    current_quantity numeric DEFAULT 0,
    min_stock numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    brand text,
    category text,
    package_type text,
    volume text
);

-- Tabela: suppliers (Fornecedores)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Tabela: corporate_customers (Clientes Corporativos)
CREATE TABLE IF NOT EXISTS public.corporate_customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name text NOT NULL,
    cnpj text NOT NULL UNIQUE,
    responsible_name text NOT NULL,
    responsible_email text,
    responsible_phone text NOT NULL,
    address text,
    created_at timestamp with time zone DEFAULT now()
);

-- Tabela: app_config (Configurações Gerais de Visual e Marca)
CREATE TABLE IF NOT EXISTS public.app_config (
    id text PRIMARY KEY DEFAULT 'global'::text,
    app_name text NOT NULL DEFAULT 'Cesta Básica Na Sua Casa'::text,
    app_logo text,
    logo_type text DEFAULT 'icon'::text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    whatsapp_number text,
    primary_color varchar DEFAULT '#0a4da3',
    secondary_color varchar DEFAULT '#F5B301'
);

-- Tabela: audit_logs (Log de Auditoria Geral)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    user_name text,
    user_role text,
    table_name text NOT NULL,
    record_id uuid,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Tabela: basket_model_items (Itens de Alimentos/Insumos na Cesta)
CREATE TABLE IF NOT EXISTS public.basket_model_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_model_id uuid NOT NULL REFERENCES public.basket_models(id) ON DELETE CASCADE,
    name text NOT NULL,
    quantity text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tipo text NOT NULL DEFAULT 'alimentos'::text,
    supply_id uuid REFERENCES public.supplies(id) ON DELETE SET NULL,
    recipe_quantity numeric
);

-- Tabela: stock_entries (Entradas/Saídas de Estoque)
CREATE TABLE IF NOT EXISTS public.stock_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_model_id uuid REFERENCES public.basket_models(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    unit_cost numeric NOT NULL,
    supplier text,
    received_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes text,
    channel text DEFAULT 'geral'::text
);

-- Tabela: customers (Clientes Físicos)
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    cpf text UNIQUE,
    phone text NOT NULL,
    email text,
    address text,
    address_number text,
    neighborhood text,
    city text,
    zip_code text,
    state text,
    complement text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    tags jsonb DEFAULT '[]'::jsonb
);

-- Tabela: sales (Vendas)
CREATE TABLE IF NOT EXISTS public.sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name text,
    seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    seller_name text,
    total numeric NOT NULL,
    payment_method text NOT NULL,
    channel text CHECK (channel = ANY (ARRAY['online'::text, 'presencial'::text, 'empresarial'::text])),
    status text DEFAULT 'Pendente'::text,
    installments_count integer DEFAULT 1,
    delivery_address text,
    delivery_number text,
    delivery_contact text,
    delivery_notes text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    payment_sub_method text,
    change_amount numeric,
    corporate_customer_id uuid REFERENCES public.corporate_customers(id) ON DELETE SET NULL
);

-- Tabela: sale_items (Itens de Cestas Vendidas)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
    basket_model_id uuid REFERENCES public.basket_models(id) ON DELETE SET NULL,
    basket_name text,
    quantity integer NOT NULL,
    unit_price numeric NOT NULL
);

-- Tabela: installments (Parcelas)
CREATE TABLE IF NOT EXISTS public.installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name text,
    number integer NOT NULL,
    total_installments integer NOT NULL,
    amount numeric NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'Pendente'::text,
    paid_at timestamp with time zone,
    received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    proof_image text,
    payment_method text,
    seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    seller_name text,
    notes text
);

-- Tabela: deliveries (Entregas)
CREATE TABLE IF NOT EXISTS public.deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name text,
    address text NOT NULL,
    driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    driver_name text,
    status text DEFAULT 'Pendente'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    assigned_at timestamp with time zone,
    delivered_at timestamp with time zone,
    address_number text,
    neighborhood text,
    city text,
    zip_code text,
    state text,
    complement text,
    phone text
);

-- Tabela: daily_closings (Fechamento Diário de Caixa)
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    seller_name text,
    closing_date date NOT NULL,
    cash_amount numeric DEFAULT 0,
    card_amount numeric DEFAULT 0,
    pix_amount numeric DEFAULT 0,
    installment_amount numeric DEFAULT 0,
    status text DEFAULT 'Pendente'::text,
    approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- Tabela: daily_receipts (Comprovantes de Recebimento do Caixa)
CREATE TABLE IF NOT EXISTS public.daily_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    closing_id uuid REFERENCES public.daily_closings(id) ON DELETE CASCADE,
    sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
    amount numeric NOT NULL,
    payment_method text NOT NULL,
    proof_image text,
    installment_id uuid REFERENCES public.installments(id) ON DELETE SET NULL,
    notes text
);

-- Tabela: login_logs (Histórico de Logins)
CREATE TABLE IF NOT EXISTS public.login_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    email text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Tabela: sale_goals (Metas de Vendas)
CREATE TABLE IF NOT EXISTS public.sale_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id text,
    name text,
    type text NOT NULL,
    period text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    amount numeric NOT NULL,
    seller_id text,
    channel text,
    is_cancelled boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Tabela: supply_entries (Entrada de Insumos da Produção)
CREATE TABLE IF NOT EXISTS public.supply_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supply_id uuid REFERENCES public.supplies(id) ON DELETE CASCADE,
    quantity numeric NOT NULL,
    unit_cost numeric NOT NULL,
    supplier text,
    notes text,
    received_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL
);

-- Tabela: supply_recipes (Receitas de Montagem de Insumos)
CREATE TABLE IF NOT EXISTS public.supply_recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    basket_model_id uuid REFERENCES public.basket_models(id) ON DELETE CASCADE,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    price numeric DEFAULT 0,
    description text,
    image text,
    weight text
);

-- Tabela: supply_recipe_items (Itens de uma Receita)
CREATE TABLE IF NOT EXISTS public.supply_recipe_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id uuid REFERENCES public.supply_recipes(id) ON DELETE CASCADE,
    supply_id uuid REFERENCES public.supplies(id) ON DELETE CASCADE,
    quantity numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Tabela: productions (Produção/Montagem de Cestas)
CREATE TABLE IF NOT EXISTS public.productions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id uuid REFERENCES public.supply_recipes(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    status text DEFAULT 'PENDENTE'::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    approved_by uuid,
    channel text DEFAULT 'geral'::text
);

-- ---------------------------------------------------------------------
-- 3. FUNÇÕES PL/PGSQL E DE CONTROLE
-- ---------------------------------------------------------------------

-- Função: ping_db (Teste simples)
CREATE OR REPLACE FUNCTION public.ping_db()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'pong';
END;
$$;

-- Função: is_manager (Segurança RLS e Business)
CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'gerente' AND status = 'ativo'
  );
END;
$$;

-- Função: is_staff (Vendedores e Gerentes ativos)
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('gerente', 'vendedor') AND status = 'ativo'
  );
END;
$$;

-- Função: is_vendor (Se é vendedor ativo)
CREATE OR REPLACE FUNCTION public.is_vendor()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'vendedor'
  );
END;
$$;

-- Função: is_delivery_staff (Se pertence a equipe logística de entrega)
CREATE OR REPLACE FUNCTION public.is_delivery_staff()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('gerente', 'vendedor', 'entregador')
  );
END;
$$;

-- Função: get_my_role (Retorna a role do usuário atual)
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Função: increment_supply_stock
CREATE OR REPLACE FUNCTION public.increment_supply_stock(p_supply_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.supplies
  SET current_quantity = COALESCE(current_quantity, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_supply_id;
END;
$$;

-- Função: autofill_installment_seller_info (Trigger)
CREATE OR REPLACE FUNCTION public.autofill_installment_seller_info()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.seller_id IS NULL OR NEW.seller_name IS NULL THEN
    SELECT seller_id, seller_name INTO NEW.seller_id, NEW.seller_name
    FROM sales 
    WHERE id = NEW.sale_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Função: check_installment_lock (Trigger de segurança para parcelas aprovadas)
CREATE OR REPLACE FUNCTION public.check_installment_lock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
    IF (OLD.status = 'Pago' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.amount IS DISTINCT FROM NEW.amount)) THEN
        IF EXISTS (
            SELECT 1 
            FROM public.daily_receipts r
            JOIN public.daily_closings c ON r.closing_id = c.id
            WHERE r.installment_id = OLD.id
            AND LOWER(c.status) = 'aprovado'
        ) THEN
            RAISE EXCEPTION 'Segurança: Esta parcela pertence a um fechamento de caixa já APROVADO e não pode ser alterada ou estornada.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Função: handle_audit_log (Trigger de Auditoria de Tabelas)
CREATE OR REPLACE FUNCTION public.handle_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    v_user_name TEXT;
    v_user_role TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        SELECT name, role INTO v_user_name, v_user_role
        FROM public.profiles
        WHERE id = v_user_id;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (
            user_id, user_name, user_role,
            table_name, record_id, action,
            new_data
        ) VALUES (
            v_user_id, v_user_name, v_user_role,
            TG_TABLE_NAME, NEW.id, 'INSERT',
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (to_jsonb(OLD) <> to_jsonb(NEW)) THEN
            INSERT INTO public.audit_logs (
                user_id, user_name, user_role,
                table_name, record_id, action,
                old_data, new_data
            ) VALUES (
                v_user_id, v_user_name, v_user_role,
                TG_TABLE_NAME, NEW.id, 'UPDATE',
                to_jsonb(OLD), to_jsonb(NEW)
            );
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (
            user_id, user_name, user_role,
            table_name, record_id, action,
            old_data
        ) VALUES (
            v_user_id, v_user_name, v_user_role,
            TG_TABLE_NAME, OLD.id, 'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Função: handle_new_user (Trigger de Integração Supabase Auth -> profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'cliente')
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = COALESCE(profiles.name, EXCLUDED.name),
    role = COALESCE(profiles.role, EXCLUDED.role),
    status = CASE WHEN profiles.status = 'pendente' THEN 'ativo' ELSE profiles.status END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$;

-- Função: check_profile_conflict
CREATE OR REPLACE FUNCTION public.check_profile_conflict(p_cpf text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_conflict_field TEXT;
  v_conflict_name TEXT;
  v_clean_cpf TEXT;
  v_clean_phone TEXT;
  v_clean_email TEXT;
BEGIN
  v_clean_cpf := regexp_replace(p_cpf, '\D', '', 'g');
  v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
  v_clean_email := lower(trim(p_email));
  
  IF v_clean_cpf = '' THEN v_clean_cpf := NULL; END IF;
  IF v_clean_phone = '' THEN v_clean_phone := NULL; END IF;
  IF v_clean_email = '' THEN v_clean_email := NULL; END IF;

  IF v_clean_email IS NOT NULL THEN
    SELECT name INTO v_conflict_name
    FROM profiles
    WHERE lower(email) = v_clean_email
    AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('conflict', true, 'field', 'Email', 'name', v_conflict_name);
    END IF;
  END IF;

  IF v_clean_cpf IS NOT NULL THEN
    SELECT name INTO v_conflict_name
    FROM profiles
    WHERE regexp_replace(cpf, '\D', '', 'g') = v_clean_cpf
    AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('conflict', true, 'field', 'CPF', 'name', v_conflict_name);
    END IF;
  END IF;

  IF v_clean_phone IS NOT NULL THEN
    SELECT name INTO v_conflict_name
    FROM profiles
    WHERE regexp_replace(phone, '\D', '', 'g') = v_clean_phone
    AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('conflict', true, 'field', 'Telefone', 'name', v_conflict_name);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Função: get_stock_summary
CREATE OR REPLACE FUNCTION public.get_stock_summary()
 RETURNS TABLE(basket_model_id uuid, quantity integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as basket_model_id,
    (
      COALESCE((SELECT SUM(se.quantity)::INTEGER FROM stock_entries se WHERE se.basket_model_id = b.id), 0) -
      COALESCE((
        SELECT SUM(si.quantity)::INTEGER 
        FROM sale_items si 
        JOIN sales s ON s.id = si.sale_id 
        WHERE si.basket_model_id = b.id AND s.status != 'cancelado'
      ), 0)
    ) as quantity
  FROM basket_models b
  WHERE b.active = true;
END;
$$;

-- Função: update_basket_model_items
CREATE OR REPLACE FUNCTION public.update_basket_model_items(p_model_id uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE basket_models
  SET items = p_items
  WHERE id = p_model_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Basket model not found: %', p_model_id;
  END IF;
END;
$$;

-- Função: update_complete_sale
CREATE OR REPLACE FUNCTION public.update_complete_sale(p_sale_id uuid, p_sale_data jsonb, p_items jsonb, p_installments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_sale_result RECORD;
BEGIN
  UPDATE sales
  SET
    total = (p_sale_data->>'total')::numeric,
    payment_method = p_sale_data->>'payment_method',
    status = p_sale_data->>'status',
    notes = p_sale_data->>'notes',
    channel = p_sale_data->>'channel',
    installments_count = (p_sale_data->>'installments_count')::integer
  WHERE id = p_sale_id
  RETURNING * INTO v_sale_result;

  IF p_items IS NOT NULL THEN
    DELETE FROM sale_items WHERE sale_id = p_sale_id;
    
    INSERT INTO sale_items (sale_id, basket_model_id, basket_name, quantity, unit_price)
    SELECT 
      p_sale_id,
      (x->>'basket_model_id')::uuid,
      x->>'basket_name',
      (x->>'quantity')::integer,
      (x->>'unit_price')::numeric
    FROM jsonb_array_elements(p_items) x;
  END IF;

  IF p_installments IS NOT NULL THEN
    DELETE FROM installments 
    WHERE sale_id = p_sale_id 
      AND id NOT IN (
        SELECT (elem->>'id')::uuid 
        FROM jsonb_array_elements(p_installments) elem 
        WHERE elem->>'id' IS NOT NULL AND elem->>'id' != ''
      );

    INSERT INTO installments (
      id, sale_id, customer_id, customer_name, number, total_installments, 
      amount, due_date, status, paid_at, payment_method, received_by
    )
    SELECT 
      COALESCE(NULLIF(x->>'id', '')::uuid, gen_random_uuid()),
      p_sale_id,
      (x->>'customer_id')::uuid,
      x->>'customer_name',
      (x->>'number')::integer,
      (x->>'total_installments')::integer,
      (x->>'amount')::numeric,
      to_timestamp((x->>'due_date')::double precision / 1000)::date,
      x->>'status',
      CASE 
        WHEN x->>'paid_at' IS NOT NULL AND x->>'paid_at' != '' 
        THEN to_timestamp((x->>'paid_at')::double precision / 1000)
        ELSE NULL 
      END,
      x->>'payment_method',
      NULLIF(x->>'received_by', '')::uuid
    FROM jsonb_array_elements(p_installments) x
    ON CONFLICT (id) DO UPDATE SET
      number = EXCLUDED.number,
      total_installments = EXCLUDED.total_installments,
      amount = EXCLUDED.amount,
      due_date = EXCLUDED.due_date,
      status = EXCLUDED.status,
      paid_at = EXCLUDED.paid_at,
      payment_method = EXCLUDED.payment_method,
      received_by = EXCLUDED.received_by;
  END IF;

  RETURN to_jsonb(v_sale_result);
END;
$$;

-- Função: upsert_team_member
CREATE OR REPLACE FUNCTION public.upsert_team_member(p_id uuid, p_name text, p_role text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_cpf text DEFAULT NULL::text, p_status text DEFAULT 'pendente'::text, p_commission_rate numeric DEFAULT 0, p_base_salary numeric DEFAULT 0, p_start_date timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  caller_role TEXT;
  result JSONB;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'gerente' THEN
    RAISE EXCEPTION 'Apenas gerentes podem cadastrar membros da equipe.';
  END IF;

  INSERT INTO public.profiles (id, name, role, phone, email, cpf, status, commission_rate, base_salary, start_date)
  VALUES (p_id, p_name, p_role, p_phone, p_email, p_cpf, p_status, p_commission_rate, p_base_salary, p_start_date)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    cpf = EXCLUDED.cpf,
    status = EXCLUDED.status,
    commission_rate = EXCLUDED.commission_rate,
    base_salary = EXCLUDED.base_salary,
    start_date = EXCLUDED.start_date,
    updated_at = NOW();

  SELECT to_jsonb(p.*) INTO result FROM public.profiles p WHERE p.id = p_id;
  RETURN result;
END;
$$;

-- Função: reassign_customers
CREATE OR REPLACE FUNCTION public.reassign_customers(p_source_seller_id uuid, p_target_seller_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE customers
  SET created_by = p_target_seller_id
  WHERE created_by = p_source_seller_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'customersUpdated', v_count
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Função: create_complete_sale
CREATE OR REPLACE FUNCTION public.create_complete_sale(p_sale_data jsonb, p_items jsonb, p_installments jsonb DEFAULT '[]'::jsonb, p_delivery jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    v_sale_id UUID;
    v_result JSONB;
    v_customer_id UUID;
    v_corporate_customer_id UUID;
    v_channel TEXT;
BEGIN
    v_channel := COALESCE(p_sale_data->>'channel', 'presencial');
    
    IF v_channel = 'empresarial' THEN
        v_customer_id := NULL;
        v_corporate_customer_id := (COALESCE(p_sale_data->>'customer_id', p_sale_data->>'customerId'))::UUID;
    ELSE
        v_customer_id := (COALESCE(p_sale_data->>'customer_id', p_sale_data->>'customerId'))::UUID;
        v_corporate_customer_id := NULL;
    END IF;

    -- 1. Inserir venda
    INSERT INTO public.sales (
        customer_id, customer_name, seller_id, seller_name, total, 
        payment_method, channel, status, installments_count, 
        delivery_address, delivery_number, delivery_contact, delivery_notes,
        payment_sub_method, change_amount, corporate_customer_id
    ) VALUES (
        v_customer_id,
        COALESCE(p_sale_data->>'customer_name', p_sale_data->>'customerName'),
        (COALESCE(p_sale_data->>'seller_id', p_sale_data->>'sellerId'))::UUID,
        COALESCE(p_sale_data->>'seller_name', p_sale_data->>'sellerName'),
        (COALESCE(p_sale_data->>'total', p_sale_data->>'total'))::NUMERIC,
        COALESCE(p_sale_data->>'payment_method', p_sale_data->>'paymentMethod'),
        v_channel,
        COALESCE(p_sale_data->>'status', p_sale_data->>'status'),
        (COALESCE(p_sale_data->>'installments_count', p_sale_data->>'installmentsCount'))::INTEGER,
        COALESCE(p_sale_data->>'delivery_address', p_sale_data->>'deliveryAddress'),
        COALESCE(p_sale_data->>'delivery_number', p_sale_data->>'deliveryNumber'),
        COALESCE(p_sale_data->>'delivery_contact', p_sale_data->>'deliveryContact'),
        COALESCE(p_sale_data->>'delivery_notes', p_sale_data->>'deliveryNotes'),
        COALESCE(p_sale_data->>'payment_sub_method', p_sale_data->>'paymentSubMethod'),
        (COALESCE(p_sale_data->>'change_amount', p_sale_data->>'changeAmount'))::NUMERIC,
        v_corporate_customer_id
    ) RETURNING id INTO v_sale_id;

    -- 2. Inserir itens
    INSERT INTO public.sale_items (
        sale_id, basket_model_id, basket_name, quantity, unit_price
    )
    SELECT 
        v_sale_id,
        (COALESCE(elem->>'basket_model_id', elem->>'basketModelId'))::UUID,
        COALESCE(elem->>'basket_name', elem->>'basketName'),
        (COALESCE(elem->>'quantity', elem->>'quantity'))::INTEGER,
        (COALESCE(elem->>'unit_price', elem->>'unitPrice'))::NUMERIC
    FROM jsonb_array_elements(p_items) AS elem;

    -- 3. Debitar estoque para cada item vendido
    DECLARE
        v_item RECORD;
        v_model_id UUID;
        v_qty INTEGER;
        v_stock_channel TEXT;
    BEGIN
        v_stock_channel := CASE WHEN v_channel = 'empresarial' THEN 'empresarial' ELSE 'geral' END;
        
        FOR v_item IN SELECT v AS elem FROM jsonb_array_elements(p_items) AS v
        LOOP
            v_model_id := (COALESCE(v_item.elem->>'basket_model_id', v_item.elem->>'basketModelId'))::UUID;
            v_qty := (COALESCE(v_item.elem->>'quantity', v_item.elem->>'quantity'))::INTEGER;
            
            INSERT INTO public.stock_entries (basket_model_id, quantity, unit_cost, supplier, channel, notes, created_by)
            VALUES (
                v_model_id,
                -v_qty,
                0,
                'VENDA',
                v_stock_channel,
                'VENDA #' || v_sale_id::TEXT || ' (' || UPPER(v_channel) || ')',
                (COALESCE(p_sale_data->>'seller_id', p_sale_data->>'sellerId'))::UUID
            );
        END LOOP;
    END;

    -- 4. Inserir parcelas
    IF p_installments IS NOT NULL AND jsonb_array_length(p_installments) > 0 THEN
        INSERT INTO public.installments (
            sale_id, customer_id, customer_name, amount, due_date, status, 
            number, total_installments, proof_image
        )
        SELECT 
            v_sale_id,
            CASE WHEN v_channel = 'empresarial' THEN NULL ELSE v_customer_id END,
            COALESCE(elem->>'customer_name', elem->>'customerName'),
            (COALESCE(elem->>'amount', elem->>'amount'))::NUMERIC,
            (COALESCE(elem->>'due_date', elem->>'dueDate'))::DATE,
            COALESCE(elem->>'status', elem->>'status'),
            (COALESCE(elem->>'number', elem->>'number'))::INTEGER,
            (COALESCE(elem->>'total_installments', elem->>'totalInstallments'))::INTEGER,
            COALESCE(elem->>'proof_image', elem->>'proofImage')
        FROM jsonb_array_elements(p_installments) AS elem;
    END IF;

    -- 5. Inserir entrega
    IF p_delivery IS NOT NULL THEN
        INSERT INTO public.deliveries (
            sale_id, customer_id, customer_name, address, address_number, 
            neighborhood, city, zip_code, state, complement, phone, 
            status, driver_id, assigned_at, delivered_at, notes
        ) VALUES (
            v_sale_id,
            (COALESCE(p_delivery->>'customer_id', p_delivery->>'customerId'))::UUID,
            COALESCE(p_delivery->>'customer_name', p_delivery->>'customerName'),
            COALESCE(p_delivery->>'address', p_delivery->>'address'),
            COALESCE(p_delivery->>'address_number', p_delivery->>'addressNumber'),
            COALESCE(p_delivery->>'neighborhood', p_delivery->>'neighborhood'),
            COALESCE(p_delivery->>'city', p_delivery->>'city'),
            COALESCE(p_delivery->>'zip_code', p_delivery->>'zipCode'),
            COALESCE(p_delivery->>'state', p_delivery->>'state'),
            COALESCE(p_delivery->>'complement', p_delivery->>'complement'),
            COALESCE(p_delivery->>'phone', p_delivery->>'phone'),
            COALESCE(p_delivery->>'status', p_delivery->>'status'),
            (COALESCE(p_delivery->>'driver_id', p_delivery->>'driverId'))::UUID,
            (COALESCE(p_delivery->>'assigned_at', p_delivery->>'assignedAt'))::TIMESTAMPTZ,
            (COALESCE(p_delivery->>'delivered_at', p_delivery->>'deliveredAt'))::TIMESTAMPTZ,
            COALESCE(p_delivery->>'notes', p_delivery->>'notes')
        );
    END IF;

    SELECT to_jsonb(s) INTO v_result FROM public.sales s WHERE id = v_sale_id;
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in create_complete_sale: %', SQLERRM;
    RAISE;
END;
$$;

-- Função: get_closed_payment_ids
CREATE OR REPLACE FUNCTION public.get_closed_payment_ids()
 RETURNS TABLE(sale_id uuid, installment_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT r.sale_id, r.installment_id
  FROM public.daily_receipts r
  JOIN public.daily_closings c ON r.closing_id = c.id
  WHERE c.status != 'rejeitado';
$$;

-- Função: register_production_event
CREATE OR REPLACE FUNCTION public.register_production_event(p_recipe_id uuid, p_quantity integer, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_item record;
BEGIN
  INSERT INTO public.productions (recipe_id, quantity, status, created_by)
  VALUES (p_recipe_id, p_quantity, 'PENDENTE', p_user_id);

  FOR v_item IN 
    SELECT supply_id, quantity 
    FROM public.supply_recipe_items 
    WHERE recipe_id = p_recipe_id
  LOOP
    UPDATE public.supplies 
    SET current_quantity = COALESCE(current_quantity, 0) - (v_item.quantity * p_quantity),
        updated_at = NOW()
    WHERE id = v_item.supply_id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. CRIAÇÃO DE VISÕES
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW public.stock_levels AS
SELECT bm.id AS basket_model_id,
  bm.name,
  (COALESCE(sum(se.quantity), 0::bigint) - COALESCE(sum(si.quantity), 0::bigint)) AS current_stock
FROM basket_models bm
  LEFT JOIN stock_entries se ON bm.id = se.basket_model_id
  LEFT JOIN sale_items si ON bm.id = si.basket_model_id
GROUP BY bm.id, bm.name;

-- ---------------------------------------------------------------------
-- 5. CRIAÇÃO DE ÍNDICES ADICIONAIS
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_basket_model_items_model_id ON public.basket_model_items(basket_model_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_sale_id ON public.deliveries(sale_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON public.deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON public.sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_installments_sale_id ON public.installments(sale_id);
CREATE INDEX IF NOT EXISTS idx_installments_customer_id ON public.installments(customer_id);

-- Índices Funcionais para otimização do profiles (Prevenção de duplicados na busca de CPFs normais)
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles USING btree (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_clean ON public.profiles USING btree (regexp_replace(cpf, '\D'::text, ''::text, 'g'::text));
CREATE INDEX IF NOT EXISTS idx_profiles_phone_clean ON public.profiles USING btree (regexp_replace(phone, '\D'::text, ''::text, 'g'::text));

-- ---------------------------------------------------------------------
-- 6. CRIAÇÃO DE TRIGGERS
-- ---------------------------------------------------------------------

-- Trigger: trg_autofill_installment_seller_info
CREATE OR REPLACE TRIGGER trg_autofill_installment_seller_info
BEFORE INSERT OR UPDATE OF sale_id ON public.installments
FOR EACH ROW EXECUTE FUNCTION autofill_installment_seller_info();

-- Trigger: trg_lock_approved_installments
CREATE OR REPLACE TRIGGER trg_lock_approved_installments
BEFORE UPDATE ON public.installments
FOR EACH ROW EXECUTE FUNCTION check_installment_lock();

-- Triggers de Auditoria Geral
CREATE OR REPLACE TRIGGER trig_audit_sales AFTER INSERT OR DELETE OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
CREATE OR REPLACE TRIGGER trig_audit_installments AFTER INSERT OR DELETE OR UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
CREATE OR REPLACE TRIGGER trig_audit_customers AFTER INSERT OR DELETE OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
CREATE OR REPLACE TRIGGER trig_audit_daily_closings AFTER INSERT OR DELETE OR UPDATE ON public.daily_closings FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
CREATE OR REPLACE TRIGGER trig_audit_stock_entries AFTER INSERT OR DELETE OR UPDATE ON public.stock_entries FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
CREATE OR REPLACE TRIGGER trig_audit_basket_models AFTER INSERT OR DELETE OR UPDATE ON public.basket_models FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
CREATE OR REPLACE TRIGGER trig_audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
CREATE OR REPLACE TRIGGER trig_audit_supplies AFTER INSERT OR DELETE OR UPDATE ON public.supplies FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
CREATE OR REPLACE TRIGGER trig_audit_supply_entries AFTER INSERT OR DELETE OR UPDATE ON public.supply_entries FOR EACH ROW EXECUTE FUNCTION handle_audit_log();

-- Trigger especial da tabela auth.users (Criar profile automaticamente após o cadastro)
-- ATENÇÃO: Habilitar o trigger especial de banco de dados
CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------
-- 7. SEGURANÇA E POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- ---------------------------------------------------------------------

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basket_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basket_model_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_customers ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS da tabela: profiles
CREATE POLICY "Public profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO public USING ((auth.uid() = id) OR (get_my_role() = 'gerente'::text));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO public WITH CHECK ((auth.uid() = id) OR (get_my_role() = 'gerente'::text));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO public USING ((auth.uid() = id) OR (get_my_role() = 'gerente'::text)) WITH CHECK ((auth.uid() = id) OR (get_my_role() = 'gerente'::text));
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO public USING (get_my_role() = 'gerente'::text);
CREATE POLICY "Managers can manage all profiles." ON public.profiles FOR ALL TO authenticated USING (is_manager()) WITH CHECK (is_manager());

-- Políticas de RLS da tabela: basket_models
CREATE POLICY "Basket models are viewable by everyone" ON public.basket_models FOR SELECT TO authenticated USING ((active = true) OR is_manager());
CREATE POLICY "Managers can manage basket models" ON public.basket_models FOR ALL TO authenticated USING (is_manager()) WITH CHECK (is_manager());

-- Políticas de RLS da tabela: basket_model_items
CREATE POLICY "Anyone can read basket_model_items" ON public.basket_model_items FOR SELECT TO public USING (true);
CREATE POLICY "Managers can insert basket_model_items" ON public.basket_model_items FOR INSERT TO public WITH CHECK (is_manager());
CREATE POLICY "Managers can update basket_model_items" ON public.basket_model_items FOR UPDATE TO public USING (is_manager());
CREATE POLICY "Managers can delete basket_model_items" ON public.basket_model_items FOR DELETE TO public USING (is_manager());

-- Políticas de RLS da tabela: customers
CREATE POLICY "Users can manage their own customer record" ON public.customers FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Managers can see all customers" ON public.customers FOR SELECT TO authenticated USING (is_manager());
CREATE POLICY "Vendedores ativos podem gerenciar seus clientes" ON public.customers FOR ALL TO authenticated USING (is_staff() AND ((created_by = auth.uid()) OR is_manager())) WITH CHECK (is_staff() AND ((created_by = auth.uid()) OR is_manager()));

-- Políticas de RLS da tabela: sales
CREATE POLICY "Clientes podem ver suas próprias vendas" ON public.sales FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Clientes podem criar suas próprias vendas" ON public.sales FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Clientes podem atualizar suas vendas" ON public.sales FOR UPDATE TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Staff can view all sales" ON public.sales FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Vendedores ativos podem gerenciar suas próprias vendas" ON public.sales FOR ALL TO authenticated USING ((seller_id = auth.uid()) AND is_staff()) WITH CHECK ((seller_id = auth.uid()) AND is_staff());
CREATE POLICY "Managers can manage all sales" ON public.sales FOR ALL TO authenticated USING (is_manager()) WITH CHECK (is_manager());
CREATE POLICY "Drivers can update sale status of their assignments" ON public.sales FOR UPDATE TO authenticated USING (is_manager() OR (seller_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM deliveries d WHERE ((d.sale_id = sales.id) AND (d.driver_id = auth.uid())))));

-- Políticas de RLS da tabela: sale_items
CREATE POLICY "Clientes podem ver itens de suas vendas" ON public.sale_items FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM sales WHERE ((sales.id = sale_items.sale_id) AND (sales.customer_id = auth.uid()))));
CREATE POLICY "Clientes podem inserir itens em suas vendas" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (EXISTS ( SELECT 1 FROM sales WHERE ((sales.id = sale_items.sale_id) AND (sales.customer_id = auth.uid()))));
CREATE POLICY "Equipe pode ver todos os itens" ON public.sale_items FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Equipe pode inserir itens de venda" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (is_staff());

-- Políticas de RLS da tabela: installments
CREATE POLICY "Clientes podem ver suas parcelas" ON public.installments FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Equipe pode ver e gerenciar parcelas" ON public.installments FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- Políticas de RLS da tabela: deliveries
CREATE POLICY "Clientes podem ver suas entregas" ON public.deliveries FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Clientes podem criar suas entregas" ON public.deliveries FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Clientes podem atualizar suas entregas" ON public.deliveries FOR UPDATE TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Entregadores can see and update their deliveries" ON public.deliveries FOR ALL TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Equipe pode gerenciar entregas" ON public.deliveries FOR ALL TO authenticated USING (is_delivery_staff()) WITH CHECK (is_delivery_staff());
CREATE POLICY "Managers can see all deliveries" ON public.deliveries FOR SELECT TO authenticated USING (is_manager());
CREATE POLICY "Managers can manage all deliveries" ON public.deliveries FOR ALL TO authenticated USING (is_manager()) WITH CHECK (is_manager());

-- Políticas de RLS da tabela: daily_closings
CREATE POLICY "Sellers can manage their own closings" ON public.daily_closings FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "Managers can see and approve all closings" ON public.daily_closings FOR ALL TO authenticated USING (is_manager()) WITH CHECK (is_manager());

-- Políticas de RLS da tabela: daily_receipts
CREATE POLICY "Staff ativo pode gerenciar seus recebimentos" ON public.daily_receipts FOR ALL TO authenticated USING (is_staff() AND (EXISTS ( SELECT 1 FROM daily_closings WHERE ((daily_closings.id = daily_receipts.closing_id) AND (daily_closings.seller_id = auth.uid())))));
CREATE POLICY "Staff can view all receipts" ON public.daily_receipts FOR SELECT TO public USING (is_staff());
CREATE POLICY "Managers can manage all receipts" ON public.daily_receipts FOR ALL TO authenticated USING (is_manager()) WITH CHECK (is_manager());

-- Políticas de RLS da tabela: login_logs
CREATE POLICY "Users can insert their own logs" ON public.login_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own login logs" ON public.login_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Managers can view all login logs" ON public.login_logs FOR SELECT TO authenticated USING (is_manager());

-- Políticas de RLS da tabela: app_config
CREATE POLICY "Public read access for app_config" ON public.app_config FOR SELECT TO public USING (true);
CREATE POLICY "Permitir leitura pública" ON public.app_config FOR SELECT TO public USING (true);
CREATE POLICY "Managers can manage app_config" ON public.app_config FOR ALL TO public USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'gerente'::text)))) WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'gerente'::text))));

-- Políticas de RLS da tabela: sale_goals
CREATE POLICY "Authenticated users can read sale_goals" ON public.sale_goals FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
CREATE POLICY "Managers can insert/update sale_goals" ON public.sale_goals FOR ALL TO public USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'gerente'::text)))) WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'gerente'::text))));

-- Políticas de RLS da tabela: audit_logs
CREATE POLICY "Managers can view all audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'gerente'::text))));

-- Políticas de RLS da tabela: supplies
CREATE POLICY "Public read access for supplies" ON public.supplies FOR SELECT TO public USING (true);
CREATE POLICY "Managers can manage supplies" ON public.supplies FOR ALL TO public USING (is_manager()) WITH CHECK (is_manager());

-- Políticas de RLS da tabela: supply_entries
CREATE POLICY "Public read access for supply_entries" ON public.supply_entries FOR SELECT TO public USING (true);
CREATE POLICY "Managers can manage supply_entries" ON public.supply_entries FOR ALL TO public USING (is_manager()) WITH CHECK (is_manager());

-- Políticas de RLS da tabela: suppliers
CREATE POLICY "Usuários autenticados podem ler fornecedores" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerentes podem gerenciar fornecedores" ON public.suppliers FOR ALL TO authenticated USING ((( SELECT role FROM profiles WHERE id = auth.uid()) = 'gerente'::text)) WITH CHECK ((( SELECT role FROM profiles WHERE id = auth.uid()) = 'gerente'::text));

-- Políticas de RLS da tabela: supply_recipes
CREATE POLICY "Colaboradores leem receitas" ON public.supply_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerentes gerenciam receitas" ON public.supply_recipes FOR ALL TO authenticated USING ((( SELECT role FROM profiles WHERE id = auth.uid()) = 'gerente'::text)) WITH CHECK ((( SELECT role FROM profiles WHERE id = auth.uid()) = 'gerente'::text));

-- Políticas de RLS da tabela: supply_recipe_items
CREATE POLICY "Colaboradores leem itens de receita" ON public.supply_recipe_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerentes gerenciam itens de receita" ON public.supply_recipe_items FOR ALL TO authenticated USING ((( SELECT role FROM profiles WHERE id = auth.uid()) = 'gerente'::text)) WITH CHECK ((( SELECT role FROM profiles WHERE id = auth.uid()) = 'gerente'::text));

-- Políticas de RLS da tabela: productions
CREATE POLICY "Colaboradores leem produções" ON public.productions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerentes gerenciam produções" ON public.productions FOR ALL TO authenticated USING ((( SELECT role FROM profiles WHERE id = auth.uid()) = 'gerente'::text)) WITH CHECK ((( SELECT role FROM profiles WHERE id = auth.uid()) = 'gerente'::text));

-- Políticas de RLS da tabela: corporate_customers
CREATE POLICY "Authenticated users can manage corporate customers" ON public.corporate_customers FOR ALL TO public USING (auth.role() = 'authenticated'::text) WITH CHECK (auth.role() = 'authenticated'::text);

-- Políticas de RLS da tabela: stock_entries
CREATE POLICY "Equipe pode ver movimentações de estoque" ON public.stock_entries FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Gerentes podem gerenciar estoque" ON public.stock_entries FOR ALL TO authenticated USING (is_manager()) WITH CHECK (is_manager());


-- ---------------------------------------------------------------------
-- 8. CARGA INICIAL DE CONFIGURAÇÕES (GLOBAL SEED)
-- ---------------------------------------------------------------------
INSERT INTO public.app_config (id, app_name, app_logo, logo_type, primary_color, secondary_color)
VALUES ('global', 'MEGA CESTA', NULL, 'icon', '#0a4da3', '#F5B301')
ON CONFLICT (id) DO UPDATE SET
  app_name = EXCLUDED.app_name,
  primary_color = COALESCE(public.app_config.primary_color, EXCLUDED.primary_color),
  secondary_color = COALESCE(public.app_config.secondary_color, EXCLUDED.secondary_color);

-- =====================================================================
-- FIM DO SCRIPT DE SETUP
-- =====================================================================
