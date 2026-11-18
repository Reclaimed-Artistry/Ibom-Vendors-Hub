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
import { mkdirSync, writeFileSync } from "node:fs";

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
  //
  // The browser icon is a rounded square with transparent corners so it sits
  // comfortably next to other tabs. apple-icon stays a full bleed square: iOS
  // applies its own mask and paints any transparency black.
  const roundedMask = (size: number) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
        `<rect x="0" y="0" width="${size}" height="${size}" rx="${Math.round(size * 0.225)}" ry="${Math.round(size * 0.225)}" fill="#ffffff"/>` +
        `</svg>`,
    );

  for (const [name, size, pad, rounded] of [
    ["src/app/icon.png", 256, 0.1, true],
    ["src/app/apple-icon.png", 180, 0.1, false],
    ["public/brand/icon-512.png", 512, 0.12, true],
  ] as const) {
    const inner = Math.round(size * (1 - pad * 2));
    const scaled = await sharp(trimmed).resize({ width: inner, height: inner, fit: "inside" }).png().toBuffer();
    const scaledMeta = await sharp(scaled).metadata();
    let tile = await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
      .composite([
        {
          input: scaled,
          left: Math.round((size - scaledMeta.width!) / 2),
          top: Math.round((size - scaledMeta.height!) / 2),
        },
      ])
      .png()
      .toBuffer();

    if (rounded) {
      tile = await sharp(tile)
        .composite([{ input: roundedMask(size), blend: "dest-in" }])
        .png()
        .toBuffer();
    }

    await sharp(tile).png({ compressionLevel: 9 }).toFile(name);
  }

  // Explicit public favicons work on every storefront origin, including
  // browsers that request /favicon.ico without inspecting page metadata.
  const smallIcon = await sharp("src/app/icon.png").resize(32, 32).png().toBuffer();
  writeFileSync(`${OUT}/favicon-32.png`, smallIcon);
  // ICO container with a PNG-encoded image (supported by modern browsers).
  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(1, 2); // icon type
  icoHeader.writeUInt16LE(1, 4); // one image
  icoHeader[6] = 32;
  icoHeader[7] = 32;
  icoHeader.writeUInt16LE(1, 10);
  icoHeader.writeUInt16LE(32, 12);
  icoHeader.writeUInt32LE(smallIcon.length, 14);
  icoHeader.writeUInt32LE(22, 18);
  writeFileSync("public/favicon.ico", Buffer.concat([icoHeader, smallIcon]));

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
