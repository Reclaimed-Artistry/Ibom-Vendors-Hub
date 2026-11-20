/** Real auth actions against an isolated local production build; never production data. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request, type IncomingHttpHeaders } from "node:http";
import { JSDOM } from "jsdom";
import { jwtVerify } from "jose";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { systemDb, withSystem } from "../src/lib/db";

const BASE = process.env.LOGIN_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const HOST = "www.ibomvendorshub.com";
const SECRET = process.env.LOGIN_TEST_AUTH_SECRET ?? "local-category-preview-auth-secret-only";

async function http(path: string, data?: FormData, cookie = "") {
  let body: Buffer | undefined;
  let contentType: string | undefined;
  if (data) {
    const encoded = new Request("http://local.test", { method: "POST", body: data });
    body = Buffer.from(await encoded.arrayBuffer());
    contentType = encoded.headers.get("content-type")!;
  }
  return new Promise<{ status: number; text: string; headers: IncomingHttpHeaders }>((resolve, reject) => {
    const req = request(new URL(path, BASE), {
      method: data ? "POST" : "GET",
      headers: { host: HOST, origin: `https://${HOST}`, cookie, ...(body ? { "content-type": contentType!, "content-length": body.length } : {}) },
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, text, headers: response.headers }));
      response.on("error", reject);
    });
    req.setTimeout(30000, () => req.destroy(new Error(`Auth HTTP timeout: ${path}`)));
    req.on("error", reject);
    req.end(body);
  });
}

function form(html: string, selector: string) {
  const dom = new JSDOM(html);
  try {
    const element = dom.window.document.querySelector(selector)?.closest("form");
    assert(element, selector);
    // The back face is disabled in initial SSR; the flip enables it in-browser.
    for (const fieldset of element.querySelectorAll("fieldset")) fieldset.disabled = false;
    const data = new FormData();
    for (const [key, value] of new dom.window.FormData(element).entries()) if (typeof value === "string") data.append(key, value);
    assert([...data.keys()].some((key) => key.startsWith("$ACTION_")), "uses a real Next server action, not the uploaded demo handler");
    return data;
  } finally { dom.window.close(); }
}

function session(headers: IncomingHttpHeaders) {
  return headers["set-cookie"]?.find((cookie) => cookie.startsWith("ivh_session_shared="));
}

async function main() {
  assert(["127.0.0.1", "localhost"].includes(new URL(BASE).hostname), "Never submit fixture actions to production");
  assert(["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres").hostname), "Local database only");
  const prefix = `login-http-${randomUUID()}`;
  const emails = ["customer", "vendor", "admin", "google", "suspended", "signup", "legacy"].map((suffix) => `${prefix}-${suffix}@example.test`);
  const password = "LocalLoginFixture123!";
  try {
    const hash = await hashPassword(password);
    for (const [index, role] of ["customer", "vendor", "admin", "customer", "customer"].entries()) {
      await systemDb.execute(`insert into users(email,full_name,password_hash,role,status,email_verified_at) values($1,'Local Login Tester',$2,$3,$4,now())`,
        [emails[index], index === 3 ? null : hash, role, index === 4 ? "suspended" : "active"]);
    }
    const page = await http("/login?next=%2Fcheckout%3Fstore%3Dfixture");
    assert.equal(page.status, 200);
    assert(page.text.includes('data-login-design="neumorphic"'));
    assert(page.text.includes("Sign in to continue to checkout"));
    assert(page.text.includes("Your cart items are saved on this device"));
    assert(!page.text.includes("One login. Every part of your business."), "the new full-screen design is not nested in the old split layout");
    assert(String(page.headers["x-robots-tag"]).includes("noindex"));
    assert(/name="robots" content="noindex/.test(page.text));
    assert(!page.text.includes("cdnjs.cloudflare.com") && !page.text.includes("fonts.googleapis.com"), "fonts and icons are self-hosted, not CDN-dependent");
    const submitLogin = async (email: string, extra: Record<string, string> = {}, suppliedPassword = password) => {
      const data = form(page.text, 'form[aria-label="Sign in"]');
      data.set("email", email); data.set("password", suppliedPassword); data.delete("next"); data.delete("rememberMe");
      for (const [key, value] of Object.entries(extra)) data.set(key, value);
      return http("/login", data);
    };
    for (const [email, suppliedPassword, message] of [
      [emails[0], "WrongPassword123!", "Incorrect password"],
      [`missing-${prefix}@example.test`, password, "No account found"],
      [emails[3], password, "created with Google sign-in"],
      [emails[4], password, "has been suspended"],
    ]) {
      const result = await submitLogin(email, {}, suppliedPassword);
      assert.equal(result.status, 200);
      assert(result.text.includes(message), message);
      assert.equal(session(result.headers), undefined, "failed login must not issue a session or fake success");
    }
    console.log("PASS: real server-rendered card, checkout notices, private metadata and honest wrong-password/missing/Google-only/suspended-account errors");

    const signedIn = await submitLogin(emails[0].toUpperCase(), { next: "/checkout?store=fixture" });
    assert.equal(signedIn.status, 303);
    assert.equal(signedIn.headers.location, "/checkout?store=fixture");
    const browserSession = session(signedIn.headers); assert(browserSession);
    assert(!/max-age=|expires=/i.test(browserSession), "unchecked Remember me creates a browser-session cookie");
    assert(/httponly/i.test(browserSession) && /samesite=lax/i.test(browserSession));
    assert(/domain=\.ibomvendorshub\.com/i.test(browserSession), "shared storefront login boundary is retained");
    const token = browserSession.split(";")[0].slice("ivh_session_shared=".length);
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET));
    assert.equal(payload.email, emails[0]); assert.equal(payload.role, "customer");
    const authed = await http("/login?next=%2Fcheckout", undefined, browserSession.split(";")[0]);
    assert.equal(authed.status, 307); assert.equal(authed.headers.location, "/checkout");
    const remembered = await submitLogin(emails[0], { rememberMe: "on" });
    assert.equal(remembered.headers.location, "/account");
    assert(/max-age=2592000/i.test(session(remembered.headers)!), "Remember me keeps the existing 30-day maximum");
    for (const [index, expected] of [[1, "/vendor"], [2, "/admin"]] as const) {
      const result = await submitLogin(emails[index], { next: "//attacker.example" });
      assert.equal(result.status, 303); assert.equal(result.headers.location, expected);
    }
    console.log("PASS: real password verification, role redirects, safe checkout returns, shared HTTP-only cookies, working 30-day Remember me and existing-user redirects");

    const signupData = (overrides: Record<string, string> = {}) => {
      const data = form(page.text, 'form[aria-label="Create account"]');
      for (const [key, value] of Object.entries({ fullName: "New Local Account", email: emails[5], password, confirmPassword: password, acceptTerms: "on", next: "/checkout?store=fixture", ...overrides })) data.set(key, value);
      return data;
    };
    for (const [overrides, message] of [
      [{ confirmPassword: "DifferentPassword123!" }, "Passwords do not match"],
      [{ acceptTerms: "" }, "You must accept the terms"],
      [{ password: "12345678", confirmPassword: "12345678" }, "Include at least one letter"],
    ] as const) {
      const result = await http("/login", signupData(overrides));
      assert.equal(result.status, 200); assert(result.text.includes(message), message);
      assert.equal(session(result.headers), undefined);
      assert.equal((await systemDb.one(`select count(*)::int n from users where email=$1`, [emails[5]])).n, 0);
    }
    const created = await http("/login", signupData());
    assert.equal(created.status, 303, created.text.slice(-400));
    assert.equal(created.headers.location, "/checkout?store=fixture");
    assert(session(created.headers));
    const user = await systemDb.one<{ id: string; role: string; password_hash: string; full_name: string }>(`select id,role,password_hash,full_name from users where email=$1`, [emails[5]]);
    assert.equal(user.role, "customer"); assert.equal(user.full_name, "New Local Account");
    assert(user.password_hash !== password && await verifyPassword(password, user.password_hash));
    assert.equal((await systemDb.one(`select count(*)::int n from customer_profiles where user_id=$1`, [user.id])).n, 1);
    assert.equal((await systemDb.one(`select count(*)::int n from auth_tokens where user_id=$1 and type='verify_email'`, [user.id])).n, 1);
    const duplicate = await http("/login", signupData());
    assert.equal(duplicate.status, 200); assert(duplicate.text.includes("already exists"));
    assert.equal((await systemDb.one(`select count(*)::int n from users where email=$1`, [emails[5]])).n, 1);
    console.log("PASS: real flip-side registration, server-enforced confirmation/password/terms, hashed password, customer profile, verification token and duplicate-email protection");

    const legacy = await http("/register/customer");
    assert.equal(legacy.status, 200);
    assert(!legacy.text.includes('data-login-design="neumorphic"'), "standalone registration retains its existing layout");
    const legacyData = form(legacy.text, 'input[name="fullName"]');
    for (const [key, value] of Object.entries({ fullName: "Legacy Local Account", email: emails[6], phone: "08031234567", password, acceptTerms: "on", next: "//attacker.example" })) legacyData.set(key, value);
    assert.equal(legacyData.has("confirmPassword"), false);
    const legacyCreated = await http("/register/customer", legacyData);
    assert.equal(legacyCreated.status, 303); assert.equal(legacyCreated.headers.location, "/account");
    assert(/max-age=2592000/i.test(session(legacyCreated.headers)!), "other account-creation flows retain their existing cookie default");

    const forgot = await http("/forgot-password");
    assert.equal(forgot.status, 200); assert(!forgot.text.includes('data-login-design="neumorphic"'));
    const forgotData = form(forgot.text, 'input[name="email"]'); forgotData.set("email", emails[0]);
    const requested = await http("/forgot-password", forgotData);
    assert.equal(requested.status, 200); assert(requested.text.includes("a reset link is on its way"));
    const resetEmail = await systemDb.one<{ payload: { link: string } }>(`select payload from email_logs where to_email=$1 and template='reset_password' order by created_at desc limit 1`, [emails[0]]);
    const resetUrl = new URL(resetEmail.payload.link);
    const reset = await http(`${resetUrl.pathname}${resetUrl.search}`);
    assert.equal(reset.status, 200);
    const resetData = form(reset.text, 'input[name="token"]');
    const newPassword = "ChangedLocalPassword123!";
    resetData.set("password", newPassword); resetData.set("confirmPassword", newPassword);
    const updated = await http(`${resetUrl.pathname}${resetUrl.search}`, resetData);
    assert.equal(updated.status, 303); assert.equal(updated.headers.location, "/login?reset=1");
    const resetNotice = await http("/login?reset=1");
    assert(resetNotice.text.includes("Password updated. Sign in with your new password."));
    assert.equal((await submitLogin(emails[0], {}, password)).status, 200, "old password stops working");
    assert.equal((await submitLogin(emails[0], {}, newPassword)).status, 303, "new password signs into the redesigned login");
    console.log("PASS: unchanged standalone registration, safe legacy redirects, password-reset request/token/consumption/new-password login and reset-success notice");
  } finally {
    await withSystem(async (db) => {
      const users = await db.query<{ id: string }>(`select id from users where email=any($1::text[])`, [emails]);
      if (users.length) await db.execute(`delete from activity_logs where actor_id=any($1::uuid[])`, [users.map((user) => user.id)]);
      await db.execute(`delete from email_logs where to_email=any($1::text[])`, [emails]);
      await db.execute(`delete from users where email=any($1::text[])`, [emails]);
    });
    assert.equal((await systemDb.one(`select count(*)::int n from users where email=any($1::text[])`, [emails])).n, 0);
    console.log("PASS: all local auth fixtures, tokens, profiles and email logs cleaned up");
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
