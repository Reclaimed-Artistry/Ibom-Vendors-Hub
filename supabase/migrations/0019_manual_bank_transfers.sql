-- Receipt bytes are private database data, never public storage URLs.
create table if not exists manual_order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  payment_id uuid not null references payments(id),
  customer_id uuid not null references users(id),
  store_id uuid not null references stores(id),
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'awaiting_transfer' check (status in ('awaiting_transfer','awaiting_approval','approved','rejected')),
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  receipt_data text,
  receipt_type text check (receipt_type in ('image/png','image/jpeg','application/pdf')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references users(id),
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists manual_order_payments_review_idx on manual_order_payments(store_id, status);
alter table manual_order_payments enable row level security;
-- Access is through authenticated, ownership-checked server actions and receipt route only.
revoke all on manual_order_payments from public, app_runtime;
