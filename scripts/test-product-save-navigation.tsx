/** Post-save navigation safety, progressive enhancement and real React effects. */
import assert from "node:assert/strict";
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { PRODUCT_SAVE_NAVIGATION_FIELD, productSaveDestination } from "../src/lib/product-save-navigation";

async function main() {
  Object.assign(globalThis, { React });
  const { ProductSaveNavigation } = await import("../src/components/product-save-navigation");
  const destination = "/vendor/products/ea98849a-fd65-4ebc-b7b3-87b5efe7a306?saved=1";
  assert.equal(productSaveDestination(destination), destination);
  for (const unsafe of [undefined, null, {}, "", "/vendor/products/new?saved=1", "//attacker.example", `https://attacker.example${destination}`, "javascript:alert(1)", `/\\attacker.example${destination}`, `${destination}&next=https://attacker.example`, `${destination}#redirect`, "/account", destination.replace("saved=1", "saved=0")]) {
    assert.equal(productSaveDestination(unsafe), null, `reject an invalid or external save destination: ${String(unsafe)}`);
  }
  const plain = renderToString(<form><ProductSaveNavigation /></form>);
  assert(!plain.includes(PRODUCT_SAVE_NAVIGATION_FIELD), "plain HTML forms retain the native server redirect, not a JS-only mode");
  const acknowledged = renderToString(<ProductSaveNavigation redirectUrl={destination} />);
  assert(acknowledged.includes("Product saved"));
  assert(acknowledged.includes(`href="${destination}"`), "a confirmed save has a real fallback link before effects run");

  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost:3000/vendor/products/new" });
  const assigned: string[] = [];
  const windowProxy = new Proxy(dom.window, {
    get(target, property) {
      if (property === "location") return { assign: (href: string) => assigned.push(href) };
      return Reflect.get(target, property, target);
    },
  });
  Object.assign(globalThis, { window: windowProxy, self: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const { useProductSubmission } = await import("../src/components/use-product-submission");
  const originalFetch = globalThis.fetch;
  const originalFormData = globalThis.FormData;
  Object.assign(globalThis, { FormData: dom.window.FormData });
  const root = createRoot(dom.window.document.getElementById("root")!);
  function FormHarness({ mediaBusy = false }: { mediaBusy?: boolean }) {
    const { state, action, submit, saving, redirecting } = useProductSubmission();
    return <form action={action} onSubmit={(event) => submit(event, mediaBusy)} aria-busy={saving || redirecting}>
      <ProductSaveNavigation redirectUrl={state.redirectUrl} />
      <input name="name" defaultValue="Preserved product name" />
      <input name="$ACTION_ignored" value="not-an-api-field" readOnly />
      <button disabled={saving || redirecting}>Save product</button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.fieldErrors?.name ? <p id="name-error">{state.fieldErrors.name}</p> : null}
    </form>;
  }
  const submitForm = async () => {
    const event = new dom.window.Event("submit", { bubbles: true, cancelable: true });
    await act(async () => { dom.window.document.querySelector("form")!.dispatchEvent(event); });
    assert(event.defaultPrevented, "hydrated submits use the small authenticated JSON endpoint, not a streamed React router action");
  };
  try {
    await act(async () => root.render(<form><ProductSaveNavigation /></form>));
    const flag = dom.window.document.querySelector<HTMLInputElement>(`input[name="${PRODUCT_SAVE_NAVIGATION_FIELD}"]`);
    assert(flag); assert.equal(flag.type, "hidden"); assert.equal(flag.value, "1");
    assert.deepEqual(assigned, [], "mounting or editing does not navigate before a confirmed save");
    await act(async () => root.render(<form><ProductSaveNavigation redirectUrl="//attacker.example" /></form>));
    assert.deepEqual(assigned, []);
    assert.equal(dom.window.document.querySelectorAll("a").length, 0);
    await act(async () => root.render(<form><ProductSaveNavigation redirectUrl={destination} /></form>));
    assert.deepEqual(assigned, [destination], "a committed save opens its actual listing with a fresh browser GET");
    assert.equal(dom.window.document.querySelector("a")?.getAttribute("href"), destination);
    assert(dom.window.document.querySelector('[role="status"]')?.textContent?.includes("Product saved"));
    await act(async () => root.render(<form><ProductSaveNavigation redirectUrl={destination} /></form>));
    assert.deepEqual(assigned, [destination], "unrelated rerenders do not repeat navigation or resubmit a product");

    let requests = 0;
    let complete!: (response: Response) => void;
    globalThis.fetch = async (input, init) => {
      requests += 1;
      assert.equal(input, "/api/vendor-products"); assert.equal(init?.method, "POST"); assert.equal(init?.credentials, "same-origin");
      const fields = JSON.parse(String(init?.body)) as Array<[string, string]>;
      assert(fields.some(([name, value]) => name === "name" && value === "Preserved product name"));
      assert(!fields.some(([name]) => name.startsWith("$ACTION_")));
      return new Promise<Response>((resolve) => { complete = resolve; });
    };
    await act(async () => root.render(<FormHarness mediaBusy />));
    await submitForm(); assert.equal(requests, 0, "media must finish uploading before a product can be saved");
    await act(async () => root.render(<FormHarness />));
    await submitForm(); assert.equal(requests, 1); assert(dom.window.document.querySelector("button")?.disabled);
    assert.equal(dom.window.document.querySelector("form")?.getAttribute("aria-busy"), "true");
    await submitForm(); assert.equal(requests, 1, "even repeated submit events cannot issue a second in-flight save");
    await act(async () => { complete(new Response(JSON.stringify({ error: "Fix the name", fieldErrors: { name: "Name is too short" } }), { status: 422 })); });
    assert.equal(dom.window.document.querySelector('[role="alert"]')?.textContent, "Fix the name");
    assert.equal(dom.window.document.querySelector("#name-error")?.textContent, "Name is too short");
    assert(!dom.window.document.querySelector("button")?.disabled);
    assert.equal(dom.window.document.querySelector<HTMLInputElement>('[name="name"]')?.value, "Preserved product name");
    await submitForm(); assert.equal(requests, 2);
    await act(async () => { complete(new Response(JSON.stringify({ message: "Product saved.", redirectUrl: destination }), { status: 200 })); });
    assert.deepEqual(assigned, [destination, destination]);
    assert(dom.window.document.querySelector("button")?.disabled, "a confirmed save stays locked while opening the saved listing");
    await submitForm(); assert.equal(requests, 2, "no duplicate save after confirmed success");

    globalThis.fetch = async () => { throw new TypeError("Network unavailable"); };
    await act(async () => root.render(<FormHarness key="network-failure" />));
    await submitForm();
    assert(dom.window.document.querySelector('[role="alert"]')?.textContent?.includes("Check your Products list before trying again"));
    assert.equal(assigned.length, 2, "network uncertainty is never reported as a confirmed save or retried automatically");
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    Object.assign(globalThis, { FormData: originalFormData });
    dom.window.close();
  }
  console.log("PASS: product-save navigation only opts in after hydration, waits for confirmed success, uses a safe saved-listing URL once and retains a real fallback link/native HTML redirect");
  console.log("PASS: small JSON form submission, actual pending state, media/duplicate guards, retained validation errors/inputs, safe completion and honest network-failure feedback");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
