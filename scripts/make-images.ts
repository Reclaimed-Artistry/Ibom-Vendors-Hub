import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PALETTES: Record<string, [string, string, string]> = {
  food: ["#7c2d12", "#ea580c", "#fbbf24"],
  fashion: ["#831843", "#db2777", "#f9a8d4"],
  shoes: ["#422006", "#b45309", "#fcd34d"],
  electronics: ["#0c4a6e", "#0284c7", "#7dd3fc"],
  beauty: ["#4c1d95", "#8b5cf6", "#ddd6fe"],
  services: ["#064e3b", "#059669", "#6ee7b7"],
  retail: ["#1e293b", "#475569", "#cbd5e1"],
};

function productTile(seed: string, label: string, palette: keyof typeof PALETTES) {
  const [dark, mid, light] = PALETTES[palette];
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g${seed}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <pattern id="p${seed}" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
      <rect width="60" height="60" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="60" stroke="${light}" stroke-opacity="0.12" stroke-width="8"/>
    </pattern>
  </defs>
  <rect width="900" height="900" fill="url(#g${seed})"/>
  <rect width="900" height="900" fill="url(#p${seed})"/>
  <circle cx="740" cy="170" r="300" fill="${light}" opacity="0.10"/>
  <circle cx="160" cy="780" r="220" fill="${light}" opacity="0.08"/>
  <text x="450" y="470" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="250" fill="${light}" opacity="0.92">${initials}</text>
  <text x="450" y="620" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" letter-spacing="6" fill="#ffffff" opacity="0.85">${label
    .toUpperCase()
    .slice(0, 22)}</text>
</svg>`;
}

function cover(seed: string, label: string, palette: keyof typeof PALETTES) {
  const [dark, mid, light] = PALETTES[palette];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600">
  <defs>
    <linearGradient id="c${seed}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${dark}"/><stop offset="60%" stop-color="${mid}"/><stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="r${seed}" cx="80%" cy="10%" r="70%">
      <stop offset="0%" stop-color="${light}" stop-opacity="0.45"/><stop offset="100%" stop-color="${light}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="600" fill="url(#c${seed})"/>
  <rect width="1600" height="600" fill="url(#r${seed})"/>
  <g opacity="0.16" fill="none" stroke="${light}" stroke-width="2">
    ${Array.from({ length: 11 }, (_, i) => `<circle cx="1300" cy="120" r="${80 + i * 55}"/>`).join("")}
  </g>
  <text x="90" y="330" font-family="Georgia, serif" font-size="92" fill="#ffffff" opacity="0.95">${label}</text>
  <text x="94" y="392" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="8" fill="${light}" opacity="0.85">IBOM VENDORS HUB</text>
</svg>`;
}

const logos = [
  ["mamaput-kitchen", "MP", "food"],
  ["royalfashionboutique", "RF", "fashion"],
  ["victorshoes", "VS", "shoes"],
  ["excelelectronics", "EE", "electronics"],
  ["glowbeauty", "GB", "beauty"],
  ["brightfix", "BF", "services"],
  ["uyogadgetmart", "UG", "electronics"],
] as const;

const products: Array<[string, string, keyof typeof PALETTES]> = [
  ["jollof", "Jollof Rice", "food"],
  ["friedrice", "Fried Rice", "food"],
  ["peppersoup", "Goat Pepper Soup", "food"],
  ["afang", "Afang Soup", "food"],
  ["chinchin", "Chinchin", "food"],
  ["ankara", "Ankara Gown", "fashion"],
  ["kaftan", "Silk Kaftan", "fashion"],
  ["agbada", "Agbada Set", "fashion"],
  ["bridal", "Bridal Lace", "fashion"],
  ["loafer", "Leather Loafers", "shoes"],
  ["sandal", "Handmade Sandals", "shoes"],
  ["boot", "Leather Boots", "shoes"],
  ["mules", "Woven Mules", "shoes"],
  ["phone", "Smartphone", "electronics"],
  ["laptop", "Laptop", "electronics"],
  ["tv", "Smart TV", "electronics"],
  ["powerbank", "Power Bank", "electronics"],
  ["sheabutter", "Shea Butter", "beauty"],
  ["hairkit", "Hair Care Kit", "beauty"],
  ["facial", "Facial Treatment", "beauty"],
  ["gele", "Gele Tying", "beauty"],
  ["plumbing", "Plumbing Repair", "services"],
  ["electrical", "Electrical Installation", "services"],
  ["painting", "Interior Painting", "services"],
  ["cctv", "CCTV Installation", "services"],
  ["powerbank2", "Power Bank Pro", "electronics"],
];

export function ensureSeedImages() {
  const dir = path.join(process.cwd(), "public", "images", "seed");
  mkdirSync(dir, { recursive: true });
  for (const [slug, initials, palette] of logos) {
    writeFileSync(path.join(dir, `logo-${slug}.svg`), productTile(slug, initials, palette));
    writeFileSync(path.join(dir, `cover-${slug}.svg`), cover(slug, slug.replace(/-/g, " "), palette));
  }
  for (const [slug, label, palette] of products) {
    writeFileSync(path.join(dir, `product-${slug}.svg`), productTile(slug, label, palette));
  }
  return "/images/seed";
}

if (process.argv[1]?.includes("make-images")) {
  ensureSeedImages();
  console.log("Seed images written to public/images/seed");
}
