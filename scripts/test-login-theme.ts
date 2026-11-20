/** Guard the login palette against drifting away from the site's theme. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/(login)/login/login.css", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");
const palette = new Map([...globals.matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1], match[2]]));

function rule(selector: string) {
  const marker = `${selector} {`;
  const start = css.indexOf(marker);
  assert(start >= 0, `${selector} is styled`);
  const end = css.indexOf("}", start);
  assert(end > start);
  return css.slice(start + marker.length, end);
}

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(foreground: string, background: string, description: string) {
  const fg = foreground.startsWith("#") ? foreground : palette.get(foreground);
  const bg = background.startsWith("#") ? background : palette.get(background);
  assert(fg && bg, `shared palette colors exist for ${description}`);
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  const ratio = (light + 0.05) / (dark + 0.05);
  assert(ratio >= 4.5, `${description}: ${ratio.toFixed(2)}:1 must meet normal-text AA contrast`);
}

for (const [, token] of css.matchAll(/var\((--color-[\w-]+)\)/g)) {
  assert(palette.has(token), `${token} exists in the shared site theme`);
}
assert.match(rule(".ivh-login"), /--login-accent:\s*var\(--color-brand-800\)/);
assert.match(rule(".ivh-login"), /background:\s*var\(--color-ink-900\)/);
for (const token of ["brand-500", "brand-900", "gold-600", "ink-900"]) {
  assert(rule(".ivh-login__background").includes(`var(--color-${token})`), `the backdrop uses the shared ${token} palette`);
}
assert(rule(".ivh-login__bg-circle").includes("var(--color-brand-400)"));
assert(rule(".ivh-login__bg-circle--two").includes("var(--color-gold-500)"));
assert(rule(".ivh-login__bg-circle--three").includes("var(--color-gold-300)"));
for (const selector of [".ivh-login__electric-border::before", ".ivh-login__electric-glow", ".ivh-login__main-btn::before"]) {
  const animated = rule(selector);
  assert(animated.includes("var(--color-brand-"), `${selector} uses the site's emerald greens`);
  assert(animated.includes("var(--color-gold-"), `${selector} uses the site's gold accents`);
}
assert.match(rule(".ivh-login__input-group input:focus"), /border-color:\s*var\(--login-accent\)/);
assert(!/#(?:0757c7|006cff|00cfff|00eaff|00aaff|006580|e7ebf0)|--login-blue|rgb\(163 177 198|rgb\(0 114 255/i.test(css), "old demo-blue animation and cool-grey palette must not return");
assert(css.includes("@media (prefers-reduced-motion: reduce)"));
assert(css.includes("animation: none !important"));
assert(css.includes("transition: none !important"));
assert(css.includes("@media (forced-colors: active)"));

contrast("--color-ink-800", "--color-ink-50", "card text");
contrast("--color-ink-500", "--color-ink-50", "card hints and labels");
contrast("--color-brand-800", "--color-ink-50", "links, labels and normal button text");
for (const background of ["--color-brand-800", "--color-brand-700", "--color-gold-700", "--color-brand-900"]) {
  contrast("#ffffff", background, "white text at every animated button-gradient stop");
}
for (const background of ["--color-ink-900", "--color-brand-900"]) {
  contrast("--color-ink-200", background, "marketplace link on the dark backdrop");
  contrast("--color-gold-300", background, "hovered marketplace link on the dark backdrop");
}
console.log("PASS: shared forest-green/emerald/gold background, floating circles, electric focus and button animations; no demo-blue palette");
console.log("PASS: normal-text AA contrast for card/link/hint colors and all animated button-gradient stops; reduced-motion and forced-colors safeguards retained");
