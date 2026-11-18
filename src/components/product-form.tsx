"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { saveProductAction, type VendorState } from "@/app/actions/vendor";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { CategoryAttribute, CategoryFeatures } from "@/lib/types";

export interface EditableVariant {
  id?: string;
  name: string;
  price: string;
  stockQuantity: string;
  attributes?: Record<string, string>;
}

export interface EditableProduct {
  id?: string;
  name: string;
  description: string;
  shortDescription: string;
  kind: string;
  categoryId: string;
  price: string;
  compareAtPrice: string;
  pricingType: string;
  sku: string;
  trackStock: boolean;
  stockQuantity: string;
  isAvailable: boolean;
  isFeatured: boolean;
  condition: string;
  brand: string;
  model: string;
  warrantyInfo: string;
  warrantyMonths: string;
  madeToOrder: boolean;
  productionDays: string;
  prepTimeMinutes: string;
  portion: string;
  serviceDurationMinutes: string;
  attributes: Record<string, string>;
  specifications: Record<string, string>;
  variants: EditableVariant[];
  addons: Array<{ name: string; price: string }>;
  images: Array<{ id: string; url: string }>;
}

async function compressProductImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.size <= 1_200_000) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1800;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "product";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function uploadSingleProductImage(file: File): Promise<string> {
  const prepared = await compressProductImage(file);
  const body = new FormData();
  body.set("file", prepared);
  body.set("folder", "products");
  const res = await fetch("/api/upload", { method: "POST", body });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Image upload failed");
  }
  return data.url;
}

export function ProductForm({
  product,
  categoryName,
  attributes,
  features,
  categories,
}: {
  product: EditableProduct;
  categoryName: string | null;
  attributes: CategoryAttribute[];
  features: CategoryFeatures;
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState<VendorState, FormData>(saveProductAction, {});

  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [shortDescription, setShortDescription] = useState(product.shortDescription);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(product.price || "");
  const [compareAtPrice, setCompareAtPrice] = useState(product.compareAtPrice);
  const [pricingType, setPricingType] = useState(product.pricingType || "fixed");
  const [sku, setSku] = useState(product.sku);
  const [stockQuantity, setStockQuantity] = useState(product.stockQuantity || "0");
  const [trackStock, setTrackStock] = useState(product.trackStock);
  const [isAvailable, setIsAvailable] = useState(product.isAvailable);
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [condition, setCondition] = useState(product.condition);
  const [brand, setBrand] = useState(product.brand);
  const [model, setModel] = useState(product.model);
  const [warrantyMonths, setWarrantyMonths] = useState(product.warrantyMonths);
  const [warrantyInfo, setWarrantyInfo] = useState(product.warrantyInfo);
  const [productionDays, setProductionDays] = useState(product.productionDays);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(product.prepTimeMinutes);
  const [portion, setPortion] = useState(product.portion);
  const [serviceDurationMinutes, setServiceDurationMinutes] = useState(product.serviceDurationMinutes);

  const [attributeValues, setAttributeValues] = useState<Record<string, string>>(product.attributes ?? {});
  const [specs, setSpecs] = useState<Array<{ key: string; value: string }>>(
    Object.entries(product.specifications ?? {}).map(([key, value]) => ({ key, value })),
  );
  const [variants, setVariants] = useState<EditableVariant[]>(product.variants.length ? product.variants : []);
  const [addons, setAddons] = useState<Array<{ name: string; price: string }>>(product.addons ?? []);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<Array<{ url: string; name: string }>>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [kind, setKind] = useState(product.kind || "product");
  const [madeToOrder, setMadeToOrder] = useState(product.madeToOrder);

  const specsJson = JSON.stringify(
    Object.fromEntries(specs.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value.trim()])),
  );

  const keptExistingCount = product.images.filter((img) => !removedImages.includes(img.id)).length;

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploadError("");
    const remainingSlots = Math.max(0, 10 - (keptExistingCount + uploadedImages.length));
    const files = Array.from(fileList).slice(0, remainingSlots);
    if (files.length === 0) {
      setUploadError("Maximum of 10 images reached per product.");
      return;
    }

    setUploadingCount(files.length);
    for (const file of files) {
      try {
        const url = await uploadSingleProductImage(file);
        setUploadedImages((prev) => [...prev, { url, name: file.name }]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : `Could not upload ${file.name}`);
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={product.id ?? ""} />
      <input type="hidden" name="isAvailablePresent" value="1" />
      <input type="hidden" name="attributesJson" value={JSON.stringify(attributeValues)} />
      <input type="hidden" name="specificationsJson" value={specsJson} />
      <input type="hidden" name="variantsJson" value={JSON.stringify(variants)} />
      <input type="hidden" name="addonsJson" value={JSON.stringify(addons)} />
      {uploadedImages.map((item, idx) => (
        <input key={`${item.url}-${idx}`} type="hidden" name="uploadedImageUrls" value={item.url} />
      ))}
      {imageUrls
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => <input key={`${line}-${index}`} type="hidden" name="imageUrls" value={line} />)}

      {state.error ? <Alert tone="danger" title="Could not save">{state.error}</Alert> : null}
      {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 ? (
        <Alert tone="warning" title="Check these fields">
          <ul className="list-disc pl-4">
            {Object.entries(state.fieldErrors).map(([field, message]) => (
              <li key={field}>{field}: {message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card card-pad space-y-4">
            <h2 className="text-base font-semibold text-ink-900">Basics</h2>
            <Field label="Name" htmlFor="name" required error={state.fieldErrors?.name}>
              <input
                id="name"
                name="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={160}
                placeholder="e.g. Ankara wrap dress"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Offering type" htmlFor="kind" hint="Choose a service to show Book now instead of a shopping cart. Customers can request a visit or come to your office / studio.">
                <select id="kind" name="kind" className="select" value={kind} onChange={(event) => setKind(event.target.value)}>
                  <option value="product">Product</option>
                  <option value="service">Professional service — Book now</option>
                </select>
              </Field>
              <Field label="Store category" htmlFor="categoryId" hint={categoryName ? `Store category: ${categoryName}` : undefined}>
                <select
                  id="categoryId"
                  name="categoryId"
                  className="select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Short description" htmlFor="shortDescription" hint="One line shown on cards and search results.">
              <input
                id="shortDescription"
                name="shortDescription"
                className="input"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                maxLength={240}
              />
            </Field>
            <Field label="Full description" htmlFor="description">
              <textarea
                id="description"
                name="description"
                className="textarea min-h-40"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={6000}
                placeholder="Materials, sizing, what is included, care instructions…"
              />
            </Field>
          </section>

          <section className="card card-pad space-y-4">
            <h2 className="text-base font-semibold text-ink-900">Pricing &amp; availability</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Price (₦)" htmlFor="price" required error={state.fieldErrors?.price}>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </Field>
              <Field label="Compare-at price (₦)" htmlFor="compareAtPrice" hint="Optional, shown crossed out.">
                <input
                  id="compareAtPrice"
                  name="compareAtPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                />
              </Field>
              <Field label="Pricing label" htmlFor="pricingType">
                <select
                  id="pricingType"
                  name="pricingType"
                  className="select"
                  value={pricingType}
                  onChange={(e) => setPricingType(e.target.value)}
                >
                  <option value="fixed">Fixed price</option>
                  <option value="from">From (starting price)</option>
                  <option value="quotation">Request a quote</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU / code" htmlFor="sku">
                <input
                  id="sku"
                  name="sku"
                  className="input"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  maxLength={60}
                />
              </Field>
              <Field label="Stock quantity" htmlFor="stockQuantity">
                <input
                  id="stockQuantity"
                  name="stockQuantity"
                  type="number"
                  min="0"
                  className="input"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-ink-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="trackStock"
                  checked={trackStock}
                  onChange={(e) => setTrackStock(e.target.checked)}
                  className="size-4 rounded border-ink-300"
                />{" "}
                Track stock
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isAvailable"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="size-4 rounded border-ink-300"
                />{" "}
                Available for sale
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="size-4 rounded border-ink-300"
                />{" "}
                Feature on storefront
              </label>
            </div>
          </section>

          {features.warranty && kind === "product" ? (
            <section className="card card-pad space-y-4">
              <h2 className="text-base font-semibold text-ink-900">Product condition &amp; warranty</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Condition" htmlFor="condition">
                  <select id="condition" name="condition" className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                  </select>
                </Field>
                <Field label="Brand" htmlFor="brand">
                  <input id="brand" name="brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
                </Field>
                <Field label="Model" htmlFor="model">
                  <input id="model" name="model" className="input" value={model} onChange={(e) => setModel(e.target.value)} />
                </Field>
                <Field label="Warranty (months)" htmlFor="warrantyMonths">
                  <input id="warrantyMonths" name="warrantyMonths" type="number" min="0" className="input" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} />
                </Field>
              </div>
              <Field label="Warranty details" htmlFor="warrantyInfo">
                <input id="warrantyInfo" name="warrantyInfo" className="input" value={warrantyInfo} onChange={(e) => setWarrantyInfo(e.target.value)} placeholder="e.g. 6 months manufacturer warranty on internal faults" />
              </Field>
            </section>
          ) : null}

          {(kind === "service" || features.madeToOrder || features.productionTracking || features.prepTime || features.serviceBooking) ? (
            <section className="card card-pad space-y-4">
              <h2 className="text-base font-semibold text-ink-900">Fulfilment details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {features.madeToOrder || features.productionTracking ? (
                  <>
                    <label className="flex items-center gap-2 text-sm text-ink-700">
                      <input type="checkbox" name="madeToOrder" checked={madeToOrder} onChange={(event) => setMadeToOrder(event.target.checked)} className="size-4 rounded border-ink-300" />
                      Made to order
                    </label>
                    <Field label="Production days" htmlFor="productionDays" hint="How long you need to make each order.">
                      <input id="productionDays" name="productionDays" type="number" min="0" className="input" value={productionDays} onChange={(e) => setProductionDays(e.target.value)} disabled={!madeToOrder} />
                    </Field>
                  </>
                ) : null}
                {features.prepTime ? (
                  <>
                    <Field label="Preparation time (minutes)" htmlFor="prepTimeMinutes">
                      <input id="prepTimeMinutes" name="prepTimeMinutes" type="number" min="0" className="input" value={prepTimeMinutes} onChange={(e) => setPrepTimeMinutes(e.target.value)} />
                    </Field>
                    <Field label="Portion / serving" htmlFor="portion">
                      <input id="portion" name="portion" className="input" value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="e.g. Serves 2" />
                    </Field>
                  </>
                ) : null}
                {features.serviceBooking || kind === "service" ? (
                  <Field label="Service duration (minutes)" htmlFor="serviceDurationMinutes">
                    <input id="serviceDurationMinutes" name="serviceDurationMinutes" type="number" min="0" className="input" value={serviceDurationMinutes} onChange={(e) => setServiceDurationMinutes(e.target.value)} />
                  </Field>
                ) : null}
              </div>
            </section>
          ) : null}

          {attributes.length > 0 ? (
            <section className="card card-pad space-y-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Category details</h2>
                <p className="text-sm text-ink-500">Fields defined for {categoryName ?? "your category"} by the platform admin.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {attributes.map((attribute) => {
                  const value = attributeValues[attribute.key] ?? "";
                  const update = (next: string) => setAttributeValues((current) => ({ ...current, [attribute.key]: next }));
                  if (attribute.type === "boolean") {
                    return (
                      <label key={attribute.key} className="flex items-center gap-2 text-sm text-ink-700">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-ink-300"
                          checked={value === "true"}
                          onChange={(event) => update(event.target.checked ? "true" : "false")}
                        />
                        {attribute.label}
                      </label>
                    );
                  }
                  if (attribute.type === "select") {
                    return (
                      <Field key={attribute.key} label={attribute.label} htmlFor={`attr-${attribute.key}`} required={attribute.required}>
                        <select id={`attr-${attribute.key}`} className="select" value={value} onChange={(event) => update(event.target.value)}>
                          <option value="">Choose…</option>
                          {(attribute.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </Field>
                    );
                  }
                  if (attribute.type === "textarea") {
                    return (
                      <Field key={attribute.key} label={attribute.label} htmlFor={`attr-${attribute.key}`} required={attribute.required} className="sm:col-span-2">
                        <textarea id={`attr-${attribute.key}`} className="textarea" value={value} onChange={(event) => update(event.target.value)} />
                      </Field>
                    );
                  }
                  return (
                    <Field key={attribute.key} label={attribute.label} htmlFor={`attr-${attribute.key}`} required={attribute.required}>
                      <input
                        id={`attr-${attribute.key}`}
                        className="input"
                        type={attribute.type === "number" ? "number" : "text"}
                        value={value}
                        onChange={(event) => update(event.target.value)}
                      />
                    </Field>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="card card-pad space-y-4">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Specifications</h2>
              <p className="text-sm text-ink-500">Key details shown in a table on the product page.</p>
            </div>
            <div className="space-y-2">
              {specs.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Label (e.g. Material)"
                    value={row.key}
                    onChange={(event) => setSpecs((rows) => rows.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)))}
                  />
                  <input
                    className="input"
                    placeholder="Value"
                    value={row.value}
                    onChange={(event) => setSpecs((rows) => rows.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSpecs((rows) => rows.filter((_, i) => i !== index))} aria-label="Remove row">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSpecs((rows) => [...rows, { key: "", value: "" }])}>
              <Plus className="size-3.5" /> Add specification
            </button>
          </section>

          {features.variants ? (
            <section className="card card-pad space-y-3">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Variants</h2>
                <p className="text-sm text-ink-500">Sizes, colours or packages with their own price and stock.</p>
              </div>
              {variants.map((variant, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_7rem_auto]">
                  <input
                    className="input"
                    placeholder="Variant (e.g. Large / Navy)"
                    value={variant.name}
                    onChange={(event) => setVariants((rows) => rows.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="Price"
                    value={variant.price}
                    onChange={(event) => setVariants((rows) => rows.map((item, i) => (i === index ? { ...item, price: event.target.value } : item)))}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="Stock"
                    value={variant.stockQuantity}
                    onChange={(event) => setVariants((rows) => rows.map((item, i) => (i === index ? { ...item, stockQuantity: event.target.value } : item)))}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVariants((rows) => rows.filter((_, i) => i !== index))} aria-label="Remove variant">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVariants((rows) => [...rows, { name: "", price: "", stockQuantity: "0" }])}>
                <Plus className="size-3.5" /> Add variant
              </button>
            </section>
          ) : null}

          {features.addons ? (
            <section className="card card-pad space-y-3">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Add-ons</h2>
                <p className="text-sm text-ink-500">Optional extras customers can add, e.g. gift wrapping.</p>
              </div>
              {addons.map((addon, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Add-on name"
                    value={addon.name}
                    onChange={(event) => setAddons((rows) => rows.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))}
                  />
                  <input
                    className="input w-32"
                    type="number"
                    min="0"
                    placeholder="Price"
                    value={addon.price}
                    onChange={(event) => setAddons((rows) => rows.map((item, i) => (i === index ? { ...item, price: event.target.value } : item)))}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddons((rows) => rows.filter((_, i) => i !== index))} aria-label="Remove add-on">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddons((rows) => [...rows, { name: "", price: "" }])}>
                <Plus className="size-3.5" /> Add add-on
              </button>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="card card-pad space-y-3">
            <h2 className="text-base font-semibold text-ink-900">Images</h2>
            <p className="text-sm text-ink-500">Upload JPG, PNG or WebP (up to 10 MB each). The first image becomes the cover.</p>

            {(product.images.length > 0 || uploadedImages.length > 0) ? (
              <div className="grid grid-cols-2 gap-2">
                {product.images.map((image, idx) => {
                  const removed = removedImages.includes(image.id);
                  const isCover = !removed && idx === product.images.findIndex((i) => !removedImages.includes(i.id));
                  return (
                    <div key={image.id} className={`relative overflow-hidden rounded-xl border ${removed ? "border-red-300 opacity-40" : "border-ink-200"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt="" className="h-24 w-full object-cover" />
                      {isCover ? (
                        <span className="absolute left-1.5 top-1.5 rounded bg-brand-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Cover
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-ink-600 shadow-sm hover:bg-white"
                        onClick={() =>
                          setRemovedImages((current) =>
                            current.includes(image.id) ? current.filter((id) => id !== image.id) : [...current, image.id],
                          )
                        }
                        aria-label={removed ? "Keep image" : "Remove image"}
                      >
                        {removed ? <Plus className="size-3.5" /> : <X className="size-3.5" />}
                      </button>
                      {removed ? <input type="hidden" name="removeImage" value={image.id} /> : null}
                    </div>
                  );
                })}

                {uploadedImages.map((item, idx) => {
                  const isCover = keptExistingCount === 0 && idx === 0;
                  return (
                    <div key={`${item.url}-${idx}`} className="relative overflow-hidden rounded-xl border border-brand-300 bg-brand-50/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.name} className="h-24 w-full object-cover" />
                      {isCover ? (
                        <span className="absolute left-1.5 top-1.5 rounded bg-brand-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Cover
                        </span>
                      ) : (
                        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-700/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          <CheckCircle2 className="size-2.5" /> Ready
                        </span>
                      )}
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-ink-600 shadow-sm hover:bg-white"
                        onClick={() => setUploadedImages((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove uploaded image"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {uploadError ? <Alert tone="danger">{uploadError}</Alert> : null}

            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-3 py-6 text-center text-sm text-ink-600 transition hover:border-brand-500 hover:bg-brand-50/40">
              {uploadingCount > 0 ? (
                <>
                  <Loader2 className="size-5 animate-spin text-brand-700" />
                  <span className="font-medium text-brand-800">
                    Uploading {uploadingCount} image{uploadingCount > 1 ? "s" : ""}…
                  </span>
                </>
              ) : (
                <>
                  <ImagePlus className="size-5 text-brand-700" />
                  <span className="font-medium text-ink-800">
                    {uploadedImages.length + keptExistingCount > 0 ? "Add more images" : "Choose product images"}
                  </span>
                  <span className="text-xs text-ink-400">
                    {uploadedImages.length + keptExistingCount}/10 uploaded · JPG, PNG, WebP
                  </span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                disabled={uploadingCount > 0}
                onChange={async (e) => {
                  const files = e.target.files;
                  await handleFilesSelected(files);
                  e.target.value = "";
                }}
              />
            </label>

            <Field label="Image URLs" htmlFor="imageUrls" hint="Optional. Paste external image URLs (one per line).">
              <textarea id="imageUrls" className="textarea" rows={2} value={imageUrls} onChange={(event) => setImageUrls(event.target.value)} placeholder="https://…" />
            </Field>
          </section>

          <section className="card card-pad space-y-3">
            <h2 className="text-base font-semibold text-ink-900">Save</h2>
            {uploadingCount > 0 ? (
              <button type="button" disabled className="btn-primary w-full opacity-70">
                <Loader2 className="size-4 animate-spin" /> Finishing image upload…
              </button>
            ) : (
              <SubmitButton className="btn-primary w-full" pendingLabel="Publishing…">
                {product.id ? "Save changes" : "Publish product"}
              </SubmitButton>
            )}
            <Link href="/vendor/products" className="btn btn-ghost w-full">Back to products</Link>
          </section>
        </div>
      </div>
    </form>
  );
}
