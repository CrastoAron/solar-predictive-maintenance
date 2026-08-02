-- SolarShield admin configuration schema.
-- Run this once in the Supabase SQL Editor for the project referenced by
-- SUPABASE_URL before starting the backend.

create table if not exists public.customers (
  id uuid primary key,
  name text not null check (char_length(trim(name)) > 0),
  email text not null unique,
  firebase_uid text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.panel_arrays (
  id uuid primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null default 'Main Array',
  rows integer not null default 1 check (rows > 0),
  cols integer not null default 1 check (cols > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panel_arrays_customer_id_idx
  on public.panel_arrays(customer_id);

create table if not exists public.panels (
  id uuid primary key,
  array_id uuid not null references public.panel_arrays(id) on delete cascade,
  name text not null,
  esp32_id text not null default '',
  cell_rows integer not null default 3 check (cell_rows > 0),
  cell_cols integer not null default 4 check (cell_cols > 0),
  row_index integer not null default 0 check (row_index >= 0),
  col_index integer not null default 0 check (col_index >= 0),
  panel_width_mm integer check (panel_width_mm > 0),
  panel_height_mm integer check (panel_height_mm > 0),
  rated_voltage numeric check (rated_voltage > 0),
  rated_current numeric check (rated_current > 0),
  rated_power numeric check (rated_power > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panels_esp32_id_idx on public.panels(esp32_id);
create unique index if not exists panels_esp32_id_unique_idx
  on public.panels(esp32_id) where esp32_id <> '';
create index if not exists panels_array_id_idx on public.panels(array_id);

-- The backend uses SUPABASE_SERVICE_ROLE_KEY for server-side admin operations.
-- Keep RLS enabled for browser clients; service-role requests bypass it.
alter table public.customers enable row level security;
alter table public.panel_arrays enable row level security;
alter table public.panels enable row level security;

-- Keep `updated_at` accurate for edits made by the admin panel.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists panel_arrays_set_updated_at on public.panel_arrays;
create trigger panel_arrays_set_updated_at
before update on public.panel_arrays
for each row execute function public.set_updated_at();

drop trigger if exists panels_set_updated_at on public.panels;
create trigger panels_set_updated_at
before update on public.panels
for each row execute function public.set_updated_at();
