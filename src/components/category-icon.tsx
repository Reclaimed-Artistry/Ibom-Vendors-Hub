import { PartyPopper, Hotel, Truck, Blocks, GraduationCap, Printer, Car, Laptop, Wine, Package, House, Building2, ChefHat, Shirt, Footprints, MonitorSmartphone, Gem, Hammer, Zap, Droplets, PaintRoller, HardHat, Wrench, Sparkles, BriefcaseBusiness, ShoppingBasket, Sprout, Store, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  party: PartyPopper, hotel: Hotel, truck: Truck, basket: ShoppingBasket,
  blocks: Blocks, graduation: GraduationCap, printer: Printer, car: Car, digital: Laptop, wine: Wine, package: Package, house: House,
  utensils: ChefHat, shirt: Shirt, footprints: Footprints,
  cpu: MonitorSmartphone, sparkles: Gem, hammer: Hammer, zap: Zap,
  droplets: Droplets, paintbrush: PaintRoller, "hard-hat": HardHat,
  wrench: Wrench, scissors: Sparkles, briefcase: BriefcaseBusiness,
  "shopping-bag": ShoppingBasket, building: Building2, sprout: Sprout,
};

/** Decorative category artwork: layered enamel, metallic rim and engraved symbol. */
export function CategoryIcon({ name }: { name: string | null }) {
  const Icon = ICONS[name ?? ""] ?? Store;
  return (
    <span aria-hidden="true" className="relative isolate block size-16 shrink-0 transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none">
      <span className="absolute inset-x-2 bottom-0 h-3 rounded-full bg-ink-900/20 blur-md" />
      <span className="absolute inset-0 overflow-hidden rounded-[20px] border border-white/70 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),inset_0_-2px_3px_rgba(0,0,0,0.2),0_6px_14px_-5px_rgba(15,23,42,0.35)]">
        <span className="absolute -right-3 -top-4 size-14 rounded-full bg-white/20 blur-lg" />
        <span className="absolute inset-[5px] rounded-[15px] border border-gold-300/40" />
        <span className="absolute inset-x-2 top-[6px] h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <Icon className="absolute left-4 top-3.5 size-8 -rotate-6 text-gold-100" style={{ fill: "rgba(255,255,255,0.10)", filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.3))" }} strokeWidth={1.5} />
        <span className="absolute bottom-[9px] right-[9px] size-1 rounded-full bg-gold-300 shadow-[0_0_5px_rgba(248,223,165,0.5)]" />
      </span>
    </span>
  );
}
