-- 0014_nigerian_artisan_categories_and_bookings.sql
-- 1. Add structured `booking_details` JSONB column on `service_bookings` to store trade-specific
--    booking requirements (visit type, materials arrangement, site power/water, dimensions, equipment/faults).
-- 2. Seed comprehensive Nigerian Artisan categories covering every artisan trade in Nigeria with
--    tailored storefront features, product/service attributes, and fulfilment workflows.

alter table service_bookings
  add column if not exists booking_details jsonb not null default '{}'::jsonb;

-- Refine Services & Professionals so dedicated Artisan categories stand out clearly
update store_categories
   set description = 'Photographers, videographers, graphic & web designers, software developers, event planners, tutors and business consultants.',
       sort_order = 13
 where slug = 'services-professionals';

update store_categories
   set sort_order = 14
 where slug = 'general-retail';

insert into store_categories (name, slug, description, icon, sort_order, features, attributes, workflow, is_active)
values
  (
    'Carpentry, Woodwork & Furniture',
    'artisans-carpentry-woodwork',
    'Carpenters, woodworkers, furniture & cabinet makers, wardrobe/kitchen installers, upholsterers, door/frame fitters and roofing carpenters.',
    'hammer',
    6,
    '{
      "catalogue": true, "cart": true, "stock": false, "variants": true, "addons": true,
      "prepTime": false, "operatingHours": true, "delivery": true, "pickup": true,
      "appointments": true, "quotations": true, "productionTracking": true,
      "customMeasurements": true, "madeToOrder": true, "warranty": true,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "trade_specialty", "type": "select", "label": "Artisan specialty", "options": ["Custom Furniture Making", "Wardrobes & Kitchen Cabinets", "Doors, Frames & Skirting", "Roofing Carpentry", "Upholstery & Sofa Refurbishing", "General Woodwork & Repairs"]},
      {"key": "wood_type", "type": "select", "label": "Primary wood / board", "options": ["Mahogany / Hardwood", "Teak / Obeche", "HDF / MDF / MFC Board", "Pine / Treated Timber", "Client-Supplied Timber"]},
      {"key": "service_mode", "type": "select", "label": "Service delivery mode", "options": ["Workshop Fabrication + Site Installation", "On-Site Carpentry & Repairs", "Site Measurement & Quotation First"]}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Booking / order received"},
      {"key": "payment_confirmed", "label": "Escrow payment confirmed"},
      {"key": "accepted", "label": "Dimensions & wood confirmed"},
      {"key": "in_production", "label": "Workshop fabrication in progress"},
      {"key": "production_completed", "label": "Fabrication & finishing completed"},
      {"key": "dispatched", "label": "En route for delivery / fitting"},
      {"key": "delivered", "label": "Installed / delivered on site"},
      {"key": "completed", "label": "Completed"}
    ]'::jsonb,
    true
  ),
  (
    'Electricians, Solar & Generators',
    'artisans-electrical-solar',
    'Domestic & industrial electricians, conduit/surface house wiring, solar panel & inverter installers, generator mechanics and CCTV technicians.',
    'zap',
    7,
    '{
      "catalogue": true, "cart": false, "stock": false, "variants": false, "addons": false,
      "prepTime": false, "operatingHours": true, "delivery": false, "pickup": false,
      "appointments": true, "quotations": true, "productionTracking": true,
      "customMeasurements": false, "madeToOrder": false, "warranty": true,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "trade_specialty", "type": "select", "label": "Electrical / power specialty", "options": ["Conduit & Surface House Wiring", "Electrical Fault Tracing & Repairs", "Solar Panel & Inverter Installation", "Generator Servicing & Overhaul (Petrol/Diesel)", "CCTV, Intercom & Smart Security", "Earthing, Thunder Arrestor & Changeover"]},
      {"key": "power_phase", "type": "select", "label": "System / phase supported", "options": ["Single Phase & Three Phase", "Single Phase Domestic", "Solar / Hybrid Inverter Systems", "Industrial / 3-Phase"]},
      {"key": "materials_policy", "type": "select", "label": "Materials arrangement", "options": ["Labour Only or Full Material + Labour", "Labour Only (Client Buys Cables/Fittings)", "Site Inspection & Bill of Quantities First"]}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Call-out / request received"},
      {"key": "payment_confirmed", "label": "Payment confirmed"},
      {"key": "accepted", "label": "Inspection / schedule confirmed"},
      {"key": "in_service", "label": "Electrical / solar work in progress"},
      {"key": "completed", "label": "Tested & completed"}
    ]'::jsonb,
    true
  ),
  (
    'Plumbers, Borehole & Water Techs',
    'artisans-plumbing-water',
    'Plumbers, pipefitters, WC & water-heater installers, leak/blockage specialists, borehole drillers, pumping-machine & tank treatment technicians.',
    'droplets',
    8,
    '{
      "catalogue": true, "cart": false, "stock": false, "variants": false, "addons": false,
      "prepTime": false, "operatingHours": true, "delivery": false, "pickup": false,
      "appointments": true, "quotations": true, "productionTracking": true,
      "customMeasurements": false, "madeToOrder": false, "warranty": true,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "trade_specialty", "type": "select", "label": "Plumbing / water specialty", "options": ["Building Piping & Sanitary Ware (WC/Basin)", "Leak Detection & Blocked Drain Repair", "Water Heater, Shower & Pressure Pump", "Borehole Drilling, Flashing & Submersible Pump", "Overhead Tank, Scaffolding & Water Treatment"]},
      {"key": "urgency_supported", "type": "select", "label": "Call-out availability", "options": ["Emergency Same-Day & Scheduled Visits", "Scheduled Appointments Only"]},
      {"key": "materials_policy", "type": "select", "label": "Pipes & fittings policy", "options": ["Labour Only or Full Material + Labour", "Labour Only (Client Supplies Fittings)", "Site Inspection & Quotation First"]}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Booking / request received"},
      {"key": "payment_confirmed", "label": "Payment confirmed"},
      {"key": "accepted", "label": "Plumber assigned & scheduled"},
      {"key": "in_service", "label": "Plumbing / water work in progress"},
      {"key": "completed", "label": "Pressure-tested & completed"}
    ]'::jsonb,
    true
  ),
  (
    'POP Ceiling, Painters & Tilers',
    'artisans-pop-painting-finishing',
    'POP ceiling & cornice installers, wall screeders, house & satin/texcote painters, floor/wall tilers, stamped-concrete & wallpaper finishers.',
    'paintbrush',
    9,
    '{
      "catalogue": true, "cart": false, "stock": false, "variants": true, "addons": false,
      "prepTime": false, "operatingHours": true, "delivery": false, "pickup": false,
      "appointments": true, "quotations": true, "productionTracking": true,
      "customMeasurements": true, "madeToOrder": true, "warranty": true,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "trade_specialty", "type": "select", "label": "Interior / finishing trade", "options": ["POP Ceiling, TV Console & Cornices", "Wall Screeding & House Painting", "Floor, Bathroom & Wall Tiling", "Stamped Concrete & Interlocking Paving", "Wallpaper, 3D Panels & Window Blinds"]},
      {"key": "pricing_basis", "type": "select", "label": "Typical pricing basis", "options": ["Per Square Metre (sqm)", "Per Room / Flat", "Site Measurement & Written Quotation"]},
      {"key": "materials_policy", "type": "select", "label": "Materials arrangement", "options": ["Labour Only or Material + Labour", "Labour Only (Client Buys POP/Paint/Tiles)", "Full Material + Labour Turnkey"]}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Measurement / booking requested"},
      {"key": "payment_confirmed", "label": "Escrow payment confirmed"},
      {"key": "accepted", "label": "Site dimensions & schedule confirmed"},
      {"key": "in_production", "label": "On-site installation / finishing"},
      {"key": "production_completed", "label": "Finishing & site cleanup done"},
      {"key": "completed", "label": "Inspected & completed"}
    ]'::jsonb,
    true
  ),
  (
    'Bricklayers, Welders, Aluminium & Roofers',
    'artisans-masonry-welding-construction',
    'Bricklayers/masons, plasterers, iron benders, welders (gates, burglary-proof, carports), aluminium window/glass fabricators and roofers.',
    'hard-hat',
    10,
    '{
      "catalogue": true, "cart": false, "stock": false, "variants": true, "addons": false,
      "prepTime": false, "operatingHours": true, "delivery": true, "pickup": false,
      "appointments": true, "quotations": true, "productionTracking": true,
      "customMeasurements": true, "madeToOrder": true, "warranty": true,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "trade_specialty", "type": "select", "label": "Construction / metal trade", "options": ["Welding — Gates, Railings & Burglary Proof", "Aluminium Casement Windows, Doors & Partitions", "Bricklaying, Blockwork, Plastering & Fencing", "Stone-Coated & Long-Span Aluminium Roofing", "Iron Bending & Structural Steelwork"]},
      {"key": "service_mode", "type": "select", "label": "Work execution mode", "options": ["Workshop Fabrication + On-Site Installation", "Full On-Site Construction", "Site Measurement & BOQ First"]},
      {"key": "materials_policy", "type": "select", "label": "Materials arrangement", "options": ["Material + Fabrication + Installation", "Labour / Workmanship Only", "Both Options Available"]}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Site visit / order requested"},
      {"key": "payment_confirmed", "label": "Escrow payment confirmed"},
      {"key": "accepted", "label": "Measurements & scope confirmed"},
      {"key": "in_production", "label": "Fabrication / construction in progress"},
      {"key": "production_completed", "label": "Site installation completed"},
      {"key": "completed", "label": "Signed off & completed"}
    ]'::jsonb,
    true
  ),
  (
    'AC/Fridge, Auto Mechanics & Vulcanizers',
    'artisans-ac-auto-mechanical',
    'Air-conditioner & fridge/freezer technicians, auto mechanics, auto electricians (rewires), panel beaters, car sprayers and vulcanizers.',
    'wrench',
    11,
    '{
      "catalogue": true, "cart": false, "stock": false, "variants": false, "addons": true,
      "prepTime": false, "operatingHours": true, "delivery": false, "pickup": false,
      "appointments": true, "quotations": true, "productionTracking": true,
      "customMeasurements": false, "madeToOrder": false, "warranty": true,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "trade_specialty", "type": "select", "label": "Mechanical / cooling trade", "options": ["AC Installation, Servicing & Gas Charging", "Refrigerator, Freezer & Cold-Room Repair", "Auto Mechanic & Engine Diagnostics", "Auto Electrician (Rewire) & Car AC", "Panel Beating & Oven-Bake Painting", "Mobile Vulcanizer & Wheel Balancing"]},
      {"key": "service_location", "type": "select", "label": "Where service is rendered", "options": ["Home / Office / Roadside Call-Out & Workshop", "Home / Office Call-Out Only", "Workshop Drop-Off Only"]}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Booking / call-out requested"},
      {"key": "payment_confirmed", "label": "Payment confirmed"},
      {"key": "accepted", "label": "Technician confirmed"},
      {"key": "in_service", "label": "Diagnostics & repair in progress"},
      {"key": "completed", "label": "Tested & completed"}
    ]'::jsonb,
    true
  ),
  (
    'Cleaning, Laundry, Fumigation & Cobblers',
    'artisans-home-domestic-trades',
    'Laundry & dry cleaners, fumigators, post-construction & home cleaners, cobblers/leather repairers, gardeners/landscapers and locksmiths.',
    'scissors',
    12,
    '{
      "catalogue": true, "cart": true, "stock": false, "variants": true, "addons": true,
      "prepTime": false, "operatingHours": true, "delivery": true, "pickup": true,
      "appointments": true, "quotations": true, "productionTracking": false,
      "customMeasurements": false, "madeToOrder": false, "warranty": false,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "trade_specialty", "type": "select", "label": "Domestic / repair specialty", "options": ["Laundry, Dry Cleaning & Ironing", "Fumigation & Pest Control", "Post-Construction, Sofa & Deep Cleaning", "Cobbler — Shoe, Bag & Leather Repair", "Gardening, Lawn Care & Landscaping", "Locksmith, Door Locks & Key Cutting", "Signwriting, Glass & Glazing"]},
      {"key": "service_mode", "type": "select", "label": "Pickup / visit mode", "options": ["On-Site Home / Office Service", "Pickup & Return Delivery", "Shop Drop-Off or Home Visit"]}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Booking / order received"},
      {"key": "payment_confirmed", "label": "Payment confirmed"},
      {"key": "accepted", "label": "Schedule / pickup confirmed"},
      {"key": "in_service", "label": "Service in progress"},
      {"key": "completed", "label": "Completed"}
    ]'::jsonb,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  features = excluded.features,
  attributes = excluded.attributes,
  workflow = excluded.workflow,
  is_active = excluded.is_active;
