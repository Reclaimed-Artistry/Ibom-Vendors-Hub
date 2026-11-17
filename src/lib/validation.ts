import { z } from "zod";
import { AKWA_IBOM_STATE, isAkwaIbomState, PROOF_OF_RESIDENCE_TYPES } from "@/lib/akwa-ibom";

const email = z
  .string()
  .trim()
  .min(5, "Enter a valid email address")
  .max(160)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address");

const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(24)
  .regex(/^[+\d][\d\s()-]{6,23}$/, "Enter a valid phone number");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

const ninSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s-]/g, ""))
  .refine((val) => /^\d{11}$/.test(val), "Enter a valid 11-digit National Identification Number (NIN)");

const cacPattern = /^(?:(?:CAC[-\s/]*)?(?:RC|BN|IT)[-\s/:]*(?:NO\.?[-\s]*)?)?\d{4,14}$/i;

const proofTypes = PROOF_OF_RESIDENCE_TYPES.map((item) => item.value) as [string, ...string[]];

const akwaIbomStateSchema = z
  .string()
  .trim()
  .refine((value) => isAkwaIbomState(value), "Only businesses located in Akwa Ibom State can register as vendors")
  .transform(() => AKWA_IBOM_STATE);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

const accountNumberSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\s+/g, ""))
  .refine((val) => val === "" || /^\d{10}$/.test(val), "Enter a valid 10-digit Nigerian bank account number (NUBAN)");

export const vendorBankAccountSchema = z.object({
  bankName: z.string().trim().min(2, "Select or enter your bank name").max(100),
  accountNumber: z
    .string()
    .trim()
    .transform((val) => val.replace(/\s+/g, ""))
    .refine((val) => /^\d{10}$/.test(val), "Enter a valid 10-digit Nigerian bank account number (NUBAN)"),
  accountName: z.string().trim().min(3, "Enter the exact name on your bank account").max(140),
});

export const vendorRegisterSchema = z
  .object({
    businessName: z.string().trim().min(3, "Business name must be at least 3 characters").max(120),
    ownerName: z.string().trim().min(2, "Your full name is required").max(120),
    email: email.optional().or(z.literal("")),
    phone,
    password: password.optional().or(z.literal("")),
    categorySlug: z.string().min(1, "Choose a business category"),
    description: z.string().trim().min(10, "Tell customers about your business (at least 10 characters)").max(4000),
    city: z.string().trim().min(2, "Select your Local Government Area / town in Akwa Ibom").max(80),
    state: akwaIbomStateSchema,
    address: z.string().trim().min(5, "Enter your physical business / pickup address in Akwa Ibom").max(240),
    nin: ninSchema,
    proofOfResidenceType: z.enum(proofTypes, { message: "Select a proof of residence document type" }),
    proofOfResidenceUrl: z.string().trim().min(1, "Upload your proof of residence document").max(3_200_000),
    cacRegistered: z.enum(["yes", "no"], { message: "Indicate whether your business is registered with CAC" }),
    cacNumber: z.string().trim().max(40).optional().or(z.literal("")),
    bankName: z.string().trim().min(2, "Select or enter the bank where you receive payouts").max(100),
    accountNumber: accountNumberSchema.refine((val) => /^\d{10}$/.test(val), "Enter your 10-digit payout bank account number"),
    accountName: z.string().trim().min(3, "Enter the account holder name matching your bank account").max(140),
    logoUrl: z.string().trim().max(3_200_000).optional().or(z.literal("")),
    coverUrl: z.string().trim().max(3_200_000).optional().or(z.literal("")),
    acceptTerms: z.literal("on", { message: "You must accept the terms" }),
  })
  .superRefine((data, ctx) => {
    if (data.cacRegistered === "yes") {
      const cleaned = (data.cacNumber ?? "").trim();
      if (!cacPattern.test(cleaned)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cacNumber"],
          message: "Enter a valid CAC registration number (e.g. BN-1234567 or RC-1234567)",
        });
      }
    }
  });

export const vendorKycSchema = z
  .object({
    nin: ninSchema,
    proofOfResidenceType: z.enum(proofTypes, { message: "Select a proof of residence document type" }),
    proofOfResidenceUrl: z.string().trim().min(1, "Upload your proof of residence document").max(3_200_000),
    cacRegistered: z.enum(["yes", "no"], { message: "Indicate whether your business is registered with CAC" }),
    cacNumber: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.cacRegistered === "yes") {
      const cleaned = (data.cacNumber ?? "").trim();
      if (!cacPattern.test(cleaned)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cacNumber"],
          message: "Enter a valid CAC registration number (e.g. BN-1234567 or RC-1234567)",
        });
      }
    }
  });

export const customerRegisterSchema = z.object({
  fullName: z.string().trim().min(3, "Your name is required").max(120),
  email,
  phone: phone.optional().or(z.literal("")),
  password,
  acceptTerms: z.literal("on", { message: "You must accept the terms" }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(160),
  description: z.string().trim().max(6000).optional().or(z.literal("")),
  shortDescription: z.string().trim().max(240).optional().or(z.literal("")),
  kind: z.enum(["product", "service"]).default("product"),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price cannot be negative").max(100_000_000),
  compareAtPrice: z.coerce.number().min(0).optional(),
  pricingType: z.enum(["fixed", "from", "quotation"]).default("fixed"),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  trackStock: z.coerce.boolean().default(false),
  stockQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  isAvailable: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
  condition: z.enum(["", "new", "used", "refurbished"]).optional(),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  warrantyInfo: z.string().trim().max(500).optional().or(z.literal("")),
  warrantyMonths: z.coerce.number().int().min(0).max(240).optional(),
  madeToOrder: z.coerce.boolean().default(false),
  productionDays: z.coerce.number().int().min(0).max(365).optional(),
  prepTimeMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  portion: z.string().trim().max(60).optional().or(z.literal("")),
  serviceDurationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  images: z.array(z.string().trim().max(3_200_000)).max(12).default([]),
  attributes: z.record(z.string(), z.string()).default({}),
  specifications: z.record(z.string(), z.string()).default({}),
  variants: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        price: z.coerce.number().min(0).optional(),
        stockQuantity: z.coerce.number().int().min(0).default(0),
        attributes: z.record(z.string(), z.string()).default({}),
      }),
    )
    .max(60)
    .default([]),
  addons: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        price: z.coerce.number().min(0).default(0),
      }),
    )
    .max(30)
    .default([]),
});

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(120),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  email: email.optional().or(z.literal("")),
  phone: phone.optional().or(z.literal("")),
  whatsapp: z.string().trim().max(24).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  address: z.string().trim().min(5, "Enter your physical business / pickup address in Akwa Ibom").max(240),
  city: z.string().trim().min(2, "Select your LGA / town in Akwa Ibom").max(80),
  state: akwaIbomStateSchema,
  acceptsDelivery: z.coerce.boolean().default(true),
  acceptsPickup: z.coerce.boolean().default(true),
  acceptsOrders: z.coerce.boolean().default(true),
  deliveryFee: z.coerce.number().min(0).max(1_000_000).default(0),
  minimumOrder: z.coerce.number().min(0).max(10_000_000).default(0),
  deliveryAreas: z.string().trim().max(1000).optional().or(z.literal("")),
  prepTimeMinutes: z.coerce.number().int().min(0).max(1440).default(30),
  logoUrl: z.string().trim().max(600).optional().or(z.literal("")),
  coverUrl: z.string().trim().max(600).optional().or(z.literal("")),
});

export const openingHoursSchema = z.record(
  z.string(),
  z.object({
    open: z.string().max(5),
    close: z.string().max(5),
    closed: z.coerce.boolean(),
  }),
);

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(99),
  addons: z.array(z.string()).max(10).optional().default([]),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  measurements: z.record(z.string(), z.string()).optional(),
});

export const checkoutSchema = z
  .object({
    items: z.array(cartItemSchema).min(1, "Your cart is empty").max(40),
    customerName: z.string().trim().min(2, "Enter your full name").max(120),
    customerEmail: email,
    customerPhone: phone,
    bioAddress: z.string().trim().min(5, "Enter your residential / contact street address").max(400),
    fulfilmentType: z.enum(["delivery", "pickup"]).default("delivery"),
    address: z.string().trim().max(400).optional().or(z.literal("")),
    city: z.string().trim().max(80).optional().or(z.literal("")),
    state: z.string().trim().max(80).optional().or(z.literal("")),
    pickupLocation: z.string().trim().max(400).optional().or(z.literal("")),
    deliveryNotes: z.string().trim().max(400).optional().or(z.literal("")),
    customerNotes: z.string().trim().max(800).optional().or(z.literal("")),
    scheduledFor: z.string().trim().max(40).optional().or(z.literal("")),
    referenceImages: z.array(z.string().max(600)).max(3).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.fulfilmentType === "delivery") {
      if (!data.address || data.address.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["address"],
          message: "Enter the street address where dispatch should deliver",
        });
      }
      if (!data.city || data.city.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["city"],
          message: "Enter your delivery location / town / LGA",
        });
      }
      if (!data.state || data.state.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["state"],
          message: "Enter your delivery state",
        });
      }
    } else if (data.fulfilmentType === "pickup") {
      if (!data.pickupLocation || data.pickupLocation.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pickupLocation"],
          message: "Confirm the vendor pickup location",
        });
      }
    }
  });

export const reviewSchema = z.object({
  orderId: z.string().uuid(),
  productId: z.string().uuid().optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  comment: z.string().trim().min(5, "Tell us a little more").max(2000),
});

export const messageSchema = z.object({
  storeId: z.string().uuid().optional().or(z.literal("")),
  orderId: z.string().uuid().optional().or(z.literal("")),
  senderName: z.string().trim().min(2).max(120),
  senderEmail: email,
  subject: z.string().trim().min(3, "Add a subject").max(160),
  body: z.string().trim().min(10, "Describe your request").max(4000),
  category: z.enum(["inquiry", "order", "support", "dispute", "review_report"]).default("inquiry"),
});

export const quotationRequestSchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: email,
  customerPhone: phone,
  title: z.string().trim().min(3, "Give your request a title").max(160),
  description: z.string().trim().min(20, "Describe what you need (20+ characters)").max(4000),
  budget: z.coerce.number().min(0).max(100_000_000).optional(),
  preferredDate: z.string().trim().max(20).optional().or(z.literal("")),
  measurements: z.record(z.string(), z.string()).optional(),
  referenceImages: z.array(z.string().max(600)).max(5).optional().default([]),
});

export const quotationResponseSchema = z.object({
  quotationId: z.string().uuid(),
  amount: z.coerce.number().min(1, "Enter a quote amount"),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  validDays: z.coerce.number().int().min(1).max(90).default(7),
});

export const bookingSchema = z.object({
  productId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: email,
  customerPhone: phone,
  date: z.string().min(8, "Choose a date"),
  time: z.string().min(3, "Choose a time"),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  visitType: z.string().trim().max(150).optional().or(z.literal("")),
  materialsOption: z.string().trim().max(200).optional().or(z.literal("")),
  requirementsAccepted: z.boolean().refine((val) => val === true, {
    message: "Please confirm you have read the booking requirements for this service",
  }),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const orderUpdateSchema = z.object({
  action: z.enum([
    "accept", "reject", "preparing", "production_start", "production_complete",
    "ready", "dispatch", "deliver", "complete", "cancel", "progress", "eta", "tracking",
  ]),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  eta: z.string().trim().max(20).optional().or(z.literal("")),
  dispatchEta: z.string().trim().max(20).optional().or(z.literal("")),
  deliveryEta: z.string().trim().max(20).optional().or(z.literal("")),
  productionProgress: z.coerce.number().int().min(0).max(100).optional(),
  trackingCarrier: z.string().trim().max(80).optional().or(z.literal("")),
  trackingNumber: z.string().trim().max(80).optional().or(z.literal("")),
});

export const subscriptionPlanSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(100_000_000),
  durationDays: z.coerce.number().int().min(1).max(3650),
  intervalMonths: z.coerce.number().int().min(0).max(120).default(1),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  productLimit: z.coerce.number().int().min(0).max(1_000_000).optional(),
  isActive: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
  features: z.string().max(4000).optional().or(z.literal("")),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  icon: z.string().trim().max(40).optional().or(z.literal("")),
  features: z.record(z.string(), z.coerce.boolean()).default({}),
  workflow: z.string().max(6000).optional().or(z.literal("")),
  attributes: z.string().max(6000).optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
});

export const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  supportEmail: email,
  supportPhone: z.string().trim().max(40),
  currency: z.string().trim().min(2).max(6),
  currencySymbol: z.string().trim().min(1).max(4),
  defaultTrialDays: z.coerce.number().int().min(0).max(365),
  commissionRate: z.coerce.number().min(0).max(50),
  requireVendorApproval: z.coerce.boolean().default(false),
  paymentsEnabled: z.coerce.boolean().default(true),
  paystackPublicKey: z.string().trim().max(200).optional().or(z.literal("")),
  paystackSecretKey: z.string().trim().max(200).optional().or(z.literal("")),
  emailFrom: z.string().trim().max(200).optional().or(z.literal("")),
  termsMarkdown: z.string().max(20000).optional().or(z.literal("")),
  privacyMarkdown: z.string().max(20000).optional().or(z.literal("")),
  maintenanceMode: z.coerce.boolean().default(false),
});

export type VendorRegisterInput = z.infer<typeof vendorRegisterSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductInput = z.infer<typeof productSchema>;

export function formatIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
