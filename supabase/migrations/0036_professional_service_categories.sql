-- ============================================================================
-- Ibom Vendors Hub — Professional service categories
-- ============================================================================
-- Migration 0036: idempotent, applied on every deploy via vercel-build
-- ============================================================================

-- Security services, private tutoring and counselling/guidance are added as
-- distinct marketplace categories under professional services. Vendors in
-- these categories list services (hourly/session-based pricing) rather than
-- shippable products, and customers book appointments / request quotations.

insert into store_categories (name, slug, description, icon, sort_order, features, attributes, workflow, is_active)
values
  (
    'Security Service',
    'security-service',
    'Licensed security guards, private security firms, event security, personal protection and property guarding services. Book by shift or contract.',
    'shield',
    26,
    '{
      "catalogue": true, "cart": false, "stock": false, "variants": false, "addons": false,
      "prepTime": false, "operatingHours": true, "delivery": false, "pickup": false,
      "appointments": true, "quotations": true, "productionTracking": false,
      "customMeasurements": false, "madeToOrder": false, "warranty": false,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "security_license", "type": "text", "label": "Security company / guard licence number", "required": true},
      {"key": "service_type", "type": "select", "label": "Type of security service", "options": ["Static Guarding", "Mobile Patrol", "Event Security", "Personal Protection / Bodyguard", "CCTV Monitoring", "Cash-in-Transit"], "required": true},
      {"key": "years_experience", "type": "number", "label": "Years of experience", "required": true},
      {"key": "armed_or_unarmed", "type": "select", "label": "Armed or unarmed", "options": ["Unarmed", "Armed (licensed)"], "required": true},
      {"key": "guards_available", "type": "number", "label": "Number of guards available", "required": true},
      {"key": "patrol_areas", "type": "text", "label": "Areas covered / patrol locations", "required": true}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Security request received"},
      {"key": "payment_confirmed", "label": "Payment / deposit confirmed"},
      {"key": "accepted", "label": "Deployment plan accepted"},
      {"key": "in_service", "label": "Security personnel on site"},
      {"key": "completed", "label": "Assignment completed"}
    ]'::jsonb,
    true
  ),
  (
    'Private Tutor',
    'private-tutor',
    'Private tutors for school subjects, exam preparation, language lessons, music and vocational skills. Lessons can be online or at the student/tutor location.',
    'graduation-cap',
    27,
    '{
      "catalogue": true, "cart": false, "stock": false, "variants": false, "addons": false,
      "prepTime": false, "operatingHours": true, "delivery": false, "pickup": false,
      "appointments": true, "quotations": true, "productionTracking": false,
      "customMeasurements": false, "madeToOrder": false, "warranty": false,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "subjects_taught", "type": "text", "label": "Subjects taught", "required": true},
      {"key": "grade_levels", "type": "select", "label": "Student grade level", "options": ["Nursery / Early Years", "Primary (Basic 1-6)", "Secondary (JSS 1-3)", "Senior Secondary (SS 1-3)", "University / Tertiary", "Adult Learners"], "required": true},
      {"key": "teaching_mode", "type": "select", "label": "Lesson delivery mode", "options": ["Online only", "In-person only", "Both online and in-person"], "required": true},
      {"key": "qualification", "type": "text", "label": "Academic / professional qualification", "required": true},
      {"key": "years_teaching", "type": "number", "label": "Years of teaching experience", "required": true},
      {"key": "lesson_location", "type": "select", "label": "Where lessons hold", "options": ["Tutor\u2019s home / studio", "Student\u2019s home", "Public location (library, school)", "Online (Zoom / Google Meet)"], "required": true}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Tutoring request received"},
      {"key": "payment_confirmed", "label": "Tuition fee paid"},
      {"key": "accepted", "label": "Lesson schedule accepted"},
      {"key": "in_service", "label": "Lessons in progress"},
      {"key": "completed", "label": "Tutoring completed"}
    ]'::jsonb,
    true
  ),
  (
    'Counseling & Guidance',
    'counseling-guidance',
    'Professional counsellors, career guidance coaches, marriage and family therapists, mental health and wellbeing advisors. Session-based appointments, online or in-person.',
    'headphones',
    28,
    '{
      "catalogue": true, "cart": false, "stock": false, "variants": false, "addons": false,
      "prepTime": false, "operatingHours": true, "delivery": false, "pickup": false,
      "appointments": true, "quotations": true, "productionTracking": false,
      "customMeasurements": false, "madeToOrder": false, "warranty": false,
      "reviews": true, "serviceBooking": true, "sizeGuide": false,
      "scheduleOrders": true, "minOrder": false
    }'::jsonb,
    '[
      {"key": "specialization", "type": "select", "label": "Counselling specialization", "options": ["Career Guidance", "Marriage & Family Therapy", "Mental Health & Wellness", "Academic Counselling", "Trauma & Grief Counselling", "Addiction Counselling", "Business & Leadership Coaching"], "required": true},
      {"key": "certification", "type": "text", "label": "Professional certification / licence", "required": true},
      {"key": "years_practice", "type": "number", "label": "Years in practice", "required": true},
      {"key": "session_type", "type": "select", "label": "Session format", "options": ["In-person", "Online video call", "Phone call", "Both in-person and online"], "required": true},
      {"key": "session_duration", "type": "select", "label": "Standard session duration", "options": ["30 minutes", "45 minutes", "60 minutes", "90 minutes"], "required": true}
    ]'::jsonb,
    '[
      {"key": "placed", "label": "Counselling request received"},
      {"key": "payment_confirmed", "label": "Session fee paid"},
      {"key": "accepted", "label": "Appointment accepted"},
      {"key": "in_service", "label": "Session in progress"},
      {"key": "completed", "label": "Session completed"}
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
