import { EXPANDED_CATEGORIES } from "@/lib/expanded-categories";
export interface ProductGuide { choices: string[]; example: string; service?: boolean }
export const PRODUCT_GUIDES: Record<string, ProductGuide> = {
  ...EXPANDED_CATEGORIES,
  "food-restaurants": { choices: ["Rice dish", "Soup / swallow", "Cake", "Pastries / snacks", "Drink", "Small chops", "Event catering"], example: "A bowl of jollof rice with chicken. Serves one person. Freshly prepared; ready in 30 minutes. Tell buyers about ingredients or allergens." },
  "fashion-clothing": { choices: ["Dress", "Shirt / top", "Trousers", "Native wear", "Fabric", "Tailoring service"], example: "Ankara wrap dress, cotton fabric, sizes 8–16. Available in blue and red. Ready-made, or allow 5 days for custom sizing." },
  "shoes-footwear": { choices: ["Slippers", "Sandals", "Sneakers", "Formal shoes", "Boots", "Custom footwear"], example: "Handmade leather sandals, sizes 40–45. Brown or black. Comfortable rubber sole; made within 4 days." },
  "electronics-gadgets": { choices: ["Phone", "Laptop", "Accessory", "Kitchen appliance", "Gas cylinder / cooker", "Repair service"], example: "Samsung phone, 128 GB, neatly used. Battery works well. Charger included. Mention any faults and warranty, if offered." },
  "beauty-personal-care": { choices: ["Skincare", "Perfume", "Hair / wig", "Makeup product", "Makeup service", "Hair / beauty service"], example: "50 ml fragrance with floral notes, sealed bottle. Mention ingredients, usage and expiry where relevant. For services, explain what is included." },
  "artisans-carpentry-woodwork": { choices: ["Chair / sofa", "Bed", "Wardrobe", "Table", "Cabinet", "Carpentry service"], example: "Six-seater dining table made from hardwood, polished brown finish. Chairs included. Made to order in 14 days; include approximate dimensions." },
  "artisans-electrical-solar": { choices: ["Electrical installation", "Solar installation", "Generator repair", "Wiring repair", "Solar equipment"], service: true, example: "Home solar installation in Uyo. Includes site assessment and installation labour. Equipment is quoted separately after assessment." },
  "artisans-plumbing-water": { choices: ["Plumbing repair", "Borehole service", "Water tank installation", "Pump repair", "Plumbing supplies"], service: true, example: "Fix leaking taps and pipes in Uyo. Price covers inspection and labour for a simple repair; replacement parts are charged separately." },
  "artisans-pop-painting-finishing": { choices: ["Painting", "POP ceiling", "Tiling", "Wallpaper", "Finishing materials"], service: true, example: "Interior painting for one room. Labour only; paint supplied by customer. Tell buyers the room size covered and estimated time." },
  "artisans-masonry-welding-construction": { choices: ["Bricklaying", "Welding", "Aluminium windows", "Roofing", "Gate / metalwork"], service: true, example: "Custom steel gate fabrication. Includes welding and painting. Final price depends on measurements and design; site visit available." },
  "artisans-ac-auto-mechanical": { choices: ["AC servicing", "Fridge repair", "Car repair", "Tyre service", "Spare part"], service: true, example: "Split-unit AC cleaning and servicing. Includes filter cleaning and checks. Gas refill and replacement parts are quoted separately." },
  "artisans-home-domestic-trades": { choices: ["House cleaning", "Laundry", "Fumigation", "Shoe repair", "Upholstery cleaning"], service: true, example: "Deep cleaning of a two-bedroom flat. Cleaning materials included. Takes about 4 hours; tell buyers any exclusions." },
  "services-professionals": { choices: ["Photography", "Videography", "Graphic design", "Event service", "Consultation", "Training"], service: true, example: "One-hour portrait photography session in Uyo. Includes 5 edited digital photos, delivered within 3 days. Studio hire is separate." },
  "general-retail": { choices: ["Household item", "Kitchenware", "Office supplies", "Gift", "Accessory"], example: "Set of 6 glass cups, 300 ml each. Clear glass, packed in a box. New and ready for pickup." },
  "house-agents-realtors": { choices: ["Flat / apartment", "House", "Duplex", "Self-contained", "Land", "Office", "Shop / commercial", "Warehouse"], service: true, example: "Two-bedroom flat in Uyo, near a main road. Water and parking available. State rent or sale terms and any agency, legal or caution fees. Inspection fee is entered separately." },
  "agriculture-livestock": { choices: ["Crayfish", "Catfish", "Chicken", "Turkey", "Duck", "Eggs", "Livestock", "Vegetables / fruit", "Grains / tubers"], example: "Fresh catfish, about 1 kg each. Sold per kilogram. Cleaned on request. Pickup in Uyo; same-day delivery available. Keep chilled and cook promptly." },
};
export function productGuide(slug: string | null | undefined): ProductGuide {
  return PRODUCT_GUIDES[slug ?? ""] ?? { choices: ["Product", "Service"], example: "Describe what the buyer gets, the size or quantity, what is included and when it will be ready." };
}
export function selectionKind(selection: string, guide: ProductGuide): "product" | "service" {
  if (/service|repair|tailoring/i.test(selection)) return "service";
  if (/equipment|supplies|materials|spare part/i.test(selection)) return "product";
  return guide.service ? "service" : "product";
}
export function agricultureSelection(selection: string): string {
  return ({Crayfish:"Crayfish & seafood",Catfish:"Catfish & other fish",Chicken:"Chicken & other poultry",Turkey:"Chicken & other poultry",Duck:"Chicken & other poultry",Eggs:"Eggs",Livestock:"Livestock","Vegetables / fruit":"Vegetables & fruits","Grains / tubers":"Grains, tubers & legumes"} as Record<string,string>)[selection] ?? "Other farm produce";
}
export function descriptionExample(slug: string | null | undefined, selection: string): string {
  if(slug==="agriculture-livestock") {
    if(selection==="Eggs") return "A crate of 30 large eggs, collected this week. Pickup in Uyo. Keep in a cool, dry place. Mention any minimum order.";
    if(["Chicken","Turkey","Duck","Livestock"].includes(selection)) return "Live broiler chicken, about 8 weeks old and 2 kg. Tell buyers about health, vaccinations and pickup arrangements.";
    if(selection==="Crayfish") return "Clean dried crayfish, sold in 1 kg sealed packs. Sourced in Oron. Keep dry in an airtight container.";
  }
  return productGuide(slug).example;
}

export function productQuestions(slug: string | null | undefined, selection: string, kind: string) {
  if (slug === "agriculture-livestock" || slug === "house-agents-realtors") return [];
  if (slug === "digital-online-services") return [
    {key:"deliverables",label:"What files or results will the buyer receive?",placeholder:"e.g. A 60-second edited video, MP4, with 2 revisions"},
    {key:"turnaround",label:"How soon can you deliver?",placeholder:"e.g. 3 working days after the brief and source files arrive"},
  ];
  if (slug === "hotels-shortlets") return [{key:"stay_details",label:"Location, guest capacity and price basis",placeholder:"e.g. Uyo, 2 guests, price per night; dates must be confirmed"}];
  if (slug === "transport-logistics") return [{key:"route_capacity",label:"Which areas and load sizes do you cover?",placeholder:"e.g. Uyo local delivery, parcels up to 5 kg; request a route quote"}];
  if (slug === "events-rentals") return [{key:"rental_terms",label:"What does the price cover?",placeholder:"e.g. 50 chairs for one day; delivery separate; confirm event date first"}];
  if (slug === "automobiles-vehicle-sales") return [{key:"vehicle_details",label:"Year, mileage, condition and location",placeholder:"e.g. 2015, 120,000 km, used, Uyo; inspections by arrangement"}];
  if (slug === "household-products") return [
    {key:"size_quantity",label:"What size or quantity does the buyer get?",placeholder:"e.g. 5 litres, a 6 ft mattress, or a pack of 6 cups"},
    {key:"item_details",label:"Material, colour, condition or model details",placeholder:"e.g. New stainless steel, silver, lids included; add care or safety instructions"},
  ];
  if (kind === "service") return [{key:"service_area",label:"Where do you offer this service?",placeholder:"e.g. My studio in Uyo, or customer visits within Uyo"}];
  if (slug === "food-restaurants") return [{key:"portion_size",label:"What portion or quantity is included?",placeholder:selection === "Cake" ? "e.g. 8-inch cake, serves 12" : "e.g. One takeaway pack, serves 1"}];
  if (["fashion-clothing","shoes-footwear"].includes(slug ?? "")) return [{key:"sizes_colours",label:"Which sizes and colours are available?",placeholder:"e.g. Sizes 38–44, black and brown"}];
  if (slug === "electronics-gadgets") return [{key:"item_condition",label:"Is it new or used? Any faults?",placeholder:"e.g. New and sealed, or used with a small scratch"}];
  if (slug === "beauty-personal-care") return [{key:"size_quantity",label:"What size or quantity does the buyer get?",placeholder:"e.g. 50 ml bottle, sealed; expiry June 2027"}];
  if (slug === "artisans-carpentry-woodwork") return [{key:"size_material",label:"What size and material?",placeholder:"e.g. 6 ft wooden bed frame; mattress not included"}];
  return [{key:"size_quantity",label:"What size or quantity is included?",placeholder:"e.g. One piece, or a pack of 6"}];
}
