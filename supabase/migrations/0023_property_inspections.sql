-- Property listings use the existing photo-enabled catalogue, without a cart.
insert into store_categories(name,slug,description,icon,sort_order,features,attributes,workflow,is_active)
values ('House Agents & Realtors','house-agents-realtors','Houses, flats, land and commercial properties for rent or sale, with scheduled inspections.','building',15,
'{"catalogue":true,"cart":false,"stock":false,"delivery":false,"pickup":false,"appointments":true,"serviceBooking":true,"propertyListings":true,"reviews":true}'::jsonb,
'[{"key":"listing_type","label":"Listing type","type":"select","options":["For rent","For sale"],"required":true},{"key":"property_type","label":"Property type","type":"select","options":["Flat / apartment","House","Duplex","Self-contained","Land","Office","Shop / commercial","Warehouse"],"required":true},{"key":"property_location","label":"Property location, area and landmark","type":"text","required":true},{"key":"price_period","label":"Price basis","type":"select","options":["Per year","Per month","Per day","Total sale price"],"required":true},{"key":"inspection_fee","label":"Inspection fee (₦; enter 0 for free)","type":"number","required":true},{"key":"bedrooms","label":"Bedrooms (optional)","type":"number"},{"key":"bathrooms","label":"Bathrooms (optional)","type":"number"},{"key":"property_size","label":"Land / floor size (include units)","type":"text"},{"key":"additional_fees","label":"Other fees and terms (agency, legal, caution, etc.)","type":"textarea"}]'::jsonb,
'[]'::jsonb,true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,features=excluded.features,attributes=excluded.attributes,is_active=true;

create table if not exists property_inspection_slots (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references stores(id) on delete cascade,
 product_id uuid not null references products(id) on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 meeting_type text not null check(meeting_type in ('office','agreed_location')),
 meeting_point text not null check(length(meeting_point) between 5 and 500),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 check(ends_at > starts_at)
);
create index if not exists property_slots_store_time on property_inspection_slots(store_id,starts_at);
alter table property_inspection_slots enable row level security;
-- Managed only through ownership-checked trusted server code; no direct public access.
alter table service_bookings add column if not exists inspection_slot_id uuid references property_inspection_slots(id) on delete set null;
create unique index if not exists inspection_slot_one_customer on service_bookings(inspection_slot_id)
 where inspection_slot_id is not null and status <> 'cancelled';
