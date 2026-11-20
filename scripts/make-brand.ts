/**
 * Brand asset pipeline, always derived from the owner's supplied artwork.
 *
 * The site/email/social/organization lockups retain the entire logo, including
 * its wordmark and tagline. Only favicons/touch icons use the existing shopping
 * bag, map, cart and swoosh by itself, so it remains recognisable at search/tab
 * sizes. The source file and the visible site's full lockups are not cropped.
 *
 *   tsx scripts/make-brand.ts                 # all derivatives
 *   tsx scripts/make-brand.ts --search-only   # only search/favicon assets
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { FAVICON_SIZES, ORGANIZATION_LOGO } from "../src/lib/brand-assets";

const SOURCE = "assets/brand/logo-source.png";
const OUT = "public/brand";
const SEARCH_ONLY = process.argv.includes("--search-only");

// Full wordmark + tagline: the same source rectangle used by the site lockups.
const BOX = { left: 43, top: 212, width: 1442, height: 500 };
// The existing standalone emblem, above the tagline and left of the wordmark.
// Includes safe transparent padding around the bag and the complete orange swoosh.
const MARK_BOX = { left: 36, top: 204, width: 484, height: 424 };

async function main() {
  mkdirSync(OUT, { recursive: true });
  const trimmed = await sharp(SOURCE).ensureAlpha().extract(BOX).png().toBuffer();
  const mark = await sharp(SOURCE).ensureAlpha().extract(MARK_BOX).png().toBuffer();

  if (!SEARCH_ONLY) {
    // Full lockups used on the website and in email remain uncropped.
    await sharp(trimmed).resize({ width: 1200 }).webp({ quality: 92 }).toFile(`${OUT}/ibom-vendors-hub-logo.webp`);
    await sharp(trimmed).resize({ width: 1200 }).png({ compressionLevel: 9 }).toFile(`${OUT}/ibom-vendors-hub-logo.png`);
    await sharp(trimmed).resize({ width: 480 }).png({ compressionLevel: 9 }).toFile(`${OUT}/ibom-vendors-hub-logo-small.png`);

    // Social card: complete lockup centred on a white card, on brand-dark canvas.
    const canvas = { width: 1200, height: 630 };
    const card = { width: 1080, height: 520, left: 60, top: 55 };
    const cardLogo = await sharp(trimmed).resize({ width: 940 }).png().toBuffer();
    const cardMeta = await sharp(cardLogo).metadata();
    const whiteCard = await sharp({ create: { width: card.width, height: card.height, channels: 4, background: "#ffffff" } })
      .png().toBuffer();
    await sharp({ create: { ...canvas, channels: 4, background: "#0b3d2c" } })
      .composite([
        { input: whiteCard, left: card.left, top: card.top },
        {
          input: cardLogo,
          left: card.left + Math.round((card.width - cardMeta.width!) / 2),
          top: card.top + Math.round((card.height - cardMeta.height!) / 2),
        },
      ])
      .png({ compressionLevel: 9 }).toFile(`${OUT}/og-image.png`);
  }

  // A separate, high-resolution full logo for Organization JSON-LD. Flattening
  // onto white ensures the green wordmark is legible on any viewer background.
  await sharp(trimmed)
    .flatten({ background: "#ffffff" })
    .resize({ width: ORGANIZATION_LOGO.width - 48, height: ORGANIZATION_LOGO.height - 48, fit: "contain", background: "#ffffff" })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toFile(`public${ORGANIZATION_LOGO.path}`);

  // An opaque white square works on search's white background, dark browser
  // chrome and iOS (which applies its own mask). No tiny wordmark or tagline.
  async function squareIcon(size: number) {
    const padding = Math.max(1, Math.round(size * 0.06));
    return sharp(mark)
      .flatten({ background: "#ffffff" })
      .resize({ width: size - padding * 2, height: size - padding * 2, fit: "contain", background: "#ffffff" })
      .extend({ top: padding, bottom: padding, left: padding, right: padding, background: "#ffffff" })
      .png({ compressionLevel: 9 }).toBuffer();
  }

  const icons = new Map<number, Buffer>();
  for (const size of [...FAVICON_SIZES, 180, 512]) icons.set(size, await squareIcon(size));
  for (const size of [32, 48, 96]) writeFileSync(`${OUT}/favicon-${size}.png`, icons.get(size)!);
  writeFileSync("src/app/icon.png", icons.get(256)!);
  writeFileSync("src/app/apple-icon.png", icons.get(180)!);
  writeFileSync(`${OUT}/icon-512.png`, icons.get(512)!);

  // Multi-resolution ICO, including Google's recommended >48px resolution.
  // Each directory entry points to one PNG. A zero size byte represents 256px.
  const directory = Buffer.alloc(6 + FAVICON_SIZES.length * 16);
  directory.writeUInt16LE(1, 2); // icon, not cursor
  directory.writeUInt16LE(FAVICON_SIZES.length, 4);
  let offset = directory.length;
  const images: Buffer[] = [];
  FAVICON_SIZES.forEach((size, index) => {
    const image = icons.get(size)!;
    const entry = 6 + index * 16;
    directory[entry] = size === 256 ? 0 : size;
    directory[entry + 1] = size === 256 ? 0 : size;
    directory.writeUInt16LE(1, entry + 4); // planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    images.push(image);
    offset += image.length;
  });
  writeFileSync("public/favicon.ico", Buffer.concat([directory, ...images]));

  console.log(`${SEARCH_ONLY ? "Search/favicon" : "All brand"} assets written; ICO resolutions: ${FAVICON_SIZES.join(", ")}px.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
