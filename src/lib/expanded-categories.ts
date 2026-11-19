import type { CategoryFeatures } from "@/lib/types";
import type { ProductGuide } from "@/lib/product-guide";

interface CategoryDefinition extends ProductGuide {
  name: string; description: string; icon: string; features: CategoryFeatures;
}
const retail: CategoryFeatures = {catalogue:true,cart:true,stock:true,variants:true,delivery:true,pickup:true,reviews:true,quotations:true};
const service: CategoryFeatures = {catalogue:true,cart:false,serviceBooking:true,appointments:true,quotations:true,reviews:true};
const enquiry: CategoryFeatures = {...service,serviceBooking:false,appointments:false,inquiryOnly:true};

export const EXPANDED_CATEGORIES: Record<string, CategoryDefinition> = {
  "events-rentals": {name:"Events & Rentals",description:"Event decorators, DJs, MCs, venues, catering services and canopy, chair, sound and equipment rentals. Dates and rental availability must be confirmed by the vendor.",icon:"party",features:enquiry,service:true,choices:["Event decoration","DJ / MC","Canopy / chair rental","Sound / lighting rental","Event venue","Event planning","Catering"],example:"Canopy and 50 chairs for a one-day event in Uyo. Delivery and setup included within Uyo. Share your event date; availability and any refundable deposit must be agreed before payment."},
  "hotels-shortlets": {name:"Hotels & Shortlets",description:"Hotels, guesthouses and serviced apartments. Send an enquiry for dates and rates; listings are not instant confirmed reservations.",icon:"hotel",features:enquiry,service:true,choices:["Hotel room","Guesthouse room","Studio shortlet","Apartment shortlet","Entire house"],example:"Furnished one-bedroom apartment in Uyo, up to 2 guests. ₦35,000 per night. Wi-Fi included. Check-in from 2 pm, check-out by 12 noon. Ask the host to confirm your dates, total cost and cancellation terms."},
  "transport-logistics": {name:"Transport & Logistics",description:"Dispatch, moving, haulage and vehicle hire. Route, date, capacity and final cost are confirmed by quotation.",icon:"truck",features:enquiry,service:true,choices:["Dispatch delivery","House / office moving","Haulage","Car hire","Bus hire","Airport transfer"],example:"Small-parcel dispatch within Uyo, up to 5 kg. Price depends on pickup and drop-off locations. Share the addresses, parcel size and preferred time for an availability and price confirmation."},
  "groceries-foodstuff": {name:"Groceries & Foodstuff",description:"Provision shops, rice, garri, palm oil, spices, frozen foods, drinks and everyday food essentials.",icon:"basket",features:retail,choices:["Rice / grains","Garri / flour","Palm oil / cooking oil","Spices / ingredients","Frozen food","Packaged provisions","Drinks"],example:"5 kg bag of locally milled rice, sealed and ready for pickup. ₦8,000 per bag. Keep in a cool, dry place. For packaged food, state expiry and storage instructions where applicable."},
  "building-materials-hardware": {name:"Building Materials & Hardware",description:"Cement, blocks, roofing sheets, paint, tiles, tools and plumbing or electrical fittings.",icon:"blocks",features:retail,choices:["Cement","Blocks","Roofing sheets","Paint","Tiles","Tools / hardware","Plumbing fittings","Electrical fittings"],example:"50 kg bag of cement, factory sealed. Price is per bag. Pickup in Uyo; delivery cost depends on quantity and location. State brand and grade so buyers can compare accurately."},
  "education-training": {name:"Education & Training",description:"Tutors, vocational trainers, driving schools, computer classes, language lessons and professional skill development.",icon:"graduation",features:service,service:true,choices:["Private tutoring","Exam preparation","Vocational training","Driving lessons","Computer classes","Language lessons","Professional course"],example:"Beginner computer lessons, online or in Uyo. Four 1-hour sessions, ₦20,000 for the course. Covers typing and basic office tools. Learners bring a laptop; agree class dates with the tutor."},
  "printing-branding": {name:"Printing & Branding",description:"Business cards, banners, signage, branded clothing, packaging and souvenir printing.",icon:"printer",features:{...retail,madeToOrder:true,productionTracking:true},choices:["Business cards","Flyers / brochures","Banner / signage","Branded clothing","Souvenirs","Labels / packaging","Print design service"],example:"100 double-sided business cards on 350 gsm card, full colour. Print-ready design supplied by customer. Ready in 3 working days after artwork approval; design work costs extra."},
  "automobiles-vehicle-sales": {name:"Automobiles & Vehicle Sales",description:"Car and motorcycle dealers, commercial vehicles and vehicle accessories. Vehicle sales use enquiries and inspection arrangements, not instant checkout.",icon:"car",features:enquiry,choices:["Car","SUV","Bus / van","Truck","Motorcycle / tricycle","Vehicle accessory"],example:"Toyota Corolla, 2015, automatic, 120,000 km. Used, located in Uyo. State known faults, documentation and inspection arrangements. Buyers should inspect the vehicle and verify ownership before paying."},
  "digital-online-services": {name:"Digital & Online Services",description:"Graphic designers, video editors, web and app developers, social media managers, writers, virtual assistants, digital marketers and other remote professionals.",icon:"digital",features:service,service:true,choices:["Graphic design","Video editing","Motion graphics / animation","Website design / development","Mobile app development","UI / UX design","Social media management","Digital marketing / SEO","Copywriting / content writing","Virtual assistance","Data entry / spreadsheet services","Voice-over / audio editing","Translation / transcription","Online business support"],example:"Logo design package: 2 initial concepts, 2 revision rounds and final PNG, PDF and SVG files. Delivered online in 5 working days after receiving your brief. State what is included and any extra charges. Never request passwords or login codes."},
  "wines-drinks": {name:"Wines & Drinks",description:"Wine shops, liquor stores and drinks vendors: wines, whisky, spirits, beer, champagne, soft drinks, juices and bottled water. Alcoholic drinks are for adults 18+ only.",icon:"wine",features:retail,choices:["Wine","Whisky / spirits","Beer","Champagne / sparkling wine","Soft drinks","Energy drinks","Juice / smoothies","Bottled water","Cocktails / mixers"],example:"75 cl bottle of red wine, sealed and stored upright in a cool place. Price is per bottle; state the brand, size and alcohol percentage. Alcoholic drinks are for adults 18+ only. Handle with care during delivery."},
  "branding-packaging": {name:"Branding & Packaging",description:"Brand identity designers and packaging suppliers: logos, brand guidelines, signage, custom boxes, labels, bags, bottles and product packaging.",icon:"package",features:{...retail,madeToOrder:true,productionTracking:true},choices:["Logo / brand identity","Brand guidelines","Signage / branding","Custom boxes","Labels / stickers","Branded bags","Bottles / containers","Full packaging design"],example:"100 custom printed boxes (30 x 20 x 15 cm) with your logo, full colour on kraft board. Price is per 100 pieces. Send your artwork or ask for design help; ready in 5 working days after artwork approval."},
  "household-products": {
    name: "Household Products",
    description: "Everyday home essentials: kitchenware, cookware, cleaning and laundry supplies, bathroom accessories, bedding, furniture, storage, decor, lighting, home appliances, tools and garden items.",
    icon: "house",
    features: retail,
    choices: [
      // Kitchen and dining.
      "Cooking pots / casseroles", "Frying pans / woks", "Pressure cookers",
      "Baking trays / cake tins", "Cooking utensils / ladles", "Kitchen knives / scissors",
      "Chopping boards", "Graters / peelers", "Sieves / colanders",
      "Measuring cups / kitchen scales", "Mortars / pestles", "Plates / bowls / dinner sets",
      "Cups / mugs / glasses", "Cutlery", "Serving trays / dishes",
      "Jugs / water bottles", "Flasks / food warmers", "Lunch boxes",
      "Food storage containers", "Dish racks / cutlery holders", "Kitchen racks / trolleys",
      "Aluminium foil / cling film", "Kitchen towels / oven gloves", "Aprons",
      "Water dispensers / filters", "Gas cookers / stoves", "Gas cylinders / regulators / hoses",
      // Household appliances.
      "Electric kettles", "Blenders / food processors", "Mixers / grinders",
      "Microwaves / ovens", "Toasters / sandwich makers", "Rice cookers / electric hotplates",
      "Air fryers / deep fryers", "Refrigerators / freezers", "Washing machines / dryers",
      "Irons / garment steamers", "Ironing boards", "Vacuum cleaners",
      "Fans / air coolers", "Air conditioners", "Air purifiers / humidifiers",
      "Water heaters", "Sewing machines", "Televisions / home audio", "Water tanks / pumps",
      // Cleaning and laundry supplies, not cleaning or laundry services.
      "Laundry detergent / soap", "Fabric softeners / stain removers", "Dishwashing liquid / soap",
      "Disinfectants / bleach", "Floor / toilet / bathroom cleaners", "Glass / furniture cleaners",
      "Brooms / dustpans", "Mops / buckets", "Scrubbing brushes",
      "Sponges / scouring pads", "Cleaning cloths / dusters", "Household gloves",
      "Waste bins / bin liners", "Air fresheners / diffusers", "Pest control products",
      "Laundry baskets / hampers", "Clothes hangers / pegs", "Drying racks / clotheslines", "Laundry bags",
      "Shoe polish / shoe brushes",
      // Bathroom and everyday paper goods.
      "Buckets / basins", "Bath towels / face towels", "Bath mats",
      "Shower curtains / bath screens", "Soap dishes / dispensers", "Toothbrush holders",
      "Toilet brushes / plungers", "Toilet rolls / tissues / paper towels", "Toilet seats / bathroom accessories",
      "Bath soap / household toiletries",
      // Bedding and home textiles.
      "Bedsheets / pillowcases", "Pillows / cushions", "Duvets / blankets",
      "Mattresses / mattress toppers", "Mattress / pillow protectors", "Mosquito nets",
      "Curtains / blinds / curtain rods", "Rugs / carpets", "Doormats",
      "Tablecloths / placemats", "Sofa / chair covers",
      // Furniture, storage and home decor.
      "Sofas / armchairs", "Beds / bed frames", "Wardrobes", "Tables / desks",
      "Dining chairs / stools", "Shelves / bookcases", "Cabinets / drawers",
      "TV stands / shoe racks", "Storage boxes / baskets", "Storage bags / organisers",
      "Mirrors", "Wall clocks", "Wall art / picture frames", "Vases / artificial flowers",
      "Candles / candle holders",
      // Lighting, electrical accessories, tools and home safety.
      "Bulbs / light fittings", "Table / floor lamps", "Rechargeable lamps / torches",
      "Extension leads / sockets / plugs", "Batteries / chargers", "Voltage stabilisers / surge protectors",
      "Inverters / backup power", "Generators", "Solar panels / home power kits",
      "Hand tools / tool boxes", "Step ladders", "Lighters / matches",
      "Padlocks / door locks", "Door / window insect screens", "Smoke / carbon monoxide alarms", "Fire extinguishers / fire blankets",
      "First aid boxes",
      // Outdoor and family household items.
      "Flower pots / planters", "Garden hand tools / watering cans", "Garden hoses / sprinklers",
      "Outdoor furniture", "Baby cots / high chairs", "Baby bath / feeding accessories",
      "Baby nappies / wipes", "Pet beds / bowls / litter trays",
    ],
    example: "Set of 3 stainless-steel cooking pots with lids, 2 L, 3 L and 5 L. New; price is per set. State size, material, colour, quantity and what is included. Add care instructions, and label safety or expiry details where relevant. Use your own price and available stock.",
  },
};
