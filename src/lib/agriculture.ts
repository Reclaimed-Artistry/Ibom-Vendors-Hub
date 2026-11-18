import type { CategoryAttribute } from "@/lib/types";

export const AGRICULTURE_SLUG = "agriculture-livestock";
export const AGRICULTURE_ATTRIBUTES: CategoryAttribute[] = [
  { key: "produce_type", label: "Produce type", type: "select", required: true, options: ["Crayfish & seafood", "Catfish & other fish", "Chicken & other poultry", "Eggs", "Livestock", "Vegetables & fruits", "Grains, tubers & legumes", "Other farm produce"] },
  { key: "sale_unit", label: "Price is per", type: "select", required: true, options: ["Kilogram (kg)", "Gram (g)", "Litre", "Piece", "Bird / animal", "Crate", "Basket", "Bag", "Bunch", "Pack", "Other (describe pack size)"] },
  { key: "pack_size", label: "Exact weight / pack size (e.g. 1 kg, 30 eggs, 50 kg bag)", type: "text", required: true },
  { key: "minimum_order", label: "Minimum order (number of selling units)", type: "number" },
  { key: "produce_condition", label: "Condition / processing", type: "select", required: true, options: ["Live", "Fresh / raw", "Chilled", "Frozen", "Dried", "Smoked", "Processed / packaged"] },
  { key: "source_location", label: "Farm / source location (town and LGA)", type: "text" },
  { key: "storage_instructions", label: "Storage and shelf-life instructions", type: "textarea" },
  { key: "fulfilment_notes", label: "Pickup / delivery timing, packaging and handling", type: "textarea" },
  { key: "harvest_date", label: "Harvest / catch / processing date (YYYY-MM-DD, if applicable)", type: "text" },
  { key: "breed_variety", label: "Breed / species / variety", type: "text" },
  { key: "animal_age", label: "Age and typical live weight (include units)", type: "text" },
  { key: "health_details", label: "Live animal health, vaccination and treatment details", type: "textarea" },
  { key: "egg_details", label: "Egg size / grade and collection date (YYYY-MM-DD)", type: "text" },
  { key: "fish_preparation", label: "Fish / seafood size, cleaning and processing details", type: "textarea" },
];

export function agricultureFieldRequired(key: string, values: Record<string, string>): boolean {
  if (AGRICULTURE_ATTRIBUTES.find(a => a.key === key)?.required) return true;
  if (key === "health_details") return values.produce_condition === "Live";
  if (key === "egg_details") return values.produce_type === "Eggs";
  return false;
}

export function validateAgricultureAttributes(values: Record<string, string>) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Enter the farm produce details.");
  for (const field of AGRICULTURE_ATTRIBUTES) {
    const value = values[field.key];
    if (value != null && typeof value !== "string") throw new Error(`Check ${field.label.toLowerCase()}.`);
    if (agricultureFieldRequired(field.key, values) && !value?.trim()) throw new Error(`Enter ${field.label.toLowerCase()}.`);
    if (value && field.options && !field.options.includes(value)) throw new Error(`Choose a valid ${field.label.toLowerCase()}.`);
    if (value && value.length > 2000) throw new Error(`${field.label} must be under 2,000 characters.`);
  }
  const minimum = Number(values.minimum_order || 1);
  if (!Number.isFinite(minimum) || minimum < 1 || minimum > 99 || !Number.isInteger(minimum)) throw new Error("Minimum order must be a whole number of selling units, between 1 and 99.");
  if (values.harvest_date) {
    const date = new Date(`${values.harvest_date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.harvest_date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==values.harvest_date || date.getTime()>Date.now()) throw new Error("Enter a valid harvest / processing date, not in the future.");
  }
}

export function farmMinimumQuantity(attributes: Record<string, string> | null | undefined): number {
  if (!attributes?.produce_type) return 1;
  const minimum = Number(attributes.minimum_order);
  return Number.isInteger(minimum) && minimum >= 1 && minimum <= 99 ? minimum : 1;
}
