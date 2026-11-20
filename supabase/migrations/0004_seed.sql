-- ============================================================================
-- Ibom Vendors Hub — platform reference data (categories, plans, reserves)
-- Idempotent: safe to re-run on every deploy.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Reserved subdomains
-- ---------------------------------------------------------------------------
insert into reserved_subdomains (name, reason) values
  ('www','Root WWW host'), ('admin','Administration'), ('api','API surface'),
  ('app','Application'), ('support','Support desk'), ('mail','Email infrastructure'),
  ('payments','Payments'), ('marketplace','Marketplace'), ('vendor','Vendor area'),
  ('vendors','Vendor directory'), ('store','Storefront alias'), ('stores','Storefront alias'),
  ('dashboard','Dashboard'), ('auth','Authentication'), ('login','Authentication'),
  ('register','Registration'), ('track','Order tracking'), ('help','Help centre'),
  ('blog','Content'), ('docs','Documentation'), ('status','Status page')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Business categories + feature matrix
-- ---------------------------------------------------------------------------
insert into store_categories (slug, name, description, icon, sort_order, features, attributes, workflow) values
(
  'food-restaurants', 'Restaurants & Food',
  'Restaurants, caterers, bakeries and ready-to-eat food vendors with menus, preparation times and delivery.',
  'utensils', 1,
  '{"catalogue":true,"cart":true,"stock":true,"variants":false,"addons":true,"prepTime":true,
    "operatingHours":true,"delivery":true,"pickup":true,"appointments":false,"quotations":false,
    "productionTracking":false,"customMeasurements":false,"madeToOrder":false,"warranty":false,
    "reviews":true,"serviceBooking":false,"sizeGuide":false,"scheduleOrders":true,"minOrder":true}'::jsonb,
  '[{"key":"portion","label":"Portion size","type":"select","options":["Small","Medium","Large","Family"]},
    {"key":"spice","label":"Spice level","type":"select","options":["Mild","Medium","Hot"]},
    {"key":"dietary","label":"Dietary notes","type":"text"}]'::jsonb,
  '[{"key":"placed","label":"Order placed"},{"key":"payment_confirmed","label":"Payment confirmed"},
    {"key":"accepted","label":"Accepted by kitchen"},{"key":"preparing","label":"Preparing"},
    {"key":"ready_for_pickup","label":"Ready for pickup"},{"key":"dispatched","label":"Out for delivery"},
    {"key":"delivered","label":"Delivered"},{"key":"completed","label":"Completed"}]'::jsonb
),
(
  'fashion-clothing', 'Fashion & Clothing',
  'Boutiques, designers and tailors. Ready-made catalogues plus made-to-measure custom orders.',
  'shirt', 2,
  '{"catalogue":true,"cart":true,"stock":true,"variants":true,"addons":false,"prepTime":false,
    "operatingHours":true,"delivery":true,"pickup":true,"appointments":true,"quotations":true,
    "productionTracking":true,"customMeasurements":true,"madeToOrder":true,"warranty":false,
    "reviews":true,"serviceBooking":false,"sizeGuide":true,"scheduleOrders":false,"minOrder":false}'::jsonb,
  '[{"key":"size","label":"Size","type":"select","options":["XS","S","M","L","XL","XXL"]},
    {"key":"colour","label":"Colour","type":"text"},
    {"key":"material","label":"Material","type":"select","options":["Cotton","Silk","Linen","Ankara","Chiffon","Denim"]}]'::jsonb,
  '[{"key":"placed","label":"Order placed"},{"key":"payment_confirmed","label":"Payment confirmed"},
    {"key":"accepted","label":"Accepted by designer"},{"key":"in_production","label":"In production"},
    {"key":"production_completed","label":"Production completed"},{"key":"dispatched","label":"Dispatched"},
    {"key":"delivered","label":"Delivered"},{"key":"completed","label":"Completed"}]'::jsonb
),
(
  'shoes-footwear', 'Shoes & Footwear',
  'Shoemakers and cobblers manufacturing made-to-order footwear with full production tracking.',
  'footprints', 3,
  '{"catalogue":true,"cart":true,"stock":true,"variants":true,"addons":false,"prepTime":false,
    "operatingHours":true,"delivery":true,"pickup":true,"appointments":false,"quotations":true,
    "productionTracking":true,"customMeasurements":true,"madeToOrder":true,"warranty":false,
    "reviews":true,"serviceBooking":false,"sizeGuide":true,"scheduleOrders":false,"minOrder":false}'::jsonb,
  '[{"key":"size","label":"Shoe size","type":"select","options":["38","39","40","41","42","43","44","45","46"]},
    {"key":"colour","label":"Colour","type":"text"},
    {"key":"material","label":"Material","type":"select","options":["Leather","Suede","Canvas","Synthetic"]}]'::jsonb,
  '[{"key":"placed","label":"Order submitted"},{"key":"payment_confirmed","label":"Payment confirmed"},
    {"key":"accepted","label":"Accepted by maker"},{"key":"awaiting_production","label":"Awaiting production"},
    {"key":"in_production","label":"Production started"},{"key":"production_completed","label":"Production completed"},
    {"key":"ready_for_dispatch","label":"Ready for dispatch"},{"key":"dispatched","label":"Dispatched"},
    {"key":"delivered","label":"Delivered"},{"key":"completed","label":"Completed"}]'::jsonb
),
(
  'electronics-gadgets', 'Electronics & Gadgets',
  'Phones, computers, accessories and home electronics with specifications, stock and warranty details.',
  'cpu', 4,
  '{"catalogue":true,"cart":true,"stock":true,"variants":true,"addons":false,"prepTime":false,
    "operatingHours":true,"delivery":true,"pickup":true,"appointments":false,"quotations":false,
    "productionTracking":false,"customMeasurements":false,"madeToOrder":false,"warranty":true,
    "reviews":true,"serviceBooking":false,"sizeGuide":false,"scheduleOrders":false,"minOrder":false}'::jsonb,
  '[{"key":"brand","label":"Brand","type":"text"},{"key":"model","label":"Model","type":"text"},
    {"key":"condition","label":"Condition","type":"select","options":["New","Used","Refurbished"]},
    {"key":"warranty_months","label":"Warranty (months)","type":"number"}]'::jsonb,
  '[{"key":"placed","label":"Order placed"},{"key":"payment_confirmed","label":"Payment confirmed"},
    {"key":"accepted","label":"Accepted by vendor"},{"key":"preparing","label":"Packaging"},
    {"key":"dispatched","label":"Dispatched"},{"key":"delivered","label":"Delivered"},
    {"key":"completed","label":"Completed"}]'::jsonb
),
(
  'beauty-personal-care', 'Beauty & Personal Care',
  'Cosmetics, skincare, haircare, salons and spas with products plus appointment booking.',
  'sparkles', 5,
  '{"catalogue":true,"cart":true,"stock":true,"variants":true,"addons":false,"prepTime":false,
    "operatingHours":true,"delivery":true,"pickup":true,"appointments":true,"quotations":false,
    "productionTracking":false,"customMeasurements":false,"madeToOrder":false,"warranty":false,
    "reviews":true,"serviceBooking":true,"sizeGuide":false,"scheduleOrders":false,"minOrder":false}'::jsonb,
  '[{"key":"size","label":"Size","type":"select","options":["50ml","100ml","200ml","500ml"]},
    {"key":"skin_type","label":"Skin type","type":"select","options":["All","Oily","Dry","Combination","Sensitive"]}]'::jsonb,
  '[{"key":"placed","label":"Booking requested"},{"key":"payment_confirmed","label":"Payment confirmed"},
    {"key":"accepted","label":"Appointment confirmed"},{"key":"in_service","label":"Service in progress"},
    {"key":"completed","label":"Completed"}]'::jsonb
),
(
  'services-professionals', 'Services & Professionals',
  'Designers, photographers, developers, artisans, consultants and repair specialists. Quotations and bookings.',
  'briefcase', 6,
  '{"catalogue":true,"cart":false,"stock":false,"variants":false,"addons":false,"prepTime":false,
    "operatingHours":true,"delivery":false,"pickup":false,"appointments":true,"quotations":true,
    "productionTracking":true,"customMeasurements":false,"madeToOrder":false,"warranty":false,
    "reviews":true,"serviceBooking":true,"sizeGuide":false,"scheduleOrders":true,"minOrder":false}'::jsonb,
  '[{"key":"delivery_mode","label":"Delivery mode","type":"select","options":["Remote","On-site"]},
    {"key":"timeline","label":"Preferred timeline","type":"text"}]'::jsonb,
  '[{"key":"placed","label":"Request received"},{"key":"payment_confirmed","label":"Payment confirmed"},
    {"key":"accepted","label":"Accepted by professional"},{"key":"in_service","label":"Work in progress"},
    {"key":"completed","label":"Completed"}]'::jsonb
),
(
  'general-retail', 'General Retail',
  'Groceries, furniture, appliances, building materials, books, gifts and every other retail business.',
  'shopping-bag', 7,
  '{"catalogue":true,"cart":true,"stock":true,"variants":true,"addons":false,"prepTime":false,
    "operatingHours":true,"delivery":true,"pickup":true,"appointments":false,"quotations":false,
    "productionTracking":false,"customMeasurements":false,"madeToOrder":false,"warranty":false,
    "reviews":true,"serviceBooking":false,"sizeGuide":false,"scheduleOrders":false,"minOrder":false}'::jsonb,
  '[{"key":"brand","label":"Brand","type":"text"},{"key":"size","label":"Size","type":"text"}]'::jsonb,
  '[{"key":"placed","label":"Order placed"},{"key":"payment_confirmed","label":"Payment confirmed"},
    {"key":"accepted","label":"Accepted by vendor"},{"key":"preparing","label":"Preparing"},
    {"key":"dispatched","label":"Dispatched"},{"key":"delivered","label":"Delivered"},
    {"key":"completed","label":"Completed"}]'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  features = excluded.features,
  attributes = excluded.attributes,
  workflow = excluded.workflow;

-- ---------------------------------------------------------------------------
-- Subscription plans
-- ---------------------------------------------------------------------------
insert into subscription_plans (name, slug, description, price, interval_months, duration_days, trial_days, product_limit, order_limit, features, is_featured, sort_order) values
  ('Starter', 'starter', 'Get your business online with a full storefront and up to 25 products.', 0, 0, 14, 14, 25, 100,
    '["Storefront on your own subdomain","25 products","Order management","Email notifications","Basic analytics"]'::jsonb, false, 1),
  ('Growth', 'growth', 'For growing businesses that need more catalogue space and priority support.', 7500, 1, 30, 0, 250, null,
    '["Everything in Starter","250 products","Custom domain requests","Quotation workflows","Priority support"]'::jsonb, true, 2),
  ('Business', 'business', 'A full quarter of unlimited selling with production tracking and analytics.', 18000, 3, 90, 0, null, null,
    '["Everything in Growth","Unlimited products","Production tracking","Advanced analytics","Dedicated support"]'::jsonb, false, 3),
  ('Annual', 'annual', 'Best value: a full year on the platform, two months free.', 60000, 12, 365, 0, null, null,
    '["Everything in Business","12 months access","2 months free","Featured store eligibility"]'::jsonb, false, 4)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, price = excluded.price,
  duration_days = excluded.duration_days, trial_days = excluded.trial_days,
  product_limit = excluded.product_limit, features = excluded.features,
  is_featured = excluded.is_featured, sort_order = excluded.sort_order;

commit;
