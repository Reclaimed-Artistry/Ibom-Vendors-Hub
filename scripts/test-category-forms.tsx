/** DOM interaction checks. No network calls, uploads or database writes. */
import assert from "node:assert/strict";
import React, { act, useState } from "react";
import { JSDOM } from "jsdom";
import { systemDb } from "../src/lib/db";
import type { StoreCategory } from "../src/lib/types";

async function main() {
  const dom = new JSDOM("<!doctype html><html><body><div id='test-root'></div></body></html>", { url: "http://localhost:3000/vendor/products/new" });
  const errors: string[] = [];
  dom.window.addEventListener("error", event => errors.push(event.message));
  Object.assign(globalThis, { window: dom.window, self: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, HTMLSelectElement: dom.window.HTMLSelectElement, requestAnimationFrame: (callback: (time: number) => void) => { callback(0); return 0; }, React, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const { BusinessCategoryFields } = await import("../src/components/business-category-fields");
  const { ProductForm } = await import("../src/components/product-form");
  const { VendorRegisterForm } = await import("../src/components/auth-forms");
  const categories = await systemDb.query<StoreCategory>(`select * from store_categories where is_active order by sort_order,name`);
  const find = (slug: string) => { const category = categories.find(item => item.slug === slug); assert(category); return category; };
  const fashion = find("fashion-clothing"), packaging = find("branding-packaging"), property = find("house-agents-realtors"), farm = find("agriculture-livestock"), household = find("household-products");
  const root = createRoot(dom.window.document.getElementById("test-root")!);
  const query = <T extends Element>(selector: string) => { const element = dom.window.document.querySelector<T>(selector); assert(element, selector); return element; };
  const changeSelect = async (selector: string, value: string) => {
    await act(async () => { const select = query<HTMLSelectElement>(selector); select.value = value; select.dispatchEvent(new dom.window.Event("change",{bubbles:true})); });
  };
  const click = async (element: HTMLElement) => { await act(async () => element.click()); };
  const text = () => dom.window.document.body.textContent ?? "";
  const namedButtons = (label: string) => [...dom.window.document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes(label))!;

  function BusinessHarness() {
    const [primary,setPrimary] = useState(fashion.slug);
    const [selected,setSelected] = useState([fashion.slug]);
    return <form><BusinessCategoryFields categories={categories} primary={primary} selected={selected} onPrimaryChange={setPrimary} onSelectedChange={setSelected}/></form>;
  }
  await act(async () => root.render(<BusinessHarness/>));
  const packagingCheckbox = [...dom.window.document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(input => input.parentElement?.textContent?.includes(packaging.name));
  assert(packagingCheckbox); await click(packagingCheckbox);
  let payload = new dom.window.FormData(query<HTMLFormElement>("form"));
  assert.deepEqual(payload.getAll("categorySlugs"),[fashion.slug,packaging.slug]);
  await changeSelect("#categorySlug",packaging.slug);
  payload = new dom.window.FormData(query<HTMLFormElement>("form"));
  assert.equal(payload.get("categorySlug"),packaging.slug);
  assert.deepEqual(payload.getAll("categorySlugs"),[packaging.slug,fashion.slug]);
  assert.equal(dom.window.document.querySelectorAll('input[type="checkbox"]:checked').length,2);
  const householdCheckbox = [...dom.window.document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(input => input.parentElement?.textContent?.includes(household.name));
  assert(householdCheckbox); await click(householdCheckbox);
  await changeSelect("#categorySlug",household.slug);
  payload = new dom.window.FormData(query<HTMLFormElement>("form"));
  assert.equal(payload.get("categorySlug"),household.slug);
  assert.deepEqual(payload.getAll("categorySlugs"),[household.slug,packaging.slug,fashion.slug]);
  console.log("PASS: accessible checkbox multi-selection, household primary/additional categories, retained selections and repeated FormData values");

  const product = { id: "11111111-1111-4111-8111-111111111111", name:"Existing dress",description:"Original description",shortDescription:"",kind:"product",categoryId:"22222222-2222-4222-8222-222222222222",marketplaceCategoryId:fashion.id,price:"2500",compareAtPrice:"",pricingType:"fixed",sku:"DRESS-1",trackStock:false,stockQuantity:"0",isAvailable:true,isFeatured:false,condition:"",brand:"",model:"",warrantyInfo:"",warrantyMonths:"",madeToOrder:false,productionDays:"",prepTimeMinutes:"",portion:"",serviceDurationMinutes:"",attributes:{},specifications:{},variants:[{name:"Large",price:"2500",stockQuantity:"2"}],addons:[],images:[{id:"photo-one",url:"/images/seed/product-jollof.svg"}] };
  const props = { product, vendorLga:"Uyo",categorySlug:fashion.slug,categoryName:fashion.name,attributes:fashion.attributes,features:fashion.features,categories:[{id:product.categoryId,name:"Private section"}],marketplaceCategories:categories,businessCategoryIds:[fashion.id] };
  await act(async () => root.render(<ProductForm {...props}/>));
  assert.equal(query<HTMLSelectElement>("#marketplaceCategoryId").value,fashion.id);
  assert.equal(query<HTMLSelectElement>("#offering").value,"Other");
  query<HTMLTextAreaElement>("#guide-description").value="Unsaved description must survive a category change";
  query<HTMLInputElement>("#guide-name").value="Unsaved listing name";
  await changeSelect("#marketplaceCategoryId",packaging.id);
  assert(text().includes("Branding & Packaging"));
  assert([...query<HTMLSelectElement>("#offering").options].some(option => /Custom boxes/.test(option.text)));
  assert.equal(query<HTMLTextAreaElement>("#guide-description").value,"Unsaved description must survive a category change");
  assert.equal(query<HTMLInputElement>("#guide-name").value,"Unsaved listing name");
  assert.equal(dom.window.document.querySelectorAll('img[alt="Existing listing"]').length,1);
  payload = new dom.window.FormData(query<HTMLFormElement>("form"));
  assert.equal(payload.get("marketplaceCategoryId"),packaging.id);
  assert.equal(payload.get("categoryId"),product.categoryId,"private catalogue section is not overwritten");
  assert.equal(JSON.parse(String(payload.get("variantsJson")))[0].name,"Large");
  await changeSelect("#marketplaceCategoryId",property.id);
  assert(text().includes("Rent / sale price"));
  assert(query<HTMLInputElement>("#guide-inspection_fee").required);
  assert.equal(new dom.window.FormData(query<HTMLFormElement>("form")).get("kind"),"service");
  await changeSelect("#marketplaceCategoryId",farm.id);
  assert(query<HTMLSelectElement>("#guide-sale_unit"));
  assert(!dom.window.document.querySelector("#guide-inspection_fee"));
  await changeSelect("#marketplaceCategoryId",household.id);
  assert(query<HTMLSelectElement>("#offering").options.length >= 102, "household choices plus prompt and Other");
  for (const choice of ["Cooking pots / casseroles","Laundry detergent / soap","Refrigerators / freezers","Bedsheets / pillowcases","Other"]) {
    await changeSelect("#offering",choice);
    payload = new dom.window.FormData(query<HTMLFormElement>("form"));
    assert.equal(payload.get("kind"),"product",choice);
    assert.equal(payload.get("pricingType"),"fixed");
    assert.equal(JSON.parse(String(payload.get("attributesJson"))).offering_type,choice);
    assert(query<HTMLInputElement>("#guide-size_quantity"));
    assert(query<HTMLInputElement>("#guide-item_details"));
    assert(!dom.window.document.querySelector("#guide-service_area"));
    assert(!dom.window.document.querySelector("#guide-inspection_fee"));
    assert(!dom.window.document.querySelector("#guide-sale_unit"));
  }
  assert.equal(query<HTMLTextAreaElement>("#guide-description").value,"Unsaved description must survive a category change");
  assert.equal(payload.get("categoryId"),product.categoryId);
  assert.equal(JSON.parse(String(payload.get("variantsJson")))[0].name,"Large");
  await changeSelect("#marketplaceCategoryId",fashion.id);
  assert(!dom.window.document.querySelector("#guide-inspection_fee"));
  assert(!dom.window.document.querySelector("#guide-sale_unit"));
  assert(query<HTMLSelectElement>("#offering").textContent?.includes("Dress"));
  console.log("PASS: guided editor follows each listing category and keeps unsaved names/descriptions, photos, variants and catalogue sections");

  dom.window.confirm = () => true;
  await click(namedButtons("Open full editor"));
  assert(query<HTMLSelectElement>("#categoryId").textContent?.includes("Private section"));
  assert(text().includes("Catalogue section"));
  await changeSelect("#marketplaceCategoryId",property.id);
  assert(query<HTMLInputElement>('[name="name"]').value === product.name);
  assert(text().includes("Property listing"));
  assert(query<HTMLSelectElement>("#kind").disabled);
  await changeSelect("#marketplaceCategoryId",household.id);
  assert(!query<HTMLSelectElement>("#kind").disabled);
  assert.equal(query<HTMLSelectElement>("#kind").value,"product");
  payload = new dom.window.FormData(query<HTMLFormElement>("form"));
  assert.equal(payload.get("marketplaceCategoryId"),household.id);
  assert.equal(payload.get("pricingType"),"fixed");
  assert(text().includes("Variants"));
  assert(dom.window.document.querySelector('input[name="trackStock"]'));
  assert(!text().includes("Property listing"));
  await changeSelect("#marketplaceCategoryId",packaging.id);
  assert.equal(new dom.window.FormData(query<HTMLFormElement>("form")).get("marketplaceCategoryId"),packaging.id);
  assert.equal(query<HTMLSelectElement>("#categoryId").value,product.categoryId);
  console.log("PASS: household guided/full editors default to physical products with price, stock and variants; catalogue sections stay independent");

  // Preserve the existing incomplete-registration caution and jump target.
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  await act(async () => root.render(<VendorRegisterForm categories={categories} rootDomain="ibomvendorshub.com" initialUser={{email:"fixture@example.test",fullName:"Fixture Tester"}}/>));
  await act(async () => { query<HTMLFormElement>("form").dispatchEvent(new dom.window.Event("submit",{bubbles:true,cancelable:true})); });
  assert(text().includes("required fields are still empty"));
  assert(namedButtons("Primary business category"));
  await changeSelect("#categorySlug",household.slug);
  assert.equal(new dom.window.FormData(query<HTMLFormElement>("form")).get("categorySlug"),household.slug);
  const caution = dom.window.document.querySelector('[role="alert"]');
  assert(caution && !caution.textContent?.includes("Primary business category"),"caution clears after choosing a category");
  assert(query<HTMLSelectElement>("#categorySlug").getAttribute("class")?.includes("select"));
  console.log("PASS: registration caution, focus target and live-clearing continue to work with multi-select");
  assert.deepEqual(errors, [], "no unhandled DOM/React errors");
  await act(async () => root.unmount());
  dom.window.close();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
