"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  getCurrentUser,
  getVendorContext,
  setSessionCookie,
  vendorSuspensionMessage,
} from "@/lib/auth";
import { isUniqueViolation, systemDb, withActor, withSystem } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { notify, notifyAdmins } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { uploadImage, uploadVerificationDocument } from "@/lib/storage";
import { AKWA_IBOM_STATE } from "@/lib/akwa-ibom";
import { getSettings } from "@/lib/settings";
import { updateOrderByVendor } from "@/lib/orders";
import {
  deleteProductCompletely,
  deleteStoreCompletely,
  normaliseBusinessName,
  resubmitStoreForReview,
} from "@/lib/stores";
import { purchaseSubscription, getPlans } from "@/lib/subscriptions";
import {
  productSchema,
  storeSettingsSchema,
  vendorBankAccountSchema,
  vendorKycSchema,
  quotationResponseSchema,
  formatIssues,
} from "@/lib/validation";
import { toSlug } from "@/lib/utils";

export interface VendorState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  redirectUrl?: string;
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

async function ensureUniqueProductSlug(storeId: string, name: string, excludeId?: string) {
  const base = toSlug(name) || "item";
  let candidate = base;
  for (let index = 2; index < 60; index += 1) {
    const clash = await systemDb.maybeOne<{ id: string }>(
      `select id from products where store_id = $1 and slug = $2 and ($3::uuid is null or id <> $3::uuid)`,
      [storeId, candidate, excludeId ?? null],
    );
    if (!clash) return candidate;
    candidate = `${base}-${index}`;
  }
  return `${base}-${Date.now().toString().slice(-5)}`;
}

function parseJsonField<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function saveProductAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const lockError = vendorSuspensionMessage(ctx);
  if (lockError) return { error: lockError };
  const productId = String(formData.get("productId") ?? "") || null;
  const categoryFeatures = (ctx.category?.features ?? {}) as Record<string, boolean>;

  const variants = parseJsonField<Array<{ name: string; price?: string; stockQuantity?: string; attributes?: Record<string, string> }>>(
    formData.get("variantsJson"),
    [],
  );
  const addons = parseJsonField<Array<{ name: string; price?: string }>>(formData.get("addonsJson"), []);
  const specifications = parseJsonField<Record<string, string>>(formData.get("specificationsJson"), {});
  const attributes = parseJsonField<Record<string, string>>(formData.get("attributesJson"), {});

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    shortDescription: formData.get("shortDescription") ?? "",
    kind: formData.get("kind") || "product",
    categoryId: formData.get("categoryId") ?? "",
    price: formData.get("price") || 0,
    compareAtPrice: formData.get("compareAtPrice") || undefined,
    pricingType: formData.get("pricingType") || "fixed",
    sku: formData.get("sku") ?? "",
    trackStock: formData.get("trackStock") === "on" || formData.get("trackStock") === "true",
    stockQuantity: formData.get("stockQuantity") || 0,
    isAvailable: formData.has("isAvailablePresent")
      ? formData.get("isAvailable") === "on" || formData.get("isAvailable") === "true"
      : formData.get("isAvailable") !== "false",
    isFeatured: formData.get("isFeatured") === "on" || formData.get("isFeatured") === "true",
    condition: formData.get("condition") ?? "",
    brand: formData.get("brand") ?? "",
    model: formData.get("model") ?? "",
    warrantyInfo: formData.get("warrantyInfo") ?? "",
    warrantyMonths: formData.get("warrantyMonths") || undefined,
    madeToOrder: formData.get("madeToOrder") === "on" || formData.get("madeToOrder") === "true",
    productionDays: formData.get("productionDays") || undefined,
    prepTimeMinutes: formData.get("prepTimeMinutes") || undefined,
    portion: formData.get("portion") ?? "",
    serviceDurationMinutes: formData.get("serviceDurationMinutes") || undefined,
    images: [],
    attributes,
    specifications,
    variants: variants
      .filter((variant) => variant.name?.trim())
      .map((variant) => ({
        name: variant.name.trim(),
        price: variant.price !== undefined && variant.price !== "" ? Number(variant.price) : undefined,
        stockQuantity: Number(variant.stockQuantity ?? 0) || 0,
        attributes: variant.attributes ?? {},
      })),
    addons: addons
      .filter((addon) => addon.name?.trim())
      .map((addon) => ({ name: addon.name.trim(), price: Number(addon.price ?? 0) || 0 })),
  });

  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  }
  const data = parsed.data;

  // Product limit from the subscription plan
  const planLimit = ctx.subscription?.plan_price != null
    ? (await systemDb.maybeOne<{ product_limit: number | null }>(
        `select product_limit from subscription_plans where id = $1`,
        [ctx.subscription.plan_id],
      ))?.product_limit ?? null
    : null;
  if (!productId && planLimit != null) {
    const count = await systemDb.one<{ count: number }>(
      `select count(*)::int as count from products where store_id = $1`,
      [ctx.store.id],
    );
    if (count.count >= planLimit) {
      return { error: `Your plan allows up to ${planLimit} products. Upgrade your subscription to add more.` };
    }
  }

  try {
    const slug = await ensureUniqueProductSlug(ctx.store.id, data.name, productId ?? undefined);

    const preUploadedUrls = (formData.getAll("uploadedImageUrls") as string[])
      .map((value) => String(value).trim())
      .filter(Boolean);
    const fileEntries = formData
      .getAll("imageFiles")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const uploaded: string[] = [...preUploadedUrls];
    for (const file of fileEntries.slice(0, Math.max(0, 10 - uploaded.length))) {
      uploaded.push(await uploadImage(file, `stores/${ctx.store.slug}/products`));
    }
    const imageUrls = (formData.getAll("imageUrls") as string[])
      .map((value) => String(value).trim())
      .filter(Boolean)
      .slice(0, 10);
    const combinedNewImages = Array.from(new Set([...uploaded, ...imageUrls])).slice(0, 10);

    const savedId = await withActor(
      { id: ctx.user.id, role: "vendor", email: ctx.user.email },
      async (db) => {
        let id = productId;
        const values = [
          ctx.store.id,
          data.categoryId && data.categoryId !== "" ? data.categoryId : null,
          data.name,
          slug,
          data.sku || null,
          data.kind,
          data.description || null,
          data.shortDescription || null,
          data.price,
          data.compareAtPrice ?? null,
          data.pricingType,
          data.trackStock,
          data.stockQuantity,
          data.isAvailable,
          data.isFeatured,
          data.condition ? data.condition : null,
          data.brand || null,
          data.model || null,
          data.warrantyInfo || null,
          data.warrantyMonths ?? null,
          JSON.stringify(data.specifications),
          JSON.stringify(data.attributes),
          data.madeToOrder,
          data.productionDays ?? null,
          data.prepTimeMinutes ?? null,
          data.portion || null,
          data.serviceDurationMinutes ?? null,
        ];

        if (id) {
          await db.execute(
            `update products set category_id=$2, name=$3, slug=$4, sku=$5, kind=$6, description=$7,
                    short_description=$8, price=$9, compare_at_price=$10, pricing_type=$11, track_stock=$12,
                    stock_quantity=$13, is_available=$14, is_featured=$15, condition=$16, brand=$17, model=$18,
                    warranty_info=$19, warranty_months=$20, specifications=$21::jsonb, attributes=$22::jsonb,
                    made_to_order=$23, production_days=$24, prep_time_minutes=$25, portion=$26,
                    service_duration_minutes=$27
              where id=$1 and store_id=$28`,
            [id, ...values.slice(1), ctx.store.id],
          );
          // remove variants/addons then re-create (simple, predictable)
          await db.execute(`delete from product_variants where product_id = $1`, [id]);
          await db.execute(`delete from product_addons where product_id = $1`, [id]);
        } else {
          const inserted = await db.one<{ id: string }>(
            `insert into products
               (store_id, category_id, name, slug, sku, kind, description, short_description, price,
                compare_at_price, pricing_type, track_stock, stock_quantity, is_available, is_featured,
                condition, brand, model, warranty_info, warranty_months, specifications, attributes,
                made_to_order, production_days, prep_time_minutes, portion, service_duration_minutes)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23,$24,$25,$26,$27)
             returning id`,
            values,
          );
          id = inserted.id;
        }

        if (!id) throw new Error("Product could not be saved");

        for (const [index, variant] of data.variants.entries()) {
          await db.execute(
            `insert into product_variants (product_id, name, price, stock_quantity, attributes, is_available, sort_order)
             values ($1,$2,$3,$4,$5::jsonb,true,$6)`,
            [id, variant.name, variant.price ?? null, variant.stockQuantity, JSON.stringify(variant.attributes), index],
          );
        }
        for (const [index, addon] of data.addons.entries()) {
          await db.execute(
            `insert into product_addons (product_id, name, price, sort_order) values ($1,$2,$3,$4)`,
            [id, addon.name, addon.price, index],
          );
        }

        if (productId) {
          const removed = formData.getAll("removeImage") as string[];
          for (const imageId of removed) {
            await db.execute(`delete from product_images where id = $1 and product_id = $2`, [imageId, id]);
          }
          const existingCount = await db.one<{ count: number }>(
            `select count(*)::int as count from product_images where product_id = $1`,
            [id],
          );
          let offset = existingCount.count;
          for (const imageUrl of combinedNewImages) {
            await db.execute(
              `insert into product_images (product_id, url, alt, sort_order) values ($1,$2,$3,$4)`,
              [id, imageUrl, data.name, offset],
            );
            offset += 1;
          }
        } else {
          const allImages = [...combinedNewImages];
          if (allImages.length === 0) allImages.push("/images/seed/product-jollof.svg");
          for (const [index, imageUrl] of allImages.entries()) {
            await db.execute(
              `insert into product_images (product_id, url, alt, sort_order) values ($1,$2,$3,$4)`,
              [id, imageUrl, data.name, index],
            );
          }
        }

        await logActivity(
          {
            actorId: ctx.user.id,
            actorRole: "vendor",
            storeId: ctx.store.id,
            action: productId ? "product.updated" : "product.created",
            entityType: "product",
            entityId: id,
            description: `${productId ? "Updated" : "Created"} ${data.name}`,
            meta: { price: data.price, kind: data.kind },
          },
          db,
        );
        return id;
      },
    );

    revalidatePath("/vendor");
    revalidatePath("/vendor/products");
    revalidatePath(`/vendor/products/${savedId}`);
    revalidatePath(`/s/${ctx.store.slug}`, "layout");
    revalidatePath(`/s/${ctx.store.slug}/products`);
    revalidatePath("/browse");
    revalidatePath("/");
    redirect(`/vendor/products/${savedId}?saved=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "Product could not be saved" };
  }
}

export async function deleteProductAction(formData: FormData) {
  const ctx = await getVendorContext();
  if (ctx.isSubscriptionExpired || ctx.isManuallySuspended) {
    redirect("/vendor/subscription?suspended=1");
  }
  const productId = String(formData.get("productId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const deleted = productId
    ? await deleteProductCompletely({
        productId,
        storeId: ctx.store.id,
        actorId: ctx.user.id,
        actorRole: "vendor",
      })
    : null;

  revalidateTag("announcements");
  revalidateTag("categories");
  revalidatePath("/", "layout");
  revalidatePath("/browse");
  revalidatePath("/stores");
  revalidatePath(`/s/${ctx.store.slug}`, "layout");
  revalidatePath(`/s/${ctx.store.slug}/products`);
  if (deleted?.productSlug) {
    revalidatePath(`/s/${ctx.store.slug}/products/${deleted.productSlug}`);
  }
  revalidatePath("/vendor");
  revalidatePath("/vendor/products");
  revalidatePath("/admin");
  revalidatePath(`/admin/vendors/${ctx.store.id}`);

  redirect(redirectTo.startsWith("/vendor/products") ? redirectTo : "/vendor/products?deleted=1");
}

export async function deleteOwnStoreAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const confirmText = String(formData.get("confirmStoreName") ?? "").trim();
  if (
    confirmText.toLowerCase() !== ctx.store.name.trim().toLowerCase() &&
    confirmText.toLowerCase() !== ctx.store.slug.trim().toLowerCase()
  ) {
    return {
      error: `Type "${ctx.store.name}" (or "${ctx.store.slug}") to confirm permanent storefront deletion.`,
    };
  }

  const deleted = await deleteStoreCompletely({
    storeId: ctx.store.id,
    actorId: ctx.user.id,
    actorRole: "vendor",
    reason: "Deleted by storefront owner",
  });
  if (!deleted) {
    return { error: "Storefront could not be found." };
  }

  const remainingStore = await systemDb.maybeOne<{ id: string }>(
    `select id from stores where owner_id = $1 limit 1`,
    [ctx.user.id],
  );
  if (!remainingStore && ctx.user.role === "vendor") {
    const token = await createSessionToken({
      sub: ctx.user.id,
      email: ctx.user.email,
      role: "customer",
      name: ctx.user.fullName,
    });
    await setSessionCookie(token);
  }

  revalidateTag("announcements");
  revalidateTag("categories");
  revalidatePath("/", "layout");
  revalidatePath("/browse");
  revalidatePath("/stores");
  revalidatePath(`/s/${deleted.storeSlug}`, "layout");
  revalidatePath("/vendor");
  revalidatePath("/admin");
  revalidatePath("/admin/vendors");
  revalidatePath("/admin/messages");

  redirect(remainingStore ? "/vendor" : "/?storeDeleted=1");
}

export async function toggleProductAvailabilityAction(formData: FormData) {
  const ctx = await getVendorContext();
  if (vendorSuspensionMessage(ctx)) redirect("/vendor/subscription?suspended=1");
  const productId = String(formData.get("productId") ?? "");
  const available = formData.get("available") === "true";
  await withActor({ id: ctx.user.id, role: "vendor", email: ctx.user.email }, async (db) => {
    await db.execute(`update products set is_available = $3 where id = $1 and store_id = $2`, [productId, ctx.store.id, available]);
  });
  revalidatePath("/vendor/products");
  revalidatePath(`/s/${ctx.store.slug}`);
}

export async function createProductCategoryAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const lockError = vendorSuspensionMessage(ctx);
  if (lockError) return { error: lockError };
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter a category name" };
  await withActor({ id: ctx.user.id, role: "vendor", email: ctx.user.email }, async (db) => {
    await db.execute(
      `insert into product_categories (store_id, name, slug) values ($1,$2,$3)
       on conflict (store_id, slug) do nothing`,
      [ctx.store.id, name, toSlug(name)],
    );
  });
  revalidatePath("/vendor/categories");
  return { message: `Added “${name}”.` };
}

export async function deleteProductCategoryAction(formData: FormData) {
  const ctx = await getVendorContext();
  if (vendorSuspensionMessage(ctx)) redirect("/vendor/subscription?suspended=1");
  const categoryId = String(formData.get("categoryId") ?? "");
  await withActor({ id: ctx.user.id, role: "vendor", email: ctx.user.email }, async (db) => {
    await db.execute(`delete from product_categories where id = $1 and store_id = $2`, [categoryId, ctx.store.id]);
  });
  revalidatePath("/vendor/categories");
}

/* -------------------------------------------------------------------------- */
/* Store settings                                                             */
/* -------------------------------------------------------------------------- */

export async function saveStoreSettingsAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const lockError = vendorSuspensionMessage(ctx);
  if (lockError) return { error: lockError };
  const parsed = storeSettingsSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline") ?? "",
    description: formData.get("description") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    website: formData.get("website") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? AKWA_IBOM_STATE,
    acceptsDelivery: formData.get("acceptsDelivery") === "on",
    acceptsPickup: formData.get("acceptsPickup") === "on",
    acceptsOrders: formData.get("acceptsOrders") === "on",
    deliveryFee: formData.get("deliveryFee") || 0,
    minimumOrder: formData.get("minimumOrder") || 0,
    deliveryAreas: formData.get("deliveryAreas") ?? "",
    prepTimeMinutes: formData.get("prepTimeMinutes") || 30,
    logoUrl: formData.get("logoUrl") ?? "",
    coverUrl: formData.get("coverUrl") ?? "",
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  const data = parsed.data;
  const cleanTitle = data.name.trim().replace(/\s+/g, " ");
  const takenStore = await systemDb.maybeOne<{ id: string; name: string }>(
    `select id, name from stores
      where lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) = $1
        and id <> $2
      limit 1`,
    [normaliseBusinessName(cleanTitle), ctx.store.id],
  );
  if (takenStore) {
    const lockMsg = `Business name “${takenStore.name}” is already in use and locked by another vendor. Please choose a unique business name.`;
    return { error: lockMsg, fieldErrors: { name: lockMsg } };
  }

  const hours: Record<string, { open: string; close: string; closed: boolean }> = {};
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
    hours[day] = {
      open: String(formData.get(`hours_${day}_open`) ?? "09:00"),
      close: String(formData.get(`hours_${day}_close`) ?? "18:00"),
      closed: formData.get(`hours_${day}_closed`) === "on",
    };
  }

  try {
    let logoUrl = data.logoUrl ?? "";
    let coverUrl = data.coverUrl ?? "";
    const logoFile = formData.get("logoFile");
    const coverFile = formData.get("coverFile");
    if (logoFile instanceof File && logoFile.size > 0) logoUrl = await uploadImage(logoFile, `stores/${ctx.store.slug}/brand`);
    if (coverFile instanceof File && coverFile.size > 0) coverUrl = await uploadImage(coverFile, `stores/${ctx.store.slug}/brand`);

    await withActor({ id: ctx.user.id, role: "vendor", email: ctx.user.email }, async (db) => {
      await db.execute(
        `update stores set name=$2, tagline=$3, description=$4, email=$5, phone=$6, whatsapp=$7, website=$8,
                address=$9, city=$10, state=$11, accepts_delivery=$12, accepts_pickup=$13, accepts_orders=$14,
                delivery_fee=$15, minimum_order=$16, delivery_areas=$17, prep_time_minutes=$18,
                logo_url=coalesce(nullif($19,''), logo_url), cover_url=coalesce(nullif($20,''), cover_url),
                operating_hours=$21::jsonb
          where id=$1`,
        [
          ctx.store.id,
          cleanTitle,
          data.tagline || null,
          data.description || null,
          data.email || null,
          data.phone || null,
          data.whatsapp || null,
          data.website || null,
          data.address || null,
          data.city || null,
          data.state || null,
          data.acceptsDelivery,
          data.acceptsPickup,
          data.acceptsOrders,
          data.deliveryFee,
          data.minimumOrder,
          data.deliveryAreas || null,
          data.prepTimeMinutes,
          logoUrl,
          coverUrl,
          JSON.stringify(hours),
        ],
      );
      await logActivity(
        { actorId: ctx.user.id, actorRole: "vendor", storeId: ctx.store.id, action: "store.updated", entityType: "store", entityId: ctx.store.id },
        db,
      );
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const lockMsg =
        "That business name is already in use and locked by another vendor. Please choose a unique business name.";
      return { error: lockMsg, fieldErrors: { name: lockMsg } };
    }
    return { error: error instanceof Error ? error.message : "Settings could not be saved" };
  }

  revalidatePath("/vendor/store");
  revalidatePath(`/s/${ctx.store.slug}`);
  return { message: "Store settings saved." };
}

export async function saveVendorKycAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  if (ctx.isSubscriptionExpired || ctx.isManuallySuspended) {
    return { error: vendorSuspensionMessage(ctx) ?? "Account suspended." };
  }

  const proofFile = formData.get("proofOfResidenceFile");
  const hasFile = proofFile instanceof File && proofFile.size > 0;
  let proofUrl = String(formData.get("proofOfResidenceUrl") ?? "").trim();

  const parsed = vendorKycSchema.safeParse({
    nin: formData.get("nin") ?? "",
    proofOfResidenceType: formData.get("proofOfResidenceType") ?? "",
    proofOfResidenceUrl: proofUrl || (hasFile ? "pending-upload" : ""),
    cacRegistered: formData.get("cacRegistered") ?? "no",
    cacNumber: formData.get("cacNumber") ?? "",
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted KYC fields", fieldErrors: formatIssues(parsed.error) };
  }

  try {
    if (hasFile) {
      proofUrl = await uploadVerificationDocument(proofFile, "vendor-kyc");
    }
    const cacRegistered = parsed.data.cacRegistered === "yes";
    const cacNumber = cacRegistered ? (parsed.data.cacNumber ?? "").trim().toUpperCase() : null;

    await systemDb.execute(
      `insert into vendor_profiles
         (user_id, position, nin, proof_of_residence_type, proof_of_residence_url, cac_registered, cac_number, kyc_status)
       values ($1, 'Owner', $2, $3, $4, $5, $6, 'submitted')
       on conflict (user_id) do update set
         nin = excluded.nin,
         proof_of_residence_type = excluded.proof_of_residence_type,
         proof_of_residence_url = excluded.proof_of_residence_url,
         cac_registered = excluded.cac_registered,
         cac_number = excluded.cac_number,
         kyc_status = case when vendor_profiles.kyc_status = 'verified' then 'verified' else 'submitted' end`,
      [ctx.user.id, parsed.data.nin, parsed.data.proofOfResidenceType, proofUrl, cacRegistered, cacNumber],
    );

    await logActivity({
      actorId: ctx.user.id,
      actorRole: "vendor",
      storeId: ctx.store.id,
      action: "vendor.kyc_updated",
      entityType: "store",
      entityId: ctx.store.id,
      description: `${ctx.store.name} updated identity, proof of residence, and CAC details`,
    });

    if (ctx.store.status === "rejected") {
      await resubmitStoreForReview(ctx.store.id);
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Verification details could not be saved" };
  }

  revalidatePath("/vendor");
  revalidatePath("/vendor/store");
  revalidatePath("/admin");
  revalidatePath("/admin/messages");
  revalidatePath(`/admin/vendors/${ctx.store.id}`);
  return {
    message:
      ctx.store.status === "rejected"
        ? "Verification documents updated and re-submitted for 48-hour admin review."
        : "Identity, residence & CAC verification details saved.",
  };
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export async function vendorOrderAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const orderId = String(formData.get("orderId") ?? "");
  const action = String(formData.get("action") ?? "");
  try {
    await updateOrderByVendor({
      orderId,
      action: action as Parameters<typeof updateOrderByVendor>[0]["action"],
      note: String(formData.get("note") ?? "") || undefined,
      eta: String(formData.get("eta") ?? "") || undefined,
      dispatchEta: String(formData.get("dispatchEta") ?? "") || undefined,
      deliveryEta: String(formData.get("deliveryEta") ?? "") || undefined,
      productionProgress: formData.get("productionProgress") ? Number(formData.get("productionProgress")) : undefined,
      trackingCarrier: String(formData.get("trackingCarrier") ?? "") || undefined,
      trackingNumber: String(formData.get("trackingNumber") ?? "") || undefined,
      dispatchRiderName: String(formData.get("dispatchRiderName") ?? "") || undefined,
      dispatchRiderPhone: String(formData.get("dispatchRiderPhone") ?? "") || undefined,
      deliveryPin: String(formData.get("deliveryPin") ?? "") || undefined,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Order could not be updated" };
  }
  revalidatePath(`/vendor/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/vendor/orders");
  revalidatePath("/vendor");
  return {
    message:
      action === "deliver" || action === "complete"
        ? "Customer Delivery PIN verified — order completed and payout released to your available balance."
        : "Order updated and the customer has been notified.",
  };
}

/* -------------------------------------------------------------------------- */
/* Quotations & bookings                                                      */
/* -------------------------------------------------------------------------- */

export async function respondQuotationAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const lockError = vendorSuspensionMessage(ctx);
  if (lockError) return { error: lockError };
  const parsed = quotationResponseSchema.safeParse({
    quotationId: formData.get("quotationId"),
    amount: formData.get("amount"),
    note: formData.get("note") ?? "",
    validDays: formData.get("validDays") || 7,
  });
  if (!parsed.success) return { error: "Check the quotation details", fieldErrors: formatIssues(parsed.error) };

  const quotation = await systemDb.maybeOne<{
    id: string;
    customer_email: string;
    customer_name: string;
    title: string;
    status: string;
  }>(`select id, customer_email, customer_name, title, status from service_quotations where id = $1 and store_id = $2`, [
    parsed.data.quotationId,
    ctx.store.id,
  ]);
  if (!quotation) return { error: "Quotation not found" };
  if (quotation.status === "accepted") return { error: "This quotation has already been accepted" };

  try {
    await withActor({ id: ctx.user.id, role: "vendor", email: ctx.user.email }, async (db) => {
      await db.execute(
        `update service_quotations set quoted_amount=$3, quote_note=$4, valid_until = now() + make_interval(days => $5),
                status='quoted', responded_at=now()
          where id=$1 and store_id=$2`,
        [quotation.id, ctx.store.id, parsed.data.amount, parsed.data.note || null, parsed.data.validDays],
      );
      await logActivity(
        {
          actorId: ctx.user.id,
          actorRole: "vendor",
          storeId: ctx.store.id,
          action: "quotation.quoted",
          entityType: "quotation",
          entityId: quotation.id,
          meta: { amount: parsed.data.amount },
        },
        db,
      );
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Quotation could not be saved" };
  }

  const settings = await getSettings();
  await sendEmail({
    to: quotation.customer_email,
    template: "quote_sent",
    data: {
      name: quotation.customer_name,
      storeName: ctx.store.name,
      quoteAmount: parsed.data.amount,
      currency: settings.currency,
      note: parsed.data.note,
      expiresAt: new Date(Date.now() + parsed.data.validDays * 86_400_000).toDateString(),
    },
    dedupeKey: `quote-sent:${quotation.id}:${parsed.data.amount}`,
  });

  revalidatePath("/vendor/quotations");
  return { message: "Quotation sent to the customer." };
}

export async function bookingAction(formData: FormData) {
  const ctx = await getVendorContext();
  if (vendorSuspensionMessage(ctx)) redirect("/vendor/subscription?suspended=1");
  const bookingId = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["confirmed", "completed", "cancelled", "rescheduled", "no_show"].includes(status)) return;

  const booking = await systemDb.maybeOne<{
    id: string;
    customer_email: string;
    customer_name: string;
    scheduled_date: string;
    scheduled_time: string;
    product_id: string | null;
    order_id: string | null;
  }>(`select id, customer_email, customer_name, scheduled_date, scheduled_time, product_id, order_id from service_bookings where id = $1 and store_id = $2`, [bookingId, ctx.store.id]);
  if (!booking) return;

  await withActor({ id: ctx.user.id, role: "vendor", email: ctx.user.email }, async (db) => {
    await db.execute(`update service_bookings set status = $3 where id = $1 and store_id = $2`, [bookingId, ctx.store.id, status]);
    await logActivity(
      { actorId: ctx.user.id, actorRole: "vendor", storeId: ctx.store.id, action: `booking.${status}`, entityType: "booking", entityId: bookingId },
      db,
    );
  });

  if (status === "confirmed") {
    await sendEmail({
      to: booking.customer_email,
      template: "booking_confirmed",
      data: {
        name: booking.customer_name,
        storeName: ctx.store.name,
        scheduledFor: `${booking.scheduled_date} at ${booking.scheduled_time}`,
        orderReference: booking.id.slice(0, 8).toUpperCase(),
      },
      dedupeKey: `booking-confirmed:${booking.id}`,
    });
  }
  await notify({
    userId: null,
    storeId: ctx.store.id,
    type: "booking_update",
    title: `Booking ${status}`,
    body: `${booking.customer_name} · ${booking.scheduled_date} ${booking.scheduled_time}`,
    actionUrl: "/vendor/bookings",
    dedupeKey: `booking-${status}:${booking.id}`,
  });
  revalidatePath("/vendor/bookings");
}

/* -------------------------------------------------------------------------- */
/* Reviews & messages                                                         */
/* -------------------------------------------------------------------------- */

export async function respondReviewAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const lockError = vendorSuspensionMessage(ctx);
  if (lockError) return { error: lockError };
  const reviewId = String(formData.get("reviewId") ?? "");
  const response = String(formData.get("response") ?? "").trim();
  if (response.length < 3) return { error: "Write a short response first" };
  if (response.length > 1500) return { error: "Response is too long" };

  try {
    await withActor({ id: ctx.user.id, role: "vendor", email: ctx.user.email }, async (db) => {
      await db.execute(
        `update reviews set vendor_response = $3, vendor_responded_at = now() where id = $1 and store_id = $2`,
        [reviewId, ctx.store.id, response],
      );
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save response" };
  }
  revalidatePath("/vendor/reviews");
  return { message: "Response published." };
}

export async function replyMessageAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const lockError = vendorSuspensionMessage(ctx);
  if (lockError) return { error: lockError };
  const messageId = String(formData.get("messageId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) return { error: "Write a reply first" };

  const original = await systemDb.maybeOne<{ id: string; sender_email: string; subject: string }>(
    `select id, sender_email, subject from customer_messages where id = $1 and store_id = $2`,
    [messageId, ctx.store.id],
  );
  if (!original) return { error: "Message not found" };

  await withActor({ id: ctx.user.id, role: "vendor", email: ctx.user.email }, async (db) => {
    await db.execute(
      `insert into customer_messages (store_id, customer_id, sender_name, sender_email, sender_role, category, subject, body, parent_id, status)
       values ($1,null,$2,$3,'vendor','inquiry',$4,$5,$6,'awaiting_customer')`,
      [ctx.store.id, ctx.store.name, ctx.store.email ?? ctx.user.email, `Re: ${original.subject}`, body, original.id],
    );
    await db.execute(`update customer_messages set status = 'awaiting_customer' where id = $1`, [original.id]);
  });

  await sendEmail({
    to: original.sender_email,
    template: "message_received",
    data: { name: "there", email: ctx.store.email ?? "", storeName: ctx.store.name, subject: `Re: ${original.subject}`, message: body },
    dedupeKey: `vendor-reply:${original.id}:${Date.now()}`,
  });

  revalidatePath("/vendor/messages");
  return { message: "Reply sent." };
}

/* -------------------------------------------------------------------------- */
/* Subscription                                                               */
/* -------------------------------------------------------------------------- */

export async function purchaseSubscriptionAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const planId = String(formData.get("planId") ?? "");
  const plans = await getPlans();
  const plan = plans.find((item) => item.id === planId);
  if (!plan) return { error: "Choose a valid plan" };

  try {
    const result = await purchaseSubscription({
      store: ctx.store,
      plan,
      payerEmail: ctx.user.email,
      payerUserId: ctx.user.id,
    });
    if (result.activated) {
      revalidatePath("/vendor/subscription");
      revalidatePath("/vendor");
      return { message: "Subscription activated." };
    }
    return { redirectUrl: result.authorizationUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start the subscription payment" };
  }
}

export async function markNotificationsReadAction() {
  const user = await getCurrentUser();
  if (!user) return;
  await systemDb.execute(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [user.id]);
  revalidatePath("/vendor");
  revalidatePath("/account");
}

/* -------------------------------------------------------------------------- */
/* Settlement Bank Account & Payout Withdrawals                               */
/* -------------------------------------------------------------------------- */

export async function saveVendorBankAccountAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const parsed = vendorBankAccountSchema.safeParse({
    bankName: formData.get("bankName") ?? "",
    accountNumber: formData.get("accountNumber") ?? "",
    accountName: formData.get("accountName") ?? "",
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted bank account fields", fieldErrors: formatIssues(parsed.error) };
  }

  try {
    await systemDb.execute(
      `insert into vendor_profiles (user_id, position, bank_name, account_number, account_name)
       values ($1, 'Owner', $2, $3, $4)
       on conflict (user_id) do update
         set bank_name = excluded.bank_name,
             account_number = excluded.account_number,
             account_name = excluded.account_name,
             updated_at = now()`,
      [ctx.user.id, parsed.data.bankName, parsed.data.accountNumber, parsed.data.accountName],
    );

    await logActivity({
      actorId: ctx.user.id,
      actorRole: "vendor",
      storeId: ctx.store.id,
      action: "vendor.bank_account_updated",
      entityType: "store",
      entityId: ctx.store.id,
      description: `${ctx.store.name} saved payout bank account (${parsed.data.bankName} · ${parsed.data.accountNumber})`,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save bank account details" };
  }

  revalidatePath("/vendor");
  revalidatePath("/vendor/payouts");
  revalidatePath("/vendor/store");
  revalidatePath(`/admin/vendors/${ctx.store.id}`);
  revalidatePath("/admin/payments");
  return { message: "Payout bank account saved." };
}

export async function requestVendorPayoutAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const ctx = await getVendorContext();
  const lockError = vendorSuspensionMessage(ctx);
  if (lockError) return { error: lockError };

  const rawAmount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!Number.isFinite(rawAmount) || rawAmount < 500) {
    return { error: "Minimum payout withdrawal is ₦500." };
  }
  const amount = Math.round(rawAmount * 100) / 100;

  const bank = await systemDb.maybeOne<{
    bank_name: string | null;
    account_number: string | null;
    account_name: string | null;
  }>(
    `select bank_name, account_number, account_name from vendor_profiles where user_id = $1`,
    [ctx.user.id],
  );
  if (!bank?.bank_name || !bank?.account_number || !bank?.account_name) {
    return { error: "Save your Nigerian bank account details first before requesting a payout." };
  }

  try {
    await withSystem(async (db) => {
      await db.execute(
        `insert into vendor_balances (store_id) values ($1) on conflict (store_id) do nothing`,
        [ctx.store.id],
      );
      const balance = await db.one<{ available_amount: number }>(
        `select available_amount::float8 as available_amount
           from vendor_balances
          where store_id = $1
          for update`,
        [ctx.store.id],
      );
      if (Number(balance.available_amount) < amount) {
        throw new Error(
          `Insufficient unlocked balance. Available for payout: ₦${Number(balance.available_amount).toLocaleString()}.`,
        );
      }

      await db.execute(
        `update vendor_balances
            set available_amount = available_amount - $2,
                updated_at = now()
          where store_id = $1`,
        [ctx.store.id, amount],
      );

      const payout = await db.one<{ id: string }>(
        `insert into vendor_payouts
           (store_id, amount, status, method, bank_name, account_number, account_name, notes)
         values ($1, $2, 'pending', 'bank_transfer', $3, $4, $5, $6)
         returning id`,
        [ctx.store.id, amount, bank.bank_name, bank.account_number, bank.account_name, note],
      );

      await logActivity(
        {
          actorId: ctx.user.id,
          actorRole: "vendor",
          storeId: ctx.store.id,
          action: "vendor.payout_requested",
          entityType: "payout",
          entityId: payout.id,
          description: `${ctx.store.name} requested payout of ₦${amount.toLocaleString()} to ${bank.bank_name} (${bank.account_number})`,
        },
        db,
      );

      await notifyAdmins(
        {
          storeId: ctx.store.id,
          type: "payout_requested",
          title: `Payout Request: ₦${amount.toLocaleString()} — ${ctx.store.name}`,
          body: `Transfer to ${bank.bank_name} · ${bank.account_number} (${bank.account_name}). Review & settle in Admin Payments.`,
          actionUrl: "/admin/payments",
          dedupeKey: `payout-req:${payout.id}`,
        },
        db,
      );
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not submit payout request" };
  }

  revalidatePath("/vendor");
  revalidatePath("/vendor/payouts");
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/vendors/${ctx.store.id}`);
  return {
    message: `Payout request for ₦${amount.toLocaleString()} submitted! Funds will be transferred to ${bank.bank_name} (${bank.account_number}).`,
  };
}
