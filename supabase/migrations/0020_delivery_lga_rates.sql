-- delivery_fee remains the within-LGA rate, preserving existing integrations.
alter table stores add column if not exists delivery_fee_outside numeric(12,2) check (delivery_fee_outside between 0 and 1000000);
alter table products add column if not exists delivery_fee_outside numeric(12,2) check (delivery_fee_outside between 0 and 1000000);
-- Existing flat rates continue to apply in both zones until vendors change them.
update stores set delivery_fee_outside = delivery_fee where delivery_fee_outside is null;
update products set delivery_fee_outside = delivery_fee where delivery_fee_outside is null;
