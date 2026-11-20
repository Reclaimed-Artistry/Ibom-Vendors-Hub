-- 0016_customer_wallet.sql
-- Customer wallet: registered customers can top up a prepaid wallet and use
-- the balance to pay for orders at checkout alongside (or instead of) Paystack.

-- Wallets ---------------------------------------------------------------
create table if not exists wallets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references users(id) on delete cascade,
  balance    numeric(14,2) not null default 0 check (balance >= 0),
  currency   text not null default 'NGN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallets_user_idx on wallets (user_id);

drop trigger if exists wallets_set_updated_at on wallets;
create trigger wallets_set_updated_at before update on wallets
for each row execute function set_updated_at();

-- Wallet transactions ----------------------------------------------------
create table if not exists wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  wallet_id   uuid not null references wallets(id) on delete cascade,
  type        text not null check (type in ('credit','debit')),
  amount      numeric(14,2) not null check (amount > 0),
  reference   text not null unique,
  description text,
  status      text not null default 'success'
              check (status in ('pending','success','failed')),
  created_at  timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_idx on wallet_transactions (wallet_id, created_at desc);
create index if not exists wallet_transactions_ref_idx on wallet_transactions (reference);

drop trigger if exists wallet_transactions_set_updated_at on wallet_transactions;
create trigger wallet_transactions_set_updated_at before update on wallet_transactions
for each row execute function set_updated_at();

-- Allow wallet top-ups as a payment scope --------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'payments_scope_check' and conrelid = 'payments'::regclass
  ) then
    alter table payments
      add constraint payments_scope_check
      check (scope in ('order','subscription','wallet'));
  else
    alter table payments
      drop constraint payments_scope_check;
    alter table payments
      add constraint payments_scope_check
      check (scope in ('order','subscription','wallet'));
  end if;
end $$;

-- Row level security & grants -------------------------------------------
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;

drop policy if exists wallets_select_self_or_admin on wallets;
create policy wallets_select_self_or_admin on wallets for select to app_runtime
  using (user_id = app_current_user_id() or app_is_admin());

drop policy if exists wallets_write_self_or_admin on wallets;
create policy wallets_write_self_or_admin on wallets for all to app_runtime
  using (user_id = app_current_user_id() or app_is_admin())
  with check (user_id = app_current_user_id() or app_is_admin());

drop policy if exists wallet_transactions_select_self_or_admin on wallet_transactions;
create policy wallet_transactions_select_self_or_admin on wallet_transactions for select to app_runtime
  using (
    exists (
      select 1 from wallets w where w.id = wallet_transactions.wallet_id
        and (w.user_id = app_current_user_id() or app_is_admin())
    )
  );

drop policy if exists wallet_transactions_insert_system on wallet_transactions;
create policy wallet_transactions_insert_system on wallet_transactions for insert to app_runtime
  with check (true);

grant select, insert, update, delete on wallets to app_runtime;
grant select, insert, update, delete on wallet_transactions to app_runtime;
