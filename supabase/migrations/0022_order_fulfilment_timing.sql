alter table orders add column if not exists fulfilment_expected_at timestamptz;
alter table orders add column if not exists fulfilment_timing_note text;
