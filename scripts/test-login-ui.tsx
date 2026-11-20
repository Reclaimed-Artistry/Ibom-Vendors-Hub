/** Login-card interactions and validation. No network requests or DB writes. */
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { customerRegisterSchema } from "../src/lib/validation";

async function main() {
  const account = { fullName: "Login Design Tester", email: "login-design@example.test", password: "FixturePassword123!", acceptTerms: "on" };
  assert(customerRegisterSchema.safeParse(account).success, "existing registration without confirmation remains compatible");
  assert(customerRegisterSchema.safeParse({ ...account, confirmPassword: account.password }).success);
  for (const confirmPassword of ["", "DifferentPassword123!"]) {
    const invalid = customerRegisterSchema.safeParse({ ...account, confirmPassword });
    assert(!invalid.success);
    assert(invalid.error.issues.some((issue) => issue.path[0] === "confirmPassword"));
  }
  assert(!customerRegisterSchema.safeParse({ ...account, acceptTerms: "" }).success);
  assert(!customerRegisterSchema.safeParse({ ...account, password: "12345678" }).success);

  const dom = new JSDOM("<!doctype html><html><body><div id='test-root'></div></body></html>", { url: "http://localhost:3000/login" });
  const errors: string[] = [];
  dom.window.addEventListener("error", (event) => errors.push(event.message));
  Object.assign(globalThis, {
    window: dom.window, self: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement,
    FormData: dom.window.FormData, React, IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import("react-dom/client");
  const { LoginExperience } = await import("../src/components/login-experience");
  const root = createRoot(dom.window.document.getElementById("test-root")!);
  const find = <T extends Element>(selector: string) => { const node = dom.window.document.querySelector<T>(selector); assert(node, selector); return node; };
  const click = async (selector: string) => { await act(async () => find<HTMLElement>(selector).click()); };
  const fill = async (selector: string, value: string) => {
    await act(async () => {
      const input = find<HTMLInputElement>(selector);
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  const next = "/checkout?store=local-test&delivery=pickup";
  try {
    await act(async () => root.render(
      <LoginExperience next={next} googleLogin={<a href="/auth/google">Continue with Google</a>} googleSignup={<a href="/auth/google">Sign up with Google</a>} />,
    ));
    assert.equal(find("[data-login-design]").getAttribute("data-login-design"), "neumorphic");
    assert.equal(find(".ivh-login__card").getAttribute("data-mode"), "login");
    assert.equal(find("#signup-panel").getAttribute("aria-hidden"), "true");
    assert(find("#signup-panel").hasAttribute("inert"));
    assert(find<HTMLFieldSetElement>("#signup-panel fieldset").disabled);
    assert.equal(dom.window.document.querySelectorAll(".ivh-login__bg-circle").length, 3);
    assert(find('a[aria-label="Ibom Vendors Hub — home"]'));
    assert(find('a[aria-label="Ibom Vendors Hub — home"] > span').classList.contains("bg-white"), "the official logo stays readable on the dark themed backdrop");
    assert.equal(find('a[href="/forgot-password"]').textContent, "Forgot password?");
    assert.equal(find<HTMLInputElement>('form[aria-label="Sign in"] [name="next"]').value, next);
    assert.equal(find<HTMLInputElement>("#loginPassword").autocomplete, "current-password");
    assert.equal(find<HTMLInputElement>("#signupPassword").autocomplete, "new-password");
    const ids = [...dom.window.document.querySelectorAll("[id]")].map((element) => element.id);
    assert.equal(new Set(ids).size, ids.length, "the two faces never duplicate password, label or icon IDs");
    for (const label of dom.window.document.querySelectorAll<HTMLLabelElement>("label[for]")) assert(label.control, `${label.htmlFor} is associated with an input`);

    await fill("#loginEmail", "kept@example.test");
    await fill("#loginPassword", "KeepThisPassword123!");
    await click('[aria-controls="loginPassword"]');
    assert.equal(find<HTMLInputElement>("#loginPassword").type, "text");
    assert.equal(find('[aria-controls="loginPassword"]').getAttribute("aria-pressed"), "true");
    assert.equal(find<HTMLInputElement>("#signupPassword").type, "password", "each password toggle controls only its own field");
    await click('[aria-controls="loginPassword"]');
    await click('[name="rememberMe"]');
    let payload = new dom.window.FormData(find<HTMLFormElement>('form[aria-label="Sign in"]'));
    assert.equal(payload.get("rememberMe"), "on");
    assert.equal(payload.get("email"), "kept@example.test");

    const signupLink = find<HTMLAnchorElement>('[aria-label="Create an account"]');
    assert.equal(signupLink.getAttribute("href"), `/register/customer?next=${encodeURIComponent(next)}`, "progressive fallback and new-tab link preserve checkout");
    await click('[aria-label="Create an account"]');
    assert.equal(find(".ivh-login__card").getAttribute("data-mode"), "signup");
    assert.equal(dom.window.document.activeElement?.id, "signup-heading", "keyboard focus follows the visible face");
    assert.equal(find("#login-panel").getAttribute("aria-hidden"), "true");
    assert(find("#login-panel").hasAttribute("inert"));
    assert(find<HTMLFieldSetElement>("#login-panel fieldset").disabled);
    assert(!find<HTMLFieldSetElement>("#signup-panel fieldset").disabled);
    await fill("#signupName", account.fullName);
    await fill("#signupEmail", account.email);
    await fill("#signupPassword", account.password);
    await fill("#confirmPassword", "DifferentPassword123!");
    await click('[name="acceptTerms"]');
    const signupForm = find<HTMLFormElement>('form[aria-label="Create account"]');
    const submit = new dom.window.Event("submit", { bubbles: true, cancelable: true });
    await act(async () => { signupForm.dispatchEvent(submit); });
    assert(submit.defaultPrevented, "mismatch does not submit a fake success or create an account");
    assert.equal(dom.window.document.activeElement?.id, "confirmPassword");
    assert.equal(find("#confirmPassword").getAttribute("aria-invalid"), "true");
    assert(find("#confirmPassword-error").textContent?.includes("do not match"));
    await fill("#confirmPassword", account.password);
    assert(!dom.window.document.querySelector("#confirmPassword-error"), "mismatch clears when corrected");
    await click('[aria-controls="confirmPassword"]');
    assert.equal(find<HTMLInputElement>("#confirmPassword").type, "text");
    assert.equal(find<HTMLInputElement>("#signupPassword").type, "password");
    payload = new dom.window.FormData(signupForm);
    assert.equal(payload.get("fullName"), account.fullName);
    assert.equal(payload.get("confirmPassword"), account.password);
    assert.equal(payload.get("acceptTerms"), "on");
    assert.equal(payload.get("next"), next);
    assert(find('a[href="/terms"]') && find('a[href="/privacy"]'));
    assert.equal(dom.window.document.querySelectorAll('a[href="/register"]').length, 2, "both faces retain vendor registration, not a bypass of storefront verification");
    await click('[aria-label="Back to login"]');
    assert.equal(dom.window.document.activeElement?.id, "login-heading");
    assert.equal(find<HTMLInputElement>("#loginEmail").value, "kept@example.test");
    assert.equal(find<HTMLInputElement>("#loginPassword").value, "KeepThisPassword123!");
    assert(find<HTMLInputElement>('[name="rememberMe"]').checked);
    console.log("PASS: real named form fields, floating labels, per-field password toggles, keyboard/hidden-face isolation, flip state and input preservation");

    await act(async () => root.render(<LoginExperience key="unsafe" next="//attacker.example" />));
    assert.equal(dom.window.document.querySelectorAll('input[name="next"]').length, 0);
    assert.equal(find('[aria-label="Create an account"]').getAttribute("href"), "/register/customer");
    assert.equal(dom.window.document.querySelectorAll(".ivh-login__google a").length, 0, "no placeholder Google button when the provider is absent");
    assert.deepEqual(errors, [], "no unhandled React/DOM errors");
    console.log("PASS: server-side confirmation/password/terms validation, legacy registration compatibility, safe checkout continuations and conditional Google UI");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
