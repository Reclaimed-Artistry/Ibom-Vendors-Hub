import assert from "node:assert/strict";
import { withPublic } from "../src/lib/db";
import { EXPANDED_CATEGORIES } from "../src/lib/expanded-categories";
import { productGuide, selectionKind, productQuestions, agricultureSelection } from "../src/lib/product-guide";
import { getCategoryBookingProfile } from "../src/lib/artisan-bookings";
async function main() {
  assert.equal(Object.keys(EXPANDED_CATEGORIES).length,10);
  const rows=await withPublic(db=>db.query<{slug:string;features:Record<string,boolean>}>("select slug,features from store_categories where slug=any($1::text[]) and is_active",[Object.keys(EXPANDED_CATEGORIES)]));
  assert.equal(rows.length,10,"All new categories available to registration/browsing");
  for(const row of rows) {
    const guide=productGuide(row.slug);assert(guide.choices.length>=5);assert(guide.example.length>60);
    if (row.features.inquiryOnly) {assert.equal(row.features.cart,false);assert.equal(row.features.serviceBooking,false);}
  }
  const digital=productGuide("digital-online-services");
  for(const choice of ["Graphic design","Video editing","Website design / development","Virtual assistance"]) {
    assert(digital.choices.includes(choice));assert.equal(selectionKind(choice,digital),"service");
    assert.equal(productQuestions("digital-online-services",choice,"service").length,2);
  }
  const booking=getCategoryBookingProfile("digital-online-services");
  assert.equal(booking.requiresSiteAddress,false);assert(booking.requirements.some(r=>r.includes("passwords")));
  for(const bird of ["Turkey","Duck"]) assert.equal(agricultureSelection(bird),"Chicken & other poultry");
  console.log("PASS: 10 public category records, enquiry-only safeguards, digital skills/questions, remote consultation profile, turkey/duck mapping");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>setTimeout(()=>process.exit(process.exitCode??0),50));
