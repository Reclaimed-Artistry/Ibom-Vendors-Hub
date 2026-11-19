export interface BookingFieldDefinition {
  key: string;
  label: string;
  placeholder?: string;
  type: "select" | "text";
  options?: string[];
  required?: boolean;
}

export interface CategoryBookingProfile {
  isArtisan: boolean;
  heading: string;
  subtitle: string;
  ctaLabel: string;
  paymentNote: string;
  tradesCovered: string[];
  requirementsTitle: string;
  requirements: string[];
  requiresSiteAddress: boolean;
  siteAddressLabel: string;
  siteAddressPlaceholder: string;
  visitTypes: string[];
  materialsOptions?: string[];
  extraFields: BookingFieldDefinition[];
  notesLabel: string;
  notesPlaceholder: string;
  confirmLabel: string;
  timeSlots: string[];
}

const ARTISAN_TIME_SLOTS = [
  "07:30",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

const STUDIO_TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

export const CATEGORY_BOOKING_PROFILES: Record<string, CategoryBookingProfile> = {
  "artisans-carpentry-woodwork": {
    isArtisan: true,
    heading: "Book a Carpenter, Woodworker or Furniture Maker",
    subtitle:
      "Provide your space dimensions, wood/board preference and installation site details so the artisan comes with accurate tools and samples.",
    ctaLabel: "Book carpenter / site measurement",
    paymentNote:
      "Inspection / call-out fee or agreed escrow milestone — final fabrication & installation cost is confirmed from exact measurements.",
    tradesCovered: [
      "Carpenters",
      "Woodworkers",
      "Furniture Makers",
      "Wardrobe & Kitchen Cabinet Makers",
      "Upholsterers",
      "Door & Frame Fitters",
      "Roofing Carpenters",
    ],
    requirementsTitle: "Carpentry & Woodwork Booking Requirements",
    requirements: [
      "Clear room or wall space access for tape measurement (or exact Length × Width × Height dimensions if already measured).",
      "State whether work is new workshop fabrication, on-site installation, upholstery refurbishing, or roofing carpentry.",
      "Specify preferred timber/board grade (e.g. Mahogany, Teak, HDF/MDF board, Treated Pine) or request physical board samples.",
      "Confirm staircase/doorway clearance and on-site electricity socket access for cutting and drilling tools during fitting.",
      "Agree whether timber, boards, hinges and handles will be supplied by the artisan (turnkey) or bought by you (labour only).",
    ],
    requiresSiteAddress: true,
    siteAddressLabel: "Job site address, LGA & nearest landmark",
    siteAddressPlaceholder: "e.g. No. 14 Oron Road, near Plaza, Uyo (2nd floor flat)",
    visitTypes: [
      "Site Measurement & Design Consultation",
      "Custom Furniture / Cabinet Fabrication",
      "On-Site Door, Frame or Woodwork Installation",
      "Roofing Carpentry Inspection / Execution",
      "Upholstery & Furniture Repair",
    ],
    materialsOptions: [
      "Artisan supplies wood, boards & fittings (Full Turnkey Quote)",
      "I will supply wood & fittings (Workmanship / Labour Only)",
      "Inspect & measure first, then give Bill of Quantities (BOQ)",
    ],
    extraFields: [
      {
        key: "dimensions_or_scope",
        label: "Approximate dimensions or number of units",
        type: "text",
        placeholder: "e.g. 6ft × 8ft wardrobe + TV console, or 5 internal doors",
        required: true,
      },
      {
        key: "wood_and_power",
        label: "Preferred wood/board & on-site power status",
        type: "select",
        options: [
          "HDF / MDF Board — Grid or Generator power available on site",
          "Solid Hardwood (Mahogany / Teak) — Power available on site",
          "Roofing / Treated Timber — Outdoor / uncompleted building (no power yet)",
          "Need artisan's advice & sample boards during visit",
        ],
        required: true,
      },
    ],
    notesLabel: "Design details, finish colour or access instructions",
    notesPlaceholder: "Mention colour/finish (matte white, walnut, high-gloss), floor level, estate gate pass rules, or repair details…",
    confirmLabel:
      "I confirm the work area will be accessible at the scheduled time and I have reviewed the carpentry booking requirements above.",
    timeSlots: ARTISAN_TIME_SLOTS,
  },

  "artisans-electrical-solar": {
    isArtisan: true,
    heading: "Book an Electrician, Solar/Inverter or Generator Technician",
    subtitle:
      "Share your power phase, fault or load details, and meter/distribution-board access so the technician brings the right testing & safety gear.",
    ctaLabel: "Book technician / site inspection",
    paymentNote:
      "Diagnostic / inspection fee or fixed installation rate — replacement cables, breakers, batteries or parts are itemised before purchase.",
    tradesCovered: [
      "Domestic & Industrial Electricians",
      "Conduit & Surface House Wiring",
      "Solar Panel & Inverter Installers",
      "Generator Mechanics (Petrol / Diesel)",
      "CCTV, Intercom & Smart-Home Techs",
      "Earthing & Surge Protection",
    ],
    requirementsTitle: "Electrical, Solar & Generator Booking Requirements",
    requirements: [
      "Ensure unobstructed access to your distribution board (DB/fuse box), prepaid/postpaid meter, changeover switch, inverter or generator house.",
      "Indicate your building power setup (Single-Phase, 3-Phase, Solar/Inverter hybrid, or uncompleted building wiring).",
      "For solar/inverter sizing or generator repairs, list major appliances to power (ACs, freezer, borehole pump, lighting) or generator kVA/brand.",
      "Confirm roof/ceiling manhole access if conduit wiring, solar panels, earthing rod or CCTV cameras are involved.",
      "Do not touch exposed live wires or flooded electrical panels before the technician arrives — isolate the main breaker if sparking.",
    ],
    requiresSiteAddress: true,
    siteAddressLabel: "Property / site address, LGA & nearest landmark",
    siteAddressPlaceholder: "e.g. Plot 8 Shelter Afrique Extension, Uyo (near Deeper Life)",
    visitTypes: [
      "Electrical Fault Tracing & Emergency Repair",
      "Full / Partial House Wiring (Conduit or Surface)",
      "Solar Panel, Inverter & Battery Load Audit / Installation",
      "Generator Servicing / Overhaul",
      "CCTV, Intercom or Earthing Installation",
    ],
    materialsOptions: [
      "Technician supplies original cables/parts + labour (Quote first)",
      "I already bought cables/materials (Labour only)",
      "Site inspection, load calculation & Bill of Quantities (BOQ) first",
    ],
    extraFields: [
      {
        key: "power_system",
        label: "Power supply / system type",
        type: "select",
        options: [
          "Single-Phase Building (PHEDC / Prepaid Meter)",
          "Three-Phase Building / Commercial Premises",
          "Solar + Inverter / Battery System",
          "Petrol or Diesel Generator (2.5kVA – 100kVA+)",
          "New Uncompleted Building (Piping / Conduit Stage)",
        ],
        required: true,
      },
      {
        key: "fault_or_load",
        label: "Fault symptoms, appliance load or generator model",
        type: "text",
        placeholder: "e.g. Tripping breaker on socket circuit, or 5kVA inverter setup for 1HP AC + fridge",
        required: true,
      },
    ],
    notesLabel: "Ceiling height, ladder needs or safety notes",
    notesPlaceholder: "Mention high POP ceiling (>3.5m), estate security rules, generator brand/model, or hours power is available…",
    confirmLabel:
      "I confirm safe access to the meter/DB/equipment area will be available and I have read the electrical & power booking requirements.",
    timeSlots: ARTISAN_TIME_SLOTS,
  },

  "artisans-plumbing-water": {
    isArtisan: true,
    heading: "Book a Plumber, Borehole or Water System Technician",
    subtitle:
      "Tell us the affected bathroom/kitchen/water line and shut-off access so the plumber arrives ready to isolate, test and fix cleanly.",
    ctaLabel: "Book plumber / water technician",
    paymentNote:
      "Call-out / inspection or stated workmanship rate — pipes, PPR/PVC fittings, pumps or sanitary wares are quoted transparently before purchase.",
    tradesCovered: [
      "Plumbers & Pipefitters",
      "WC, Basin, Shower & Water-Heater Installers",
      "Leak Detection & Blocked Drain Techs",
      "Borehole Drillers & Flushing Techs",
      "Submersible & Pressure Pump Technicians",
      "Overhead Tank & Water Treatment Installers",
    ],
    requirementsTitle: "Plumbing & Water System Booking Requirements",
    requirements: [
      "Know the location of your main water control valve / overhead tank tap so water flow can be shut off during pipe or fitting work.",
      "Indicate whether piping is concealed in-wall (PPR/PVC) or surface-run, and whether wall/tile breaking may be required.",
      "For borehole, submersible pump or water-heater jobs, ensure electricity or a working generator is available on site to test pressure and flow.",
      "Clear personal items under sinks, around WCs, manholes or pump houses before the technician's arrival.",
      "For borehole drilling or tank scaffolding, confirm compound/gate width for rig or tripod equipment entry.",
    ],
    requiresSiteAddress: true,
    siteAddressLabel: "Site / house address, LGA & nearest landmark",
    siteAddressPlaceholder: "e.g. 22 Abak Road, by Federal Housing Junction, Uyo",
    visitTypes: [
      "Urgent Leak, Burst Pipe or Blocked Drain Repair",
      "WC, Basin, Water Heater or Kitchen Fitting Installation",
      "New Building First-Fix / Second-Fix Piping",
      "Borehole Pump, Flushing or Water Treatment Service",
      "Site Inspection & Plumbing Material Estimate",
    ],
    materialsOptions: [
      "Plumber supplies pipes/fittings + labour (Quote after check)",
      "I already have sanitary wares / fittings on site (Labour only)",
      "Inspect site first and provide full plumbing material list",
    ],
    extraFields: [
      {
        key: "plumbing_area",
        label: "Affected area / water system",
        type: "select",
        options: [
          "Bathroom / Toilet (WC, Shower, Mixer, Water Heater)",
          "Kitchen Sink, Waste Pipe or Grease Trap",
          "Concealed / Underground Pipe Leak",
          "Borehole, Submersible Pump or Overhead Tank",
          "Full Flat / New Building Piping",
        ],
        required: true,
      },
      {
        key: "water_and_power",
        label: "Water supply & testing power status on site",
        type: "select",
        options: [
          "Running water & power/generator available for pressure test",
          "Water currently shut off due to active leak",
          "Borehole pump not pumping — power/generator available to test",
          "Uncompleted building site (no running water yet)",
        ],
        required: true,
      },
    ],
    notesLabel: "Problem description, floor level or access notes",
    notesPlaceholder: "Describe the leak/blockage, building storey (ground/upstairs), brand of WC/heater, or compound gate access…",
    confirmLabel:
      "I confirm access to water control valves and the work area will be available and I accept the plumbing booking requirements above.",
    timeSlots: ARTISAN_TIME_SLOTS,
  },

  "artisans-pop-painting-finishing": {
    isArtisan: true,
    heading: "Book a POP Ceiling Installer, Painter, Screeder or Tiler",
    subtitle:
      "Share your room count or square-metre estimate, wall/floor state, and water/electricity readiness for smooth interior or exterior finishing.",
    ctaLabel: "Book measurement / finishing artisan",
    paymentNote:
      "Site measurement visit or milestone escrow booking — per-sqm / per-room totals are finalised once exact room measurements are taken.",
    tradesCovered: [
      "POP Ceiling & Cornice Installers",
      "TV Console & Drywall Partitioners",
      "Wall Screeders (POP / Acrylic)",
      "House Painters (Emulsion, Satin, Texcote, 3D)",
      "Floor, Wall & Bathroom Tilers",
      "Stamped Concrete & Interlocking Pavers",
      "Wallpaper & Window-Blind Installers",
    ],
    requirementsTitle: "POP, Painting & Tiling Booking Requirements",
    requirements: [
      "Rooms/areas must be cleared of fragile furniture (or ready to be sheet-covered) before POP mixing, sanding, painting or floor tiling begins.",
      "Clean water supply on site is mandatory for POP casting, wall screeding, tile mortar/cement mixing and stamped concrete.",
      "Confirm whether scaffolding or ladders are needed (e.g. duplex void, stairwell, high church/hall ceiling, or exterior storey painting).",
      "For POP ceiling & tiling, electrical first-fix conduits and plumbing pipes in those ceilings/walls should already be in place.",
      "State whether cement, POP bags, paint buckets or tiles are already on site or should be quoted by the artisan.",
    ],
    requiresSiteAddress: true,
    siteAddressLabel: "Project site address, LGA & nearest landmark",
    siteAddressPlaceholder: "e.g. Osongama Estate Phase 2, Close 4, Uyo",
    visitTypes: [
      "Site Measurement, Sample Review & Written Quotation",
      "POP Ceiling, Cornice or TV Wall Installation",
      "Wall Screeding & Interior/Exterior Painting",
      "Floor / Bathroom Wall Tiling",
      "Stamped Concrete, Interlocking or Wallpaper Installation",
    ],
    materialsOptions: [
      "Inspect & measure first, then quote Materials + Workmanship",
      "Workmanship / Labour Only (I will buy POP/paint/tiles from list)",
      "Full Turnkey Material + Workmanship",
    ],
    extraFields: [
      {
        key: "area_and_rooms",
        label: "Number of rooms or estimated area (sqm)",
        type: "text",
        placeholder: "e.g. 3-bedroom flat living room + bedrooms, or ~85 sqm floor tiling",
        required: true,
      },
      {
        key: "surface_and_utilities",
        label: "Current surface condition & site water/power",
        type: "select",
        options: [
          "Newly plastered walls/decking — Water available on site",
          "Occupied home repainting / renovation — Water & power available",
          "High ceiling / Duplex exterior (requires scaffolding) — Water on site",
          "Uncompleted site — Water will be arranged before work starts",
        ],
        required: true,
      },
    ],
    notesLabel: "Design style, paint grade/colours or tile size",
    notesPlaceholder: "e.g. Minimalist floating POP with warm LED trough, Satin off-white walls, 60×60 glazed porcelain tiles…",
    confirmLabel:
      "I confirm the rooms/site will be accessible for measurement or work and I have noted water, MEP first-fix and clearance requirements.",
    timeSlots: ARTISAN_TIME_SLOTS,
  },

  "artisans-masonry-welding-construction": {
    isArtisan: true,
    heading: "Book a Bricklayer, Welder, Aluminium Fabricator or Roofer",
    subtitle:
      "Provide structural scope, site vehicle access and welding/power availability so fabrication or construction is planned safely and accurately.",
    ctaLabel: "Book site visit / construction artisan",
    paymentNote:
      "Site measurement / inspection or milestone-backed project booking — structural materials & fabrication specs are documented before commencement.",
    tradesCovered: [
      "Bricklayers / Masons & Plasterers",
      "Welders (Gates, Burglary Proof, Carports, Tanks)",
      "Aluminium Window, Casement & Glass Fabricators",
      "Stone-Coated & Long-Span Roofers",
      "Iron Benders & Concrete Workers",
    ],
    requirementsTitle: "Masonry, Welding, Aluminium & Roofing Requirements",
    requirements: [
      "Exact window/door/gate openings or roof/fence perimeter will be measured on site before cutting aluminium profiles, steel or roofing sheets.",
      "For on-site welding or aluminium/roof installation, confirm whether 3-phase/heavy grid power is available or if the artisan must bring a welding generator.",
      "Ensure tipper/pickup truck access to the compound for sand, blocks, steel pipes, aluminium frames or long-span roofing sheets.",
      "For fencing, structural extensions or roofing, ensure property boundary/approvals and safe ground clearance around the building.",
      "Agree upfront on material gauge/thickness (e.g. 0.45mm/0.55mm aluminium, Nigalex/First Aluminium profile, hollow pipe gauge).",
    ],
    requiresSiteAddress: true,
    siteAddressLabel: "Construction / installation site address & landmark",
    siteAddressPlaceholder: "e.g. Ring Road 3 by Aka Etinan Roundabout, Uyo",
    visitTypes: [
      "Site Measurement & Bill of Quantities (BOQ)",
      "Gate, Burglary-Proof, Railing or Tank Stand Welding",
      "Aluminium Windows, Doors or Office Partition Fitting",
      "Bricklaying, Plastering, German Floor or Fence Work",
      "Roof Sheet Installation or Roof Leak Repair",
    ],
    materialsOptions: [
      "Material + Workshop Fabrication + Site Installation",
      "Workmanship / Labour Only (Materials on site)",
      "Take site measurements first & submit detailed BOQ",
    ],
    extraFields: [
      {
        key: "structure_scope",
        label: "Work scope, unit count or dimensions",
        type: "text",
        placeholder: "e.g. 12ft sliding gate + 10 window burglary proofs, or 4-bedroom stone-coated roof",
        required: true,
      },
      {
        key: "site_power_and_access",
        label: "On-site electricity & truck access",
        type: "select",
        options: [
          "Vehicle access OK — Artisan should come with welding/cutting generator",
          "Vehicle access OK — Strong site electricity available",
          "Narrow street / upstairs carry-in — Please note for delivery team",
        ],
        required: true,
      },
    ],
    notesLabel: "Preferred material gauge, profile colour or structural notes",
    notesPlaceholder: "e.g. Charcoal black Nigalex casement windows with reflective glass, 16-gauge galvanized gate, Gerard bond tiles…",
    confirmLabel:
      "I confirm safe site access for measurement/installation and I understand the power, gauge and delivery requirements stated above.",
    timeSlots: ARTISAN_TIME_SLOTS,
  },

  "artisans-ac-auto-mechanical": {
    isArtisan: true,
    heading: "Book an AC/Fridge Tech, Auto Mechanic, Rewire or Vulcanizer",
    subtitle:
      "Give the AC/fridge capacity or vehicle make, model & year plus symptoms so the technician arrives with the right gas, scanner, jack or parts.",
    ctaLabel: "Book technician / call-out",
    paymentNote:
      "Call-out / diagnostic fee or fixed servicing rate — any replacement compressor, refrigerant gas, spare parts or tyres are approved by you first.",
    tradesCovered: [
      "AC Installers & Servicing Techs",
      "Refrigerator, Deep Freezer & Cold-Room Techs",
      "Auto Mechanics & OBD Diagnostics",
      "Auto Electricians (Rewires) & Car AC",
      "Panel Beaters & Oven-Bake Car Painters",
      "Mobile Vulcanizers & Wheel Balancing",
    ],
    requirementsTitle: "Cooling & Auto Mechanical Booking Requirements",
    requirements: [
      "State exact appliance brand/tonnage (e.g. LG 1.5HP Inverter Split AC, Thermocool Chest Freezer) OR vehicle make, model & year (e.g. Lexus RX350 2015).",
      "For AC/fridge servicing or gas charging, electricity or a generator capable of running the compressor must be available on site for testing.",
      "For outdoor AC condenser work above ground floor, mention storey height so safety harness/extension ladder is brought along.",
      "For roadside or home auto repair/vulcanizing, ensure the vehicle is parked in a safe, level spot and keys/wheel lock nut are handy.",
      "Spare parts, engine oil or refrigerant gas (R410A / R22 / R134a / R600a) are only billed after diagnostic confirmation.",
    ],
    requiresSiteAddress: true,
    siteAddressLabel: "Home, office, roadside location or workshop drop-off note",
    siteAddressPlaceholder: "e.g. Ewet Housing Estate Line 3, Uyo (or write 'Dropping off at artisan workshop')",
    visitTypes: [
      "Home / Office Call-Out (AC, Fridge or Parked Vehicle)",
      "Urgent Roadside Assistance (Mechanic / Rewire / Vulcanizer)",
      "Routine Servicing, Gas Refill or Preventive Maintenance",
      "New AC Installation / Piping",
      "Workshop Drop-Off Appointment",
    ],
    materialsOptions: [
      "Diagnose first & quote genuine replacement parts/gas if needed",
      "Routine servicing / labour only (I have parts/kit)",
      "Full installation kit + workmanship",
    ],
    extraFields: [
      {
        key: "equipment_or_vehicle",
        label: "Appliance HP/brand OR Vehicle make, model & year",
        type: "text",
        placeholder: "e.g. 2× Hisense 1.5HP Split ACs, OR Toyota Corolla 2016 1.8L",
        required: true,
      },
      {
        key: "symptoms_and_power",
        label: "Fault symptoms & test readiness",
        type: "text",
        placeholder: "e.g. Blowing warm air / water dripping indoor, OR car cranking but not starting",
        required: true,
      },
    ],
    notesLabel: "Outdoor unit height, parking landmark or additional notes",
    notesPlaceholder: "e.g. Outdoor AC bracket is on 1st-floor wall; car has security tracker/immobiliser; tyre size 225/65 R17…",
    confirmLabel:
      "I confirm the appliance/vehicle and test power (where applicable) will be accessible at the scheduled time.",
    timeSlots: ARTISAN_TIME_SLOTS,
  },

  "artisans-home-domestic-trades": {
    isArtisan: true,
    heading: "Book Cleaning, Laundry, Fumigation, Cobbler or Locksmith Service",
    subtitle:
      "Specify your item count or property size, pickup vs on-site preference, and any fabric, leather, pet or occupant safety instructions.",
    ctaLabel: "Book service / pickup",
    paymentNote:
      "Booked at the listed package rate or confirmed after item/room count — pickup & delivery or home-visit logistics are coordinated directly.",
    tradesCovered: [
      "Laundry & Dry Cleaners",
      "Fumigation & Pest-Control Techs",
      "Post-Construction & Deep Home Cleaners",
      "Cobblers — Shoe, Bag & Leather Repair",
      "Gardeners & Landscapers",
      "Locksmiths & Key Cutters",
      "Signwriters & Glaziers",
    ],
    requirementsTitle: "Domestic & Repair Service Booking Requirements",
    requirements: [
      "For deep cleaning, gardening or lawn work, confirm water and electricity availability at the property.",
      "For fumigation & pest control, occupants, children, pets and uncovered food must vacate treated rooms for 4–6 hours after spraying.",
      "For laundry/dry cleaning & cobbler repairs, declare delicate fabrics (aso-oke, silk, suede, designer leather) or stains during pickup/drop-off.",
      "For locksmith door unlocking or lock replacement, valid proof of residence/ownership of the house or vehicle is mandatory on arrival.",
    ],
    requiresSiteAddress: true,
    siteAddressLabel: "Service or pickup address, LGA & nearest landmark",
    siteAddressPlaceholder: "e.g. No. 9 Marian / Ikot Ekpene Road, Uyo (or state 'Shop drop-off')",
    visitTypes: [
      "On-Site Home / Office Service",
      "Doorstep Pickup & Return Delivery (Laundry / Cobbler)",
      "Post-Construction Cleaning / Fumigation",
      "Urgent Locksmith Call-Out",
      "Shop Drop-Off Appointment",
    ],
    extraFields: [
      {
        key: "items_or_rooms",
        label: "Number of rooms, compound size or items",
        type: "text",
        placeholder: "e.g. 4-bedroom post-construction clean, 25 garments, or 3 pairs leather shoes",
        required: true,
      },
      {
        key: "special_handling",
        label: "Utilities / safety / material notes",
        type: "select",
        options: [
          "Water & electricity available on site",
          "Fumigation — House can be vacated for 4–6 hours (no pets inside)",
          "Pickup & delivery — Delicate fabric / genuine leather care",
          "Locksmith — Proof of ownership ready for verification",
        ],
        required: true,
      },
    ],
    notesLabel: "Special care, pest type or gate instructions",
    notesPlaceholder: "Mention targeted pests (termites, rodents, mosquitoes), suede/white garment stains, lawn grass height…",
    confirmLabel:
      "I confirm the service address/items are ready and I have reviewed the safety, utility and ownership requirements above.",
    timeSlots: ARTISAN_TIME_SLOTS,
  },

  "beauty-personal-care": {
    isArtisan: false,
    heading: "Book a Beauty, Hair, Makeup or Spa Session",
    subtitle: "Choose your preferred date, studio or home-service option, and preparation notes.",
    ctaLabel: "Book session",
    paymentNote: "Your appointment slot is sent directly to the beauty specialist for confirmation.",
    tradesCovered: ["Hairstylists & Braiders", "Barbers", "Makeup Artists", "Nail & Lash Techs", "Spa & Skincare"],
    requirementsTitle: "Appointment Preparation Requirements",
    requirements: [
      "Arrive 10 minutes early (or share exact home-service address if booking mobile glam/barbing).",
      "State whether hair extensions, wigs or attachment bundles are provided by you or purchased from the stylist.",
      "Note any skin sensitivities, scalp allergies or inspo style details in advance.",
    ],
    requiresSiteAddress: false,
    siteAddressLabel: "Service location (leave as Studio or enter home-service address)",
    siteAddressPlaceholder: "e.g. Visit vendor's studio, OR enter your home address for mobile service",
    visitTypes: ["In-Studio Appointment", "Home / Bridal / Event Call-Out"],
    extraFields: [],
    notesLabel: "Style preferences, hair prep or allergy notes",
    notesPlaceholder: "e.g. Knotless waist-length braids (hair washed & blow-dried), soft bridal glam…",
    confirmLabel: "I confirm my preferred appointment date & time and preparation notes above.",
    timeSlots: STUDIO_TIME_SLOTS,
  },
};

const DEFAULT_BOOKING_PROFILE: CategoryBookingProfile = {
  isArtisan: false,
  heading: "Book this service",
  subtitle: "Choose a date, time and location details. The vendor will confirm availability promptly.",
  ctaLabel: "Book this service",
  paymentNote: "Your booking request is sent directly to the vendor with your contact and scope details.",
  tradesCovered: [],
  requirementsTitle: "Service Booking Requirements",
  requirements: [
    "Provide a reachable Nigerian phone/WhatsApp number and email for booking confirmation.",
    "Include clear location details (if on-site) and a concise summary of what you want done.",
    "Give at least 24 hours notice if you need to reschedule your confirmed slot.",
  ],
  requiresSiteAddress: false,
  siteAddressLabel: "Meeting / service location (optional if remote or at vendor's office)",
  siteAddressPlaceholder: "e.g. Vendor office, Online call, or your Uyo address",
  visitTypes: ["Standard Service Session", "Initial Consultation / Assessment", "On-Site Visit"],
  extraFields: [],
  notesLabel: "Project brief, preferences or arrival notes",
  notesPlaceholder: "Share helpful context so the vendor can prepare before your session…",
  confirmLabel: "I confirm the booking date, time and service details entered above are accurate.",
  timeSlots: STUDIO_TIME_SLOTS,
};

export function getCategoryBookingProfile(categorySlug?: string | null): CategoryBookingProfile {
  if (categorySlug === "digital-online-services") return {
    ...DEFAULT_BOOKING_PROFILE,
    heading: "Discuss your digital project", ctaLabel: "Request a project consultation",
    subtitle: "Share a short brief and preferred time for an online consultation. The professional will confirm scope and availability.",
    paymentNote: "A consultation request does not guarantee project acceptance. Agree deliverables, revisions, timeline and price with the professional.",
    requirementsTitle: "A simple project brief",
    requirements: ["Describe the result you need and your preferred deadline.", "Share reference links or files you have permission to use.", "Never share passwords, one-time codes, bank login details or private customer data."],
    siteAddressLabel: "Preferred online meeting method (optional)", siteAddressPlaceholder: "e.g. Google Meet or WhatsApp call; share contact details privately",
    visitTypes: ["Online Project Consultation", "Brief / Requirements Review"],
    notesLabel: "What would you like help with?", notesPlaceholder: "e.g. Edit a 60-second video with captions, needed by Friday. Two revision rounds.",
    confirmLabel: "I understand this is a consultation request; the professional will confirm scope, availability and price.",
  };
  if (!categorySlug) return DEFAULT_BOOKING_PROFILE;
  return CATEGORY_BOOKING_PROFILES[categorySlug] ?? DEFAULT_BOOKING_PROFILE;
}

export function isArtisanCategorySlug(categorySlug?: string | null): boolean {
  return Boolean(categorySlug && categorySlug.startsWith("artisans-"));
}
