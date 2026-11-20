-- Wallet checkout is a real internal provider, not a gateway top-up.
alter table payments drop constraint if exists payments_provider_check;
alter table payments add constraint payments_provider_check check (provider in ('paystack','flutterwave','manual','sandbox','wallet'));
