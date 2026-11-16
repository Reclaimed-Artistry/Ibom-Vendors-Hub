/**
 * Demo seed for Ibom Vendors Hub.
 *
 * Creates a super administrator, seven vendors across six business categories
 * (including one expired store to demonstrate automatic suspension), catalogue
 * data, customers, orders in different fulfilment stages, payments and reviews.
 *
 *   npm run db:seed          # seed if empty
 *   npm run db:seed -- --reset   # wipe demo data and reseed
 */
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { ensureSeedImages } from "./make-images";

const url = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres";

const client = new Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function q<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const res = await client.query(text, params);
  return res.rows as T[];
}
async function one<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const rows = await q<T>(text, params);
  if (!rows[0]) throw new Error(`No row returned for: ${text.slice(0, 80)}`);
  return rows[0];
}

const IMG = "/images/seed";

interface VariantSeed {
  name: string;
  price?: number;
  stock?: number;
  attributes: Record<string, string>;
}
interface AddonSeed {
  name: string;
  price: number;
}
interface ProductSeed {
  name: string;
  slug: string;
  price: number;
  compareAt?: number;
  description: string;
  image: string;
  kind?: "product" | "service";
  category: string;
  trackStock?: boolean;
  stock?: number;
  madeToOrder?: boolean;
  productionDays?: number;
  prepTime?: number;
  portion?: string;
  serviceDuration?: number;
  pricingType?: "fixed" | "from" | "quotation";
  condition?: "new" | "used" | "refurbished";
  brand?: string;
  warrantyInfo?: string;
  warrantyMonths?: number;
  specifications?: Record<string, string>;
  attributes?: Record<string, string>;
  variants?: VariantSeed[];
  addons?: AddonSeed[];
  featured?: boolean;
  tags?: string[];
}

interface VendorSeed {
  storeName: string;
  slug: string;
  category: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  address: string;
  tagline: string;
  description: string;
  plan: string;
  subscriptionDays: number;
  deliveryFee: number;
  minimumOrder: number;
  prepTime: number;
  featured?: boolean;
  operatingHours?: Record<string, { open: string; close: string; closed: boolean }>;
  productCategories: string[];
  products: ProductSeed[];
}

const HOURS_FOOD = {
  mon: { open: "08:00", close: "20:00", closed: false },
  tue: { open: "08:00", close: "20:00", closed: false },
  wed: { open: "08:00", close: "20:00", closed: false },
  thu: { open: "08:00", close: "20:00", closed: false },
  fri: { open: "08:00", close: "21:00", closed: false },
  sat: { open: "09:00", close: "21:00", closed: false },
  sun: { open: "10:00", close: "18:00", closed: true },
};
const HOURS_WEEKDAY = {
  mon: { open: "09:00", close: "18:00", closed: false },
  tue: { open: "09:00", close: "18:00", closed: false },
  wed: { open: "09:00", close: "18:00", closed: false },
  thu: { open: "09:00", close: "18:00", closed: false },
  fri: { open: "09:00", close: "18:00", closed: false },
  sat: { open: "10:00", close: "16:00", closed: false },
  sun: { open: "10:00", close: "16:00", closed: true },
};

const vendors: VendorSeed[] = [
  {
    storeName: "Mama Put Kitchen",
    slug: "mamaput-kitchen",
    category: "food-restaurants",
    ownerName: "Grace Etim",
    email: "grace@mamaput.test",
    phone: "08031234501",
    city: "Uyo",
    state: "Akwa Ibom",
    address: "12 Aba Road, Uyo",
    tagline: "Home-style Akwa Ibom cooking, delivered hot",
    description:
      "Mama Put Kitchen has been feeding Uyo since 2014. We cook fresh jollof, native soups and small chops every morning using ingredients from Itam market. Order for pickup or let us deliver across Uyo within 45 minutes.",
    plan: "growth",
    subscriptionDays: 30,
    deliveryFee: 1200,
    minimumOrder: 2500,
    prepTime: 25,
    featured: true,
    operatingHours: HOURS_FOOD,
    productCategories: ["Rice Dishes", "Native Soups", "Small Chops"],
    products: [
      {
        name: "Jollof Rice Party Pack",
        slug: "jollof-rice-party-pack",
        price: 4500,
        compareAt: 5000,
        description:
          "Smoky party jollof rice cooked in firewood pots, served with fried plantain and your choice of protein. Feeds one very hungry person or two light eaters.",
        image: "jollof",
        category: "Rice Dishes",
        prepTime: 25,
        portion: "Party pack",
        addons: [
          { name: "Extra grilled chicken", price: 1500 },
          { name: "Fried plantain", price: 500 },
          { name: "Coleslaw", price: 400 },
        ],
        featured: true,
        tags: ["bestseller", "jollof"],
      },
      {
        name: "Fried Rice & Chicken",
        slug: "fried-rice-and-chicken",
        price: 4000,
        description: "Vegetable fried rice with a quarter grilled chicken and fresh salad.",
        image: "friedrice",
        category: "Rice Dishes",
        prepTime: 20,
        portion: "Regular",
        addons: [
          { name: "Extra chicken", price: 1500 },
          { name: "Boiled egg", price: 300 },
        ],
      },
      {
        name: "Goat Meat Pepper Soup",
        slug: "goat-meat-pepper-soup",
        price: 3500,
        description: "Fiery native pepper soup with tender goat meat, uziza and scent leaves. Perfect for a cold evening.",
        image: "peppersoup",
        category: "Native Soups",
        prepTime: 30,
        portion: "Medium bowl",
      },
      {
        name: "Afang Soup & Garri",
        slug: "afang-soup-and-garri",
        price: 5500,
        description: "Rich Afang soup with assorted meat, dried fish and periwinkle, served with soft garri.",
        image: "afang",
        category: "Native Soups",
        prepTime: 35,
        portion: "Family bowl",
      },
      {
        name: "Chinchin (500g)",
        slug: "chinchin-500g",
        price: 2500,
        description: "Crunchy, lightly spiced chinchin fried fresh daily. Sealed for freshness.",
        image: "chinchin",
        category: "Small Chops",
        trackStock: true,
        stock: 40,
        portion: "500g pack",
        tags: ["snack"],
      },
    ],
  },
  {
    storeName: "Royal Fashion Boutique",
    slug: "royalfashionboutique",
    category: "fashion-clothing",
    ownerName: "Imaobong Udo",
    email: "ima@royalfashion.test",
    phone: "08031234502",
    city: "Uyo",
    state: "Akwa Ibom",
    address: "Tropicana Mall, Uyo",
    tagline: "Ankara, lace and bespoke pieces made in Akwa Ibom",
    description:
      "Royal Fashion Boutique designs ready-to-wear and custom pieces for women and men. We specialise in Ankara, lace, kaftans and bridal. Bespoke orders take 7–21 days depending on complexity.",
    plan: "growth",
    subscriptionDays: 25,
    deliveryFee: 2500,
    minimumOrder: 0,
    prepTime: 60,
    featured: true,
    operatingHours: HOURS_WEEKDAY,
    productCategories: ["Ready to wear", "Bespoke", "Bridal"],
    products: [
      {
        name: "Ankara Peplum Gown",
        slug: "ankara-peplum-gown",
        price: 28000,
        compareAt: 32000,
        description:
          "Hand-tailored Ankara peplum gown with a fitted bodice and flared hem. Available in ready-made sizes or made to your exact measurements.",
        image: "ankara",
        category: "Ready to wear",
        trackStock: true,
        stock: 12,
        variants: [
          { name: "Small / Red", price: 28000, stock: 4, attributes: { size: "S", colour: "Red" } },
          { name: "Medium / Red", price: 28000, stock: 5, attributes: { size: "M", colour: "Red" } },
          { name: "Large / Blue", price: 29000, stock: 3, attributes: { size: "L", colour: "Blue" } },
        ],
        attributes: { material: "Ankara" },
        featured: true,
        tags: ["ankara", "gown"],
      },
      {
        name: "Silk Kaftan Set",
        slug: "silk-kaftan-set",
        price: 35000,
        description: "Fluid silk kaftan with matching trousers. Perfect for owambe and evening events.",
        image: "kaftan",
        category: "Ready to wear",
        trackStock: true,
        stock: 8,
        variants: [
          { name: "Medium / Cream", price: 35000, stock: 4, attributes: { size: "M", colour: "Cream" } },
          { name: "Large / Cream", price: 35000, stock: 4, attributes: { size: "L", colour: "Cream" } },
        ],
        attributes: { material: "Silk" },
      },
      {
        name: "Bespoke Agbada Set",
        slug: "bespoke-agbada-set",
        price: 85000,
        description:
          "Three-piece agbada tailored to your measurements. Choose your fabric and embroidery style. Production takes about 14 days.",
        image: "agbada",
        category: "Bespoke",
        madeToOrder: true,
        productionDays: 14,
        attributes: { material: "Atiku" },
        tags: ["bespoke", "made-to-order"],
      },
      {
        name: "Bridal Lace Gown",
        slug: "bridal-lace-gown",
        price: 250000,
        pricingType: "from",
        description:
          "Custom bridal gown with beaded lace, corset bodice and train. Book a consultation and we will quote based on your design.",
        image: "bridal",
        category: "Bridal",
        madeToOrder: true,
        productionDays: 45,
        attributes: { material: "Lace" },
      },
    ],
  },
  {
    storeName: "Victor Shoes & Leather",
    slug: "victorshoes",
    category: "shoes-footwear",
    ownerName: "Victor Akpan",
    email: "victor@victorshoes.test",
    phone: "08031234503",
    city: "Ikot Ekpene",
    state: "Akwa Ibom",
    address: "24 Market Road, Ikot Ekpene",
    tagline: "Handmade leather footwear from Ikot Ekpene",
    description:
      "We hand-craft leather loafers, sandals and boots. Every pair is made to order after your measurement is confirmed. Production takes 14–28 days and you can follow every stage from your order page.",
    plan: "business",
    subscriptionDays: 75,
    deliveryFee: 3000,
    minimumOrder: 0,
    prepTime: 120,
    operatingHours: HOURS_WEEKDAY,
    productCategories: ["Loafers", "Sandals", "Boots"],
    products: [
      {
        name: "Handmade Leather Loafers",
        slug: "handmade-leather-loafers",
        price: 45000,
        description:
          "Full-grain leather loafers, hand-stitched sole and soft leather lining. Made to order from your foot measurement.",
        image: "loafer",
        category: "Loafers",
        madeToOrder: true,
        productionDays: 21,
        trackStock: false,
        variants: [
          { name: "Size 41 / Brown", price: 45000, attributes: { size: "41", colour: "Brown" } },
          { name: "Size 42 / Brown", price: 45000, attributes: { size: "42", colour: "Brown" } },
          { name: "Size 43 / Black", price: 46000, attributes: { size: "43", colour: "Black" } },
          { name: "Size 44 / Black", price: 46000, attributes: { size: "44", colour: "Black" } },
        ],
        attributes: { material: "Leather" },
        featured: true,
        tags: ["made-to-order", "leather"],
      },
      {
        name: "Handmade Leather Sandals",
        slug: "handmade-leather-sandals",
        price: 28000,
        description: "Lightweight palm slippers with braided leather straps, built for everyday wear.",
        image: "sandal",
        category: "Sandals",
        madeToOrder: true,
        productionDays: 14,
        variants: [
          { name: "Size 40 / Tan", price: 28000, attributes: { size: "40", colour: "Tan" } },
          { name: "Size 42 / Tan", price: 28000, attributes: { size: "42", colour: "Tan" } },
        ],
      },
      {
        name: "Custom Leather Boots",
        slug: "custom-leather-boots",
        price: 68000,
        description:
          "Chelsea boots made to your foot measurement, with your choice of sole and stitching. Send a reference image if you have one.",
        image: "boot",
        category: "Boots",
        madeToOrder: true,
        productionDays: 28,
        attributes: { material: "Leather" },
        tags: ["custom"],
      },
      {
        name: "Woven Mules",
        slug: "woven-mules",
        price: 32000,
        description: "Hand-woven leather mules — breathable, elegant and made in your size.",
        image: "mules",
        category: "Sandals",
        madeToOrder: true,
        productionDays: 18,
      },
    ],
  },
  {
    storeName: "Excel Electronics Hub",
    slug: "excelelectronics",
    category: "electronics-gadgets",
    ownerName: "Excel Okon",
    email: "excel@excelelectronics.test",
    phone: "08031234504",
    city: "Uyo",
    state: "Akwa Ibom",
    address: "Shop 8, Akpan Andem Market, Uyo",
    tagline: "Verified gadgets with real warranties",
    description:
      "Excel Electronics Hub sells new and certified refurbished phones, laptops, TVs and accessories. Every item ships with a warranty card and we verify serial numbers before delivery.",
    plan: "growth",
    subscriptionDays: 30,
    deliveryFee: 2000,
    minimumOrder: 0,
    prepTime: 120,
    featured: true,
    operatingHours: HOURS_WEEKDAY,
    productCategories: ["Phones", "Computers", "Home & TV", "Accessories"],
    products: [
      {
        name: "Samsung Galaxy A55 (8GB/256GB)",
        slug: "samsung-galaxy-a55",
        price: 385000,
        compareAt: 420000,
        description:
          "Brand new Samsung Galaxy A55 with 8GB RAM, 256GB storage, 120Hz Super AMOLED display and 50MP OIS camera. Sealed pack with 12-month warranty.",
        image: "phone",
        category: "Phones",
        trackStock: true,
        stock: 6,
        condition: "new",
        brand: "Samsung",
        warrantyInfo: "12-month manufacturer warranty",
        warrantyMonths: 12,
        specifications: {
          Display: "6.6\" Super AMOLED 120Hz",
          RAM: "8GB",
          Storage: "256GB",
          Battery: "5000mAh",
          Camera: "50MP + 12MP + 5MP",
        },
        variants: [
          { name: "Awesome Navy", price: 385000, stock: 4, attributes: { colour: "Navy" } },
          { name: "Awesome Iceblue", price: 385000, stock: 2, attributes: { colour: "Iceblue" } },
        ],
        featured: true,
        tags: ["phone", "samsung"],
      },
      {
        name: "HP EliteBook 840 G8",
        slug: "hp-elitebook-840-g8",
        price: 620000,
        description:
          "Certified refurbished business laptop: Intel Core i7 11th gen, 16GB RAM, 512GB NVMe SSD and a 14\" full HD display. Grade A condition.",
        image: "laptop",
        category: "Computers",
        trackStock: true,
        stock: 3,
        condition: "refurbished",
        brand: "HP",
        warrantyInfo: "6-month dealer warranty",
        warrantyMonths: 6,
        specifications: { Processor: "Intel Core i7-1165G7", RAM: "16GB", Storage: "512GB SSD", Display: "14\" FHD" },
      },
      {
        name: "LG 55\" 4K Smart TV",
        slug: "lg-55-inch-4k-smart-tv",
        price: 780000,
        description: "55-inch 4K UHD Smart TV with webOS, ThinQ AI and 20W speakers. Free wall bracket on delivery within Uyo.",
        image: "tv",
        category: "Home & TV",
        trackStock: true,
        stock: 2,
        condition: "new",
        brand: "LG",
        warrantyInfo: "12-month LG warranty",
        warrantyMonths: 12,
        specifications: { Size: "55 inch", Resolution: "4K UHD", Smart: "webOS 23", HDMI: "3 ports" },
      },
      {
        name: "Anker 20,000mAh Power Bank",
        slug: "anker-20000mah-power-bank",
        price: 42000,
        description: "Fast-charging 20,000mAh power bank with two USB-C ports and a digital display.",
        image: "powerbank",
        category: "Accessories",
        trackStock: true,
        stock: 25,
        condition: "new",
        brand: "Anker",
        warrantyInfo: "18-month warranty",
        warrantyMonths: 18,
      },
    ],
  },
  {
    storeName: "Glow Beauty Studio",
    slug: "glowbeauty",
    category: "beauty-personal-care",
    ownerName: "Blessing Eka",
    email: "blessing@glowbeauty.test",
    phone: "08031234505",
    city: "Uyo",
    state: "Akwa Ibom",
    address: "24 Oron Road, Uyo",
    tagline: "Skin, hair and glam from certified therapists",
    description:
      "Glow Beauty Studio offers facials, gele tying, bridal glam and clean skincare products. Book an appointment online or order products for delivery across Uyo.",
    plan: "growth",
    subscriptionDays: 12,
    deliveryFee: 1500,
    minimumOrder: 0,
    prepTime: 30,
    operatingHours: HOURS_WEEKDAY,
    productCategories: ["Skincare", "Hair Care", "Beauty Services"],
    products: [
      {
        name: "Raw Shea Butter (500ml)",
        slug: "raw-shea-butter-500ml",
        price: 7500,
        description: "Unrefined shea butter from Akwa Ibom cooperatives. Deeply moisturising for skin and hair.",
        image: "sheabutter",
        category: "Skincare",
        trackStock: true,
        stock: 60,
        attributes: { skinType: "All" },
      },
      {
        name: "Hair Care Kit",
        slug: "hair-care-kit",
        price: 18500,
        description: "Shampoo, deep conditioner and leave-in cream for natural hair. Sulphate free.",
        image: "hairkit",
        category: "Hair Care",
        trackStock: true,
        stock: 18,
        featured: true,
      },
      {
        name: "Signature Glow Facial",
        slug: "signature-glow-facial",
        price: 15000,
        description:
          "60-minute deep-cleansing facial with steam, extraction and a vitamin C mask. Performed by a certified aesthetician.",
        image: "facial",
        kind: "service",
        category: "Beauty Services",
        serviceDuration: 60,
        pricingType: "fixed",
        tags: ["booking"],
      },
      {
        name: "Bridal Gele Tying",
        slug: "bridal-gele-tying",
        price: 12000,
        description: "Expert gele tying for brides and their train, on location within Uyo.",
        image: "gele",
        kind: "service",
        category: "Beauty Services",
        serviceDuration: 45,
        pricingType: "fixed",
      },
    ],
  },
  {
    storeName: "BrightFix Home Services",
    slug: "brightfix",
    category: "services-professionals",
    ownerName: "Daniel Effiong",
    email: "daniel@brightfix.test",
    phone: "08031234506",
    city: "Uyo",
    state: "Akwa Ibom",
    address: "5 Nwaniba Road, Uyo",
    tagline: "Verified technicians for your home and office",
    description:
      "BrightFix provides plumbing, electrical installation, painting and CCTV services across Uyo. Fixed-price jobs can be booked instantly; larger projects receive a written quotation within 24 hours.",
    plan: "business",
    subscriptionDays: 60,
    deliveryFee: 0,
    minimumOrder: 0,
    prepTime: 60,
    operatingHours: HOURS_WEEKDAY,
    productCategories: ["Plumbing", "Electrical", "Project Services"],
    products: [
      {
        name: "Emergency Plumbing Repair",
        slug: "emergency-plumbing-repair",
        price: 15000,
        description: "Leak diagnosis and repair for sinks, toilets and pipes. Includes first hour of labour and call-out.",
        image: "plumbing",
        kind: "service",
        category: "Plumbing",
        serviceDuration: 60,
        pricingType: "fixed",
      },
      {
        name: "Electrical Installation (Per Point)",
        slug: "electrical-installation",
        price: 8500,
        description: "Certified wiring for one socket or lighting point, including conduit and testing.",
        image: "electrical",
        kind: "service",
        category: "Electrical",
        serviceDuration: 90,
        pricingType: "fixed",
      },
      {
        name: "Interior Painting Project",
        slug: "interior-painting-project",
        price: 0,
        pricingType: "quotation",
        description:
          "Full interior painting with surface preparation and premium emulsion. Request a quotation with your room count and we will respond within 24 hours.",
        image: "painting",
        kind: "service",
        category: "Project Services",
        serviceDuration: 480,
        tags: ["quotation"],
      },
      {
        name: "CCTV Installation (4 Cameras)",
        slug: "cctv-installation",
        price: 0,
        pricingType: "quotation",
        description:
          "Supply and installation of a 4-camera CCTV system with mobile viewing. Quotation depends on cabling distance and camera type.",
        image: "cctv",
        kind: "service",
        category: "Project Services",
        serviceDuration: 300,
        tags: ["quotation"],
      },
    ],
  },
  {
    storeName: "Uyo Gadget Mart",
    slug: "uyogadgetmart",
    category: "electronics-gadgets",
    ownerName: "Emeka Nwosu",
    email: "emeka@uyogadgetmart.test",
    phone: "08031234507",
    city: "Uyo",
    state: "Akwa Ibom",
    address: "9 Ikot Ekpene Road, Uyo",
    tagline: "Everyday gadgets at market price",
    description:
      "Uyo Gadget Mart stocks power banks, chargers, earbuds and phone accessories. This store demonstrates the automatic suspension flow: its subscription has expired, so the storefront is offline until renewed.",
    plan: "growth",
    subscriptionDays: -3,
    deliveryFee: 1500,
    minimumOrder: 0,
    prepTime: 60,
    operatingHours: HOURS_WEEKDAY,
    productCategories: ["Accessories"],
    products: [
      {
        name: "Power Bank Pro 10,000mAh",
        slug: "power-bank-pro-10000mah",
        price: 18000,
        description: "Slim 10,000mAh power bank with 22.5W fast charging.",
        image: "powerbank2",
        category: "Accessories",
        trackStock: true,
        stock: 15,
        condition: "new",
      },
    ],
  },
];

const adminEmail = "admin@ibomvendorshub.com";
const adminPassword = "Admin1234!";
const vendorPassword = "Vendor1234!";
const customerPassword = "Customer1234!";

const TENANT_TABLES = [
  "order_tracking", "order_status_history", "order_items", "payment_allocations",
  "platform_commissions", "refunds", "vendor_payouts", "vendor_balances", "payments",
  "service_attachments", "service_quotations", "service_bookings", "inventory_movements",
  "product_addons", "product_variants", "product_images", "products", "product_categories",
  "subscription_payments", "subscription_history", "subscriptions",
  "subdomain_change_requests", "store_domains", "stores",
  "delivery_addresses", "customer_profiles", "vendor_profiles", "reviews", "reports",
  "customer_messages", "notifications", "email_logs", "activity_logs", "scheduled_job_runs",
  "auth_tokens", "user_roles", "users",
];

async function seed() {
  const reset = process.argv.includes("--reset");
  ensureSeedImages();

  const existing = await client.query(`select count(*)::int as count from users`);
  if (existing.rows[0].count > 0 && !reset) {
    console.log("Database already contains data — skipping seed. Use `npm run db:seed -- --reset` to reseed.");
    return;
  }

  if (reset) {
    console.log("Resetting demo data…");
    await client.query(`truncate table ${TENANT_TABLES.join(", ")} cascade`);
  }

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const vendorHash = await bcrypt.hash(vendorPassword, 10);
  const customerHash = await bcrypt.hash(customerPassword, 10);

  /* Super admin + platform admin ------------------------------------------- */
  await q(
    `insert into users (email, password_hash, full_name, phone, role, email_verified_at)
     values ($1,$2,'Platform Administrator','08030000000','super_admin', now())`,
    [adminEmail, adminHash],
  );
  await q(
    `insert into users (email, password_hash, full_name, phone, role, email_verified_at)
     values ('ops@ibomvendorshub.com',$1,'Operations Manager','08030000001','admin', now())`,
    [adminHash],
  );

  /* Plans ------------------------------------------------------------------ */
  const plans = await q<{ id: string; slug: string; duration_days: number }>(
    `select id, slug, duration_days from subscription_plans`,
  );
  const planBySlug = new Map(plans.map((plan) => [plan.slug, plan]));

  const categoryRows = await q<{ id: string; slug: string }>(`select id, slug from store_categories`);
  const categoryBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));

  /* Vendors ---------------------------------------------------------------- */
  const storeIds: Record<string, string> = {};
  const productIdBySlug: Record<string, string> = {};
  const ownerEmailByStore: Record<string, string> = {};

  for (const vendor of vendors) {
    const user = await one<{ id: string }>(
      `insert into users (email, password_hash, full_name, phone, role, email_verified_at)
       values ($1,$2,$3,$4,'vendor', now()) returning id`,
      [vendor.email, vendorHash, vendor.ownerName, vendor.phone],
    );
    await q(`insert into vendor_profiles (user_id, position, verified_at) values ($1,'Owner', now())`, [user.id]);
    await q(`insert into user_roles (user_id, role) values ($1,'vendor') on conflict do nothing`, [user.id]);

    const store = await one<{ id: string }>(
      `insert into stores
         (owner_id, category_id, name, slug, tagline, description, logo_url, cover_url,
          email, phone, whatsapp, address, city, state, operating_hours, accepts_delivery,
          accepts_pickup, delivery_fee, minimum_order, prep_time_minutes, is_featured,
          status, approved_at, rating_avg, rating_count)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,true,true,$16,$17,$18,$19,
               'active', now(), 0, 0)
       returning id`,
      [
        user.id,
        categoryBySlug.get(vendor.category),
        vendor.storeName,
        vendor.slug,
        vendor.tagline,
        vendor.description,
        `${IMG}/logo-${vendor.slug}.svg`,
        `${IMG}/cover-${vendor.slug}.svg`,
        vendor.email,
        vendor.phone,
        vendor.phone,
        vendor.address,
        vendor.city,
        vendor.state,
        JSON.stringify(vendor.operatingHours ?? HOURS_WEEKDAY),
        vendor.deliveryFee,
        vendor.minimumOrder,
        vendor.prepTime,
        vendor.featured ?? false,
      ],
    );
    storeIds[vendor.slug] = store.id;
    ownerEmailByStore[vendor.slug] = vendor.email;

    await q(`insert into vendor_balances (store_id) values ($1) on conflict do nothing`, [store.id]);

    const plan = planBySlug.get(vendor.plan) ?? planBySlug.get("growth")!;
    const status = vendor.subscriptionDays > 0 ? (vendor.plan === "starter" ? "trialing" : "active") : "expired";
    await q(
      `insert into subscriptions (store_id, plan_id, status, started_at, expires_at)
       values ($1,$2,$3, now() - make_interval(days => 5), now() + make_interval(days => $4))`,
      [store.id, plan.id, status, vendor.subscriptionDays],
    );
    if (status === "expired") {
      await q(`update stores set status = 'expired', suspension_reason = 'Subscription expired' where id = $1`, [
        store.id,
      ]);
    }

    /* Product categories */
    const catIds: Record<string, string> = {};
    for (const [index, name] of vendor.productCategories.entries()) {
      const cat = await one<{ id: string }>(
        `insert into product_categories (store_id, name, slug, sort_order)
         values ($1,$2,$3,$4) returning id`,
        [store.id, name, name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), index],
      );
      catIds[name] = cat.id;
    }

    /* Products */
    for (const [index, product] of vendor.products.entries()) {
      const row = await one<{ id: string }>(
        `insert into products
           (store_id, category_id, name, slug, sku, kind, description, short_description, price,
            compare_at_price, pricing_type, track_stock, stock_quantity, is_available, is_featured,
            condition, brand, warranty_info, warranty_months, specifications, attributes,
            made_to_order, production_days, prep_time_minutes, portion, service_duration_minutes,
            tags, sort_order, rating_avg, rating_count)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14,$15,$16,$17,$18,$19::jsonb,
                 $20::jsonb,$21,$22,$23,$24,$25,$26,$27,0,0)
         returning id`,
        [
          store.id,
          catIds[product.category] ?? null,
          product.name,
          product.slug,
          `SKU-${vendor.slug.slice(0, 3).toUpperCase()}-${index + 1}`,
          product.kind ?? "product",
          product.description,
          product.description.slice(0, 120),
          product.price,
          product.compareAt ?? null,
          product.pricingType ?? "fixed",
          product.trackStock ?? false,
          product.stock ?? 0,
          product.featured ?? false,
          product.condition ?? null,
          product.brand ?? null,
          product.warrantyInfo ?? null,
          product.warrantyMonths ?? null,
          JSON.stringify(product.specifications ?? {}),
          JSON.stringify(product.attributes ?? {}),
          product.madeToOrder ?? false,
          product.productionDays ?? null,
          product.prepTime ?? null,
          product.portion ?? null,
          product.serviceDuration ?? null,
          product.tags ?? [],
          index,
        ],
      );
      productIdBySlug[`${vendor.slug}/${product.slug}`] = row.id;

      await q(`insert into product_images (product_id, url, alt, sort_order) values ($1,$2,$3,0)`, [
        row.id,
        `${IMG}/product-${product.image}.svg`,
        product.name,
      ]);

      for (const [vIndex, variant] of (product.variants ?? []).entries()) {
        await q(
          `insert into product_variants (product_id, name, price, stock_quantity, attributes, is_available, sort_order)
           values ($1,$2,$3,$4,$5::jsonb,true,$6)`,
          [row.id, variant.name, variant.price ?? null, variant.stock ?? 0, JSON.stringify(variant.attributes), vIndex],
        );
      }
      for (const [aIndex, addon] of (product.addons ?? []).entries()) {
        await q(
          `insert into product_addons (product_id, name, price, sort_order) values ($1,$2,$3,$4)`,
          [row.id, addon.name, addon.price, aIndex],
        );
      }
    }
  }

  /* Customers -------------------------------------------------------------- */
  const ada = await one<{ id: string }>(
    `insert into users (email, password_hash, full_name, phone, role, email_verified_at)
     values ('customer@ibomvendorshub.com',$1,'Ada Bassey','08123456789','customer', now()) returning id`,
    [customerHash],
  );
  await q(`insert into customer_profiles (user_id, city, state) values ($1,'Uyo','Akwa Ibom')`, [ada.id]);
  await q(
    `insert into delivery_addresses (user_id, label, recipient, phone, address, city, state, is_default)
     values ($1,'Home','Ada Bassey','08123456789','14 Ewet Housing Estate','Uyo','Akwa Ibom', true)`,
    [ada.id],
  );

  const emmanuel = await one<{ id: string }>(
    `insert into users (email, password_hash, full_name, phone, role, email_verified_at)
     values ('emmanuel@example.com',$1,'Emmanuel Uko','08109876543','customer', now()) returning id`,
    [customerHash],
  );
  await q(`insert into customer_profiles (user_id, city, state) values ($1,'Ikot Ekpene','Akwa Ibom')`, [emmanuel.id]);

  /* Orders ----------------------------------------------------------------- */
  type OrderSeed = {
    storeSlug: string;
    customer: { id: string; name: string; email: string; phone: string };
    status: string;
    paymentStatus: "paid" | "pending";
    fulfilment: "delivery" | "pickup" | "service";
    items: Array<{ key: string; quantity: number; addons?: Array<{ name: string; price: number }> }>;
    daysAgo: number;
    history: Array<{ status: string; note?: string; daysAgo: number }>;
    estimates?: { completion?: string; dispatch?: string; delivery?: string };
    productionProgress?: number;
    review?: { rating: number; comment: string; title: string };
    tracking?: { carrier: string; number: string; message: string };
  };

  const orderSeeds: OrderSeed[] = [
    {
      storeSlug: "mamaput-kitchen",
      customer: { id: ada.id, name: "Ada Bassey", email: "customer@ibomvendorshub.com", phone: "08123456789" },
      status: "completed",
      paymentStatus: "paid",
      fulfilment: "delivery",
      items: [
        { key: "mamaput-kitchen/jollof-rice-party-pack", quantity: 2, addons: [{ name: "Extra grilled chicken", price: 1500 }] },
        { key: "mamaput-kitchen/chinchin-500g", quantity: 1 },
      ],
      daysAgo: 9,
      history: [
        { status: "placed", daysAgo: 9 },
        { status: "payment_confirmed", note: "Payment verified", daysAgo: 9 },
        { status: "accepted", note: "Kitchen accepted your order", daysAgo: 9 },
        { status: "preparing", daysAgo: 9 },
        { status: "dispatched", note: "Rider picked up your order", daysAgo: 9 },
        { status: "delivered", daysAgo: 9 },
        { status: "completed", daysAgo: 8 },
      ],
      review: {
        rating: 5,
        title: "Best jollof in Uyo",
        comment: "The jollof arrived hot and the extra chicken was worth it. Delivery was faster than the estimate.",
      },
    },
    {
      storeSlug: "victorshoes",
      customer: { id: ada.id, name: "Ada Bassey", email: "customer@ibomvendorshub.com", phone: "08123456789" },
      status: "in_production",
      paymentStatus: "paid",
      fulfilment: "delivery",
      items: [{ key: "victorshoes/handmade-leather-loafers", quantity: 1 }],
      daysAgo: 6,
      history: [
        { status: "placed", daysAgo: 6 },
        { status: "payment_confirmed", note: "Payment verified", daysAgo: 6 },
        { status: "accepted", note: "Measurement confirmed — starting production soon", daysAgo: 5 },
        { status: "awaiting_production", daysAgo: 5 },
        { status: "in_production", note: "Upper cut and stitched", daysAgo: 2 },
      ],
      estimates: { completion: "+10 days", dispatch: "+12 days", delivery: "+14 days" },
      productionProgress: 45,
    },
    {
      storeSlug: "royalfashionboutique",
      customer: { id: emmanuel.id, name: "Emmanuel Uko", email: "emmanuel@example.com", phone: "08109876543" },
      status: "payment_confirmed",
      paymentStatus: "paid",
      fulfilment: "delivery",
      items: [{ key: "royalfashionboutique/ankara-peplum-gown", quantity: 1 }],
      daysAgo: 1,
      history: [
        { status: "placed", daysAgo: 1 },
        { status: "payment_confirmed", note: "Payment verified", daysAgo: 1 },
      ],
    },
    {
      storeSlug: "excelelectronics",
      customer: { id: emmanuel.id, name: "Emmanuel Uko", email: "emmanuel@example.com", phone: "08109876543" },
      status: "delivered",
      paymentStatus: "paid",
      fulfilment: "delivery",
      items: [{ key: "excelelectronics/anker-20000mah-power-bank", quantity: 1 }],
      daysAgo: 14,
      history: [
        { status: "placed", daysAgo: 14 },
        { status: "payment_confirmed", daysAgo: 14 },
        { status: "accepted", daysAgo: 13 },
        { status: "preparing", daysAgo: 13 },
        { status: "dispatched", daysAgo: 12 },
        { status: "delivered", daysAgo: 11 },
      ],
      review: {
        rating: 4,
        title: "Genuine product",
        comment: "The power bank charges my phone three times. Serial number checked on arrival.",
      },
    },
    {
      storeSlug: "brightfix",
      customer: { id: ada.id, name: "Ada Bassey", email: "customer@ibomvendorshub.com", phone: "08123456789" },
      status: "in_service",
      paymentStatus: "paid",
      fulfilment: "service",
      items: [{ key: "brightfix/emergency-plumbing-repair", quantity: 1 }],
      daysAgo: 2,
      history: [
        { status: "placed", daysAgo: 2 },
        { status: "payment_confirmed", note: "Payment verified", daysAgo: 2 },
        { status: "accepted", note: "Technician assigned — arriving Saturday 10:00", daysAgo: 1 },
        { status: "in_service", daysAgo: 1 },
      ],
    },
  ];

  for (const seed of orderSeeds) {
    const storeId = storeIds[seed.storeSlug];
    const productRows: Array<{
      id: string;
      name: string;
      kind: "product" | "service";
      price: number;
      unitPrice: number;
      quantity: number;
      addons: Array<{ name: string; price: number }>;
    }> = [];

    for (const item of seed.items) {
      const productId = productIdBySlug[item.key];
      if (!productId) continue;
      const product = await one<{ id: string; name: string; kind: "product" | "service"; price: number }>(
        `select id, name, kind, price from products where id = $1`,
        [productId],
      );
      const addons = item.addons ?? [];
      productRows.push({
        id: productId,
        name: product.name,
        kind: product.kind,
        price: Number(product.price),
        unitPrice: Number(product.price) + addons.reduce((sum, a) => sum + a.price, 0),
        quantity: item.quantity,
        addons,
      });
    }

    const subtotal = productRows.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const deliveryFee = seed.fulfilment === "delivery" ? 1200 : 0;
    const total = subtotal + deliveryFee;
    const commission = Number((subtotal * 0.05).toFixed(2));
    const payable = Number((total - commission).toFixed(2));

    const reference = (await one<{ ref: string }>(`select next_order_reference() as ref`)).ref;
    const checkoutRef = (await one<{ ref: string }>(`select next_checkout_reference() as ref`)).ref;
    const createdAt = new Date(Date.now() - seed.daysAgo * 86_400_000);

    const order = await one<{ id: string }>(
      `insert into orders
         (reference, checkout_reference, store_id, customer_id, customer_name, customer_email,
          customer_phone, status, payment_status, fulfilment_type, subtotal, delivery_fee, total,
          amount_paid, platform_commission, vendor_payable, delivery_address, production_progress,
          stock_committed, created_at, estimated_completion_date, estimated_dispatch_date,
          estimated_delivery_date, accepted_at, production_started_at, completed_at, delivered_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,true,$19,
               $20, $21, $22, $23, $24, $25, $26)
       returning id`,
      [
        reference,
        checkoutRef,
        storeId,
        seed.customer.id,
        seed.customer.name,
        seed.customer.email,
        seed.customer.phone,
        seed.status,
        seed.paymentStatus,
        seed.fulfilment,
        subtotal,
        deliveryFee,
        total,
        seed.paymentStatus === "paid" ? total : 0,
        commission,
        payable,
        JSON.stringify({
          address: "14 Ewet Housing Estate",
          city: "Uyo",
          state: "Akwa Ibom",
          recipient: seed.customer.name,
          phone: seed.customer.phone,
        }),
        seed.productionProgress ?? 0,
        createdAt,
        seed.estimates?.completion ? new Date(Date.now() + 10 * 86_400_000) : null,
        seed.estimates?.dispatch ? new Date(Date.now() + 12 * 86_400_000) : null,
        seed.estimates?.delivery ? new Date(Date.now() + 14 * 86_400_000) : null,
        seed.status === "payment_confirmed" ? null : new Date(createdAt.getTime() + 3_600_000),
        seed.status === "in_production" ? new Date(createdAt.getTime() + 86_400_000) : null,
        seed.status === "completed" ? new Date(createdAt.getTime() + 86_400_000) : null,
        ["delivered", "completed"].includes(seed.status) ? new Date(createdAt.getTime() + 86_400_000) : null,
      ],
    );

    for (const item of productRows) {
      await q(
        `insert into order_items (order_id, product_id, kind, name, unit_price, quantity, line_total, addons)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [order.id, item.id, item.kind, item.name, item.unitPrice, item.quantity, item.unitPrice * item.quantity, JSON.stringify(item.addons)],
      );
    }

    for (const entry of seed.history) {
      await q(
        `insert into order_status_history (order_id, from_status, to_status, note, actor_role, created_at)
         values ($1,null,$2,$3,'system',$4)`,
        [order.id, entry.status, entry.note ?? null, new Date(Date.now() - entry.daysAgo * 86_400_000 + 60_000)],
      );
    }

    if (seed.tracking) {
      await q(
        `insert into order_tracking (order_id, carrier, tracking_number, status, message)
         values ($1,$2,$3,'dispatched',$4)`,
        [order.id, seed.tracking.carrier, seed.tracking.number, seed.tracking.message],
      );
    }

    if (seed.paymentStatus === "paid") {
      const payment = await one<{ id: string }>(
        `insert into payments (reference, scope, provider, provider_reference, checkout_reference, store_id, order_id,
                               payer_user_id, payer_email, amount, currency, status, channel, paid_at, verified_at)
         values ($1,'order','sandbox',$2,$3,$4,$5,$6,$7,$8,'NGN','success','sandbox', now(), now())
         returning id`,
        [
          `PAY-SEED-${reference}`,
          `SBX-${reference}`,
          checkoutRef,
          storeId,
          order.id,
          seed.customer.id,
          seed.customer.email,
          total,
        ],
      );
      await q(
        `insert into payment_allocations (payment_id, order_id, store_id, amount) values ($1,$2,$3,$4)`,
        [payment.id, order.id, storeId, total],
      );
      await q(
        `insert into platform_commissions (order_id, store_id, payment_id, rate, amount)
         values ($1,$2,$3,5,$4)`,
        [order.id, storeId, payment.id, commission],
      );
      await q(
        `insert into vendor_balances (store_id, pending_amount, available_amount, lifetime_gross, lifetime_commission)
         values ($1,$2,$3,$4,$5)
         on conflict (store_id) do update set
           pending_amount = vendor_balances.pending_amount + excluded.pending_amount,
           available_amount = vendor_balances.available_amount + excluded.available_amount,
           lifetime_gross = vendor_balances.lifetime_gross + excluded.lifetime_gross,
           lifetime_commission = vendor_balances.lifetime_commission + excluded.lifetime_commission`,
        [
          storeId,
          ["delivered", "completed"].includes(seed.status) ? 0 : payable,
          ["delivered", "completed"].includes(seed.status) ? payable : 0,
          total,
          commission,
        ],
      );
    }

    if (seed.review) {
      await q(
        `insert into reviews (store_id, product_id, order_id, customer_id, customer_name, customer_email,
                              rating, title, comment, status, verified_purchase)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',true)`,
        [
          storeId,
          productRows[0]?.id ?? null,
          order.id,
          seed.customer.id,
          seed.customer.name,
          seed.customer.email,
          seed.review.rating,
          seed.review.title,
          seed.review.comment,
        ],
      );
    }
  }

  /* Quotation + booking examples ------------------------------------------- */
  await q(
    `insert into service_quotations
       (store_id, product_id, customer_name, customer_email, customer_phone, title, description, status,
        quoted_amount, quote_note, valid_until, responded_at)
     values ($1,$2,'Emmanuel Uko','emmanuel@example.com','08109876543',
             'Paint a 3-bedroom apartment','I need the interior of a 3-bedroom flat painted in Uyo. Walls are in good condition.',
             'quoted', 285000, 'Includes premium emulsion, two coats plus surface preparation. Materials included.',
             now() + interval '7 days', now())`,
    [storeIds["brightfix"], productIdBySlug["brightfix/interior-painting-project"]],
  );
  await q(
    `insert into service_quotations
       (store_id, product_id, customer_name, customer_email, customer_phone, title, description, status)
     values ($1,$2,'Ada Bassey','customer@ibomvendorshub.com','08123456789',
             'Wedding gele for 6 people','Bridal party gele for a wedding on the 28th. Six people, traditional attire.',
             'requested')`,
    [storeIds["glowbeauty"], productIdBySlug["glowbeauty/bridal-gele-tying"]],
  );
  await q(
    `insert into service_bookings (store_id, product_id, customer_id, customer_name, customer_email,
                                   customer_phone, scheduled_date, scheduled_time, duration_minutes, status)
     values ($1,$2,$3,'Ada Bassey','customer@ibomvendorshub.com','08123456789',
             current_date + 3, '11:00', 60, 'confirmed')`,
    [storeIds["glowbeauty"], productIdBySlug["glowbeauty/signature-glow-facial"], ada.id],
  );

  /* Platform settings sample content --------------------------------------- */
  await q(
    `update platform_settings set
       tagline = 'Every business in Akwa Ibom. One address.',
       terms_markdown = '# Terms of Service\n\nBy using Ibom Vendors Hub you agree to trade honestly, describe your products accurately and honour confirmed orders.\n\n## Vendors\n- Keep your catalogue and stock up to date.\n- Renew your subscription to keep your storefront online.\n- Respond to orders within 24 hours.\n\n## Customers\n- Provide accurate delivery information.\n- Pay for orders through the platform so you are protected.\n\n## Disputes\nContact support@ibomvendorshub.com within 7 days of delivery.',
       privacy_markdown = '# Privacy Policy\n\nWe collect only the information needed to operate your storefront, process orders and send service emails. We never sell your data.\n\n## Your rights\n- Request a copy of your data.\n- Ask us to correct inaccurate details.\n- Request deletion of your account (order records are retained for legal reasons).'
     where id = 1`,
  );

  console.log(`
✅ Seed complete

Super administrator  ${adminEmail} / ${adminPassword}
Vendors (password ${vendorPassword})
  grace@mamaput.test          → Mamaput Kitchen (restaurant)
  ima@royalfashion.test       → Royal Fashion Boutique (fashion)
  victor@victorshoes.test     → Victor Shoes (made-to-order footwear)
  excel@excelelectronics.test → Excel Electronics Hub
  blessing@glowbeauty.test    → Glow Beauty Studio (beauty + appointments)
  daniel@brightfix.test       → BrightFix Home Services (quotations)
  emeka@uyogadgetmart.test    → Uyo Gadget Mart (expired subscription)
Customers (password ${customerPassword})
  customer@ibomvendorshub.com
  emmanuel@example.com
`);
}

client
  .connect()
  .then(seed)
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    await client.end().catch(() => {});
    process.exit(1);
  });
