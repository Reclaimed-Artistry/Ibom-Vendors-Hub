import assert from "node:assert/strict";
import { PRODUCT_GUIDES, productGuide, selectionKind, agricultureSelection, descriptionExample, productQuestions } from "../src/lib/product-guide";
assert.equal(Object.keys(PRODUCT_GUIDES).length,27);
for(const [slug,guide] of Object.entries(PRODUCT_GUIDES)) {
 assert(guide.choices.length>=2 && guide.example.length>40,slug);
 assert(new Set(guide.choices).size===guide.choices.length);
 for(const choice of [...guide.choices,"Other"]) {
  assert(descriptionExample(slug,choice).length>20);
  assert(productQuestions(slug,choice,selectionKind(choice,guide)).length<=2);
 }
}
assert.equal(selectionKind("Tailoring service",productGuide("fashion-clothing")),"service");
assert.equal(selectionKind("Solar equipment",productGuide("artisans-electrical-solar")),"product");
assert.equal(selectionKind("Photography",productGuide("services-professionals")),"service");
assert.equal(agricultureSelection("Eggs"),"Eggs");
assert.equal(agricultureSelection("Other"),"Other farm produce");
assert(productGuide("new-category").choices.includes("Service"));
console.log("PASS: 27 categories, Other/fallback choices, contextual examples, small question sets, item/service and farm mapping");
