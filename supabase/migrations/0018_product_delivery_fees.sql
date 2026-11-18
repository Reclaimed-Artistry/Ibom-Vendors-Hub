-- NULL preserves the existing store-level fee; zero explicitly means free delivery.
alter table products add column if not exists delivery_fee numeric(12,2)
  check (delivery_fee >= 0 and delivery_fee <= 1000000);
