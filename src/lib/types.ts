export type UserRole = "super_admin" | "admin" | "vendor" | "customer";

export interface VendorProfile {
  user_id: string;
  position: string | null;
  bio: string | null;
  nin: string | null;
  proof_of_residence_url: string | null;
  proof_of_residence_type: string | null;
  cac_registered: boolean;
  cac_number: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  kyc_status: "pending" | "submitted" | "verified" | "rejected";
  kyc_note: string | null;
  verified_at: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string | null;
  emailVerified: boolean;
  status: "active" | "suspended" | "deleted";
}

export interface PlatformSettings {
  id: number;
  platform_name: string;
  tagline: string;
  logo_url: string | null;
  main_domain: string;
  support_email: string;
  support_phone: string;
  currency: string;
  currency_symbol: string;
  country: string;
  default_trial_days: number;
  grace_period_days: number;
  commission_rate: number;
  require_vendor_approval: boolean;
  payments_enabled: boolean;
  sandbox_payments: boolean;
  paystack_public_key: string | null;
  paystack_secret_key: string | null;
  google_client_id: string | null;
  google_client_secret: string | null;
  google_signin_enabled: boolean;
  email_from: string | null;
  expiry_reminder_days: number[];
  terms_markdown: string | null;
  privacy_markdown: string | null;
  social: Record<string, string>;
  maintenance_mode: boolean;
}

export interface CategoryFeatures {
  inquiryOnly?: boolean;
  propertyListings?: boolean;
  catalogue?: boolean;
  cart?: boolean;
  stock?: boolean;
  variants?: boolean;
  addons?: boolean;
  prepTime?: boolean;
  operatingHours?: boolean;
  delivery?: boolean;
  pickup?: boolean;
  appointments?: boolean;
  quotations?: boolean;
  productionTracking?: boolean;
  customMeasurements?: boolean;
  madeToOrder?: boolean;
  warranty?: boolean;
  reviews?: boolean;
  serviceBooking?: boolean;
  sizeGuide?: boolean;
  scheduleOrders?: boolean;
  minOrder?: boolean;
}

export interface CategoryAttribute {
  key: string;
  label: string;
  type: "text" | "select" | "number" | "boolean" | "textarea";
  options?: string[];
  required?: boolean;
}

export interface WorkflowStage {
  key: string;
  label: string;
  description?: string;
}

export interface StoreCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  features: CategoryFeatures;
  attributes: CategoryAttribute[];
  workflow: WorkflowStage[];
  sort_order: number;
  is_active: boolean;
}

export interface Store {
  id: string;
  owner_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  status: "pending" | "active" | "suspended" | "expired" | "rejected";
  visibility: "public" | "unlisted";
  manual_suspension: boolean;
  suspension_reason: string | null;
  rejection_reason?: string | null;
  review_deadline_at?: string | null;
  access_until: string | null;
  operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
  accepts_orders: boolean;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  delivery_fee: number;
  delivery_fee_outside?: number | null;
  minimum_order: number;
  delivery_areas: string | null;
  prep_time_minutes: number;
  commission_rate?: number | null;
  rating_avg: number;
  rating_count: number;
  is_featured: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  category?: StoreCategory | null;
}

export interface ProductImage {
  id?: string;
  url: string;
  alt?: string | null;
  sort_order?: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  attributes: Record<string, string>;
  price: number | null;
  stock_quantity: number;
  is_available: boolean;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  sku: string | null;
  kind: "product" | "service";
  description: string | null;
  short_description: string | null;
  price: number;
  delivery_fee: number | null;
  delivery_fee_outside?: number | null;
  compare_at_price: number | null;
  currency: string;
  pricing_type: "fixed" | "from" | "quotation";
  track_stock: boolean;
  stock_quantity: number;
  is_available: boolean;
  is_featured: boolean;
  condition: "new" | "used" | "refurbished" | null;
  brand: string | null;
  model: string | null;
  warranty_info: string | null;
  warranty_months: number | null;
  specifications: Record<string, string>;
  attributes: Record<string, string>;
  made_to_order: boolean;
  production_days: number | null;
  prep_time_minutes: number | null;
  portion: string | null;
  service_duration_minutes: number | null;
  size_guide: Array<{ label: string; value: string }>;
  tags: string[];
  rating_avg: number;
  rating_count: number;
  sales_count: number;
  created_at: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  addons?: Array<{ id: string; name: string; price: number; is_available: boolean }>;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  kind: "product" | "service";
  name: string;
  variant_name: string | null;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  attributes: Record<string, string>;
  addons: Array<{ name: string; price: number }>;
  measurements: Record<string, string>;
  reference_images: string[];
  notes: string | null;
  duration_minutes: number | null;
}

export interface Order {
  id: string;
  reference: string;
  checkout_reference: string;
  store_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  payment_status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  fulfilment_type: "delivery" | "pickup" | "service" | "booking";
  currency: string;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  discount: number;
  total: number;
  amount_paid: number;
  platform_commission: number;
  vendor_payable: number;
  delivery_address: Record<string, string>;
  delivery_notes: string | null;
  customer_notes: string | null;
  scheduled_for: string | null;
  fulfilment_expected_at: string | null;
  fulfilment_timing_note: string | null;
  estimated_completion_date: string | null;
  estimated_dispatch_date: string | null;
  estimated_delivery_date: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  production_started_at: string | null;
  production_completed_at: string | null;
  ready_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  production_progress: number;
  tracking_number: string | null;
  tracking_carrier: string | null;
  delivery_pin?: string;
  delivery_confirmed_at: string | null;
  delivery_confirmed_by: "pin" | "customer" | "admin" | null;
  dispatch_rider_name: string | null;
  dispatch_rider_phone: string | null;
  pickup_location: string | null;
  payout_released: boolean;
  dispute_status: "none" | "open" | "resolved" | "refunded";
  dispute_reason: string | null;
  stock_committed: boolean;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  history?: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    note: string | null;
    actor_role: string;
    created_at: string;
  }>;
  store?: { id: string; name: string; slug: string; logo_url: string | null; phone: string | null };
}

export interface Subscription {
  id: string;
  store_id: string;
  plan_id: string;
  status: "trialing" | "active" | "expired" | "cancelled" | "pending";
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  plan_name?: string;
  plan_price?: number;
  plan_features?: string[];
  duration_days?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
