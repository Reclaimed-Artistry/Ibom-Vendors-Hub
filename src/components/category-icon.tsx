import { Building2, ChefHat, Shirt, Footprints, MonitorSmartphone, Gem, Hammer, Zap, Droplets, PaintRoller, HardHat, Wrench, Sparkles, BriefcaseBusiness, ShoppingBasket, Sprout, Store, type LucideIcon } from "lucide-react";

const STYLES: Record<string, { icon: LucideIcon; background: string; glow: string }> = {
  utensils: { icon: ChefHat, background: "from-[#783c22] via-[#a15c31] to-[#d39754]", glow: "#fbd38d" },
  shirt: { icon: Shirt, background: "from-[#47315e] via-[#76537f] to-[#b58eac]", glow: "#f5d0e8" },
  footprints: { icon: Footprints, background: "from-[#3d302c] via-[#705247] to-[#b38a6e]", glow: "#e8c5a0" },
  cpu: { icon: MonitorSmartphone, background: "from-[#173858] via-[#2b5876] to-[#74a4b6]", glow: "#b1e3f1" },
  sparkles: { icon: Gem, background: "from-[#783f54] via-[#a4627a] to-[#d4a2af]", glow: "#ffd6df" },
  hammer: { icon: Hammer, background: "from-[#65432a] via-[#92704b] to-[#c3a478]", glow: "#f6dba9" },
  zap: { icon: Zap, background: "from-[#64501c] via-[#9a7929] to-[#d4b45e]", glow: "#fff1b8" },
  droplets: { icon: Droplets, background: "from-[#164b5c] via-[#2c7b8e] to-[#7ab5bc]", glow: "#bcf3ef" },
  paintbrush: { icon: PaintRoller, background: "from-[#493e73] via-[#74649f] to-[#b1a4cc]", glow: "#e1d4ff" },
  "hard-hat": { icon: HardHat, background: "from-[#744223] via-[#ab713c] to-[#d8ad72]", glow: "#ffe4b2" },
  wrench: { icon: Wrench, background: "from-[#263d4c] via-[#4a6878] to-[#90a8b5]", glow: "#d2e8f2" },
  scissors: { icon: Sparkles, background: "from-[#29534b] via-[#518476] to-[#98bca1]", glow: "#d3eed7" },
  briefcase: { icon: BriefcaseBusiness, background: "from-[#243a62] via-[#4b6592] to-[#94a5c4]", glow: "#d7e4ff" },
  "shopping-bag": { icon: ShoppingBasket, background: "from-[#5f4e36] via-[#927b58] to-[#c2ae87]", glow: "#f7e8c5" },
  building: { icon: Building2, background: "from-[#203e3a] via-[#497268] to-[#93b3a1]", glow: "#d8e8cf" },
  sprout: { icon: Sprout, background: "from-[#304823] via-[#64834b] to-[#a7b87d]", glow: "#eef5be" },
};
const FALLBACK = { icon: Store, background: "from-[#24473f] via-[#4b7d6d] to-[#96b8a1]", glow: "#e3eacb" };

/** Decorative category artwork: layered enamel, metallic rim and engraved symbol. */
export function CategoryIcon({ name }: { name: string | null }) {
  const style = STYLES[name ?? ""] ?? FALLBACK;
  const Icon = style.icon;
  return (
    <span aria-hidden="true" className="relative isolate block size-16 shrink-0 transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none">
      <span className="absolute inset-x-2 bottom-0 h-3 rounded-full bg-ink-900/20 blur-md" />
      <span className={`absolute inset-0 overflow-hidden rounded-[20px] border border-white/70 bg-gradient-to-br ${style.background} shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),inset_0_-2px_3px_rgba(0,0,0,0.2),0_6px_14px_-5px_rgba(15,23,42,0.35)]`}>
        <span className="absolute -right-3 -top-4 size-14 rounded-full bg-white/20 blur-lg" />
        <span className="absolute inset-[5px] rounded-[15px] border border-[#f4dfae]/40" />
        <span className="absolute inset-x-2 top-[6px] h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <Icon className="absolute left-4 top-3.5 size-8 -rotate-6" style={{ color: style.glow, fill: "rgba(255,255,255,0.10)", filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.3))" }} strokeWidth={1.5} />
        <span className="absolute bottom-[9px] right-[9px] size-1 rounded-full bg-[#f8dfa5] shadow-[0_0_5px_rgba(248,223,165,0.5)]" />
      </span>
    </span>
  );
}
