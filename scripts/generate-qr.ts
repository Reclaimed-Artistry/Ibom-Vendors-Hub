import QRCode from "qrcode";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Jimp } = require("jimp");

/**
 * Generate a QR code for the Ibom Vendors Hub website with the logo in the center.
 * Usage: tsx scripts/generate-qr.ts [url]
 * Defaults to http://localhost:3000 if no URL is provided.
 */
async function main() {
  const url = process.argv[2] || "http://localhost:3000";
  const outputPath = path.resolve(__dirname, "../public/brand/qr-code.png");
  const logoPath = path.resolve(__dirname, "../public/brand/ibom-vendors-hub-logo-small.png");

  console.log(`Generating QR code for: ${url}`);
  console.log(`Logo: ${logoPath}`);
  console.log(`Output: ${outputPath}`);

  // Generate QR code as a PNG buffer (high error correction so logo overlay is safe)
  const qrBuffer = await QRCode.toBuffer(url, {
    type: "png",
    width: 800,
    margin: 2,
    color: {
      dark: "#065f46", // brand-800 deep green
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H", // highest — allows up to 30% damage for logo overlay
  });

  // Load QR code and logo
  const qrImage = await Jimp.read(qrBuffer);
  const logo = await Jimp.read(logoPath);

  // Size logo to ~20% of QR code width
  const logoSize = Math.floor(qrImage.bitmap.width * 0.2);
  logo.resize({ w: logoSize, h: logoSize });

  // Create a white background square behind the logo so the logo is not transparent
  const pad = Math.floor(logoSize * 0.18);
  const whiteBoxSize = logoSize + pad * 2;
  const whiteBox = new Jimp({ width: whiteBoxSize, height: whiteBoxSize, color: 0xffffffff }); // solid white

  // Composite the white box first, then the logo on top of it
  const boxX = (qrImage.bitmap.width - whiteBox.bitmap.width) / 2;
  const boxY = (qrImage.bitmap.height - whiteBox.bitmap.height) / 2;
  qrImage.composite(whiteBox, boxX, boxY, {
    mode: Jimp.BLEND_SOURCE_OVER,
    opacitySource: 1,
    opacityDest: 1,
  });

  // Composite logo in the center (on top of the white box)
  const x = (qrImage.bitmap.width - logo.bitmap.width) / 2;
  const y = (qrImage.bitmap.height - logo.bitmap.height) / 2;
  qrImage.composite(logo, x, y, {
    mode: Jimp.BLEND_SOURCE_OVER,
    opacitySource: 1,
    opacityDest: 1,
  });

  const buf = await qrImage.getBuffer("image/png");
  await fs.writeFile(outputPath, buf);
  console.log(`✅ QR code saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Failed to generate QR code:", err);
  process.exit(1);
});
