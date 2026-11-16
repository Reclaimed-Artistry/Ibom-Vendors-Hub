/**
 * Brand asset pipeline.
 *
 * The supplied artwork is a transparent PNG with generous empty margins. We
 * never crop the lockup itself — only the fully transparent padding is removed
 * (exact alpha bounding box) so the mark scales predictably in layouts. Every
 * derivative below therefore contains the complete logo: shopping bag, wordmark,
 * swoosh and the "One Hub. Every business. Endless opportunities." tagline.
 *
 *   tsx scripts/make-brand.ts
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SOURCE = "assets/brand/logo-source.png";
const OUT = "public/brand";

// Alpha bounding box of the artwork inside the 1536×1024 canvas, plus a 2px
// safety margin so no anti-aliased edge pixel is clipped.
const BOX = { left: 43, top: 212, width: 1442, height: 500 };

async function main() {
  mkdirSync(OUT, { recursive: true });
  const trimmed = await sharp(SOURCE).ensureAlpha().extract(BOX).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  console.log(`lockup: ${meta.width}×${meta.height} (${(meta.width! / meta.height!).toFixed(2)}:1)`);

  // Full lockup — web (webp + png fallback), email and OG use.
  await sharp(trimmed).resize({ width: 1200 }).webp({ quality: 92 }).toFile(`${OUT}/ibom-vendors-hub-logo.webp`);
  await sharp(trimmed).resize({ width: 1200 }).png({ compressionLevel: 9 }).toFile(`${OUT}/ibom-vendors-hub-logo.png`);
  await sharp(trimmed).resize({ width: 480 }).png({ compressionLevel: 9 }).toFile(`${OUT}/ibom-vendors-hub-logo-small.png`);

  // Square icons: the whole lockup, letterboxed on white — never cropped.
  for (const [name, size, pad] of [
    ["src/app/icon.png", 256, 0.1],
    ["src/app/apple-icon.png", 180, 0.1],
    ["public/brand/icon-512.png", 512, 0.12],
  ] as const) {
    const inner = Math.round(size * (1 - pad * 2));
    const scaled = await sharp(trimmed).resize({ width: inner, height: inner, fit: "inside" }).png().toBuffer();
    const scaledMeta = await sharp(scaled).metadata();
    await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
      .composite([
        {
          input: scaled,
          left: Math.round((size - scaledMeta.width!) / 2),
          top: Math.round((size - scaledMeta.height!) / 2),
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(name);
  }

  // Social card: brand-dark canvas with the complete lockup centred on a white card.
  const canvas = { width: 1200, height: 630 };
  const card = { width: 1080, height: 520, left: 60, top: 55 };
  const cardLogo = await sharp(trimmed).resize({ width: 940 }).png().toBuffer();
  const cardMeta = await sharp(cardLogo).metadata();
  const whiteCard = await sharp({
    create: { ...card, channels: 4, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  await sharp({ create: { ...canvas, channels: 4, background: "#0b3d2c" } })
    .composite([
      { input: whiteCard, left: card.left, top: card.top },
      {
        input: cardLogo,
        left: card.left + Math.round((card.width - cardMeta.width!) / 2),
        top: card.top + Math.round((card.height - cardMeta.height!) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/og-image.png`);

  console.log("brand assets written to public/brand, src/app/icon.png, src/app/apple-icon.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
