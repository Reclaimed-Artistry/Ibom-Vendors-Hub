import assert from "node:assert/strict";
import { AGRICULTURE_ATTRIBUTES, validateAgricultureAttributes, farmMinimumQuantity } from "../src/lib/agriculture";
const basic = {produce_type:"Vegetables & fruits",sale_unit:"Basket",pack_size:"5 kg basket",minimum_order:"2",produce_condition:"Fresh / raw",source_location:"Uyo, Uyo LGA",storage_instructions:"Keep cool; use within two days",fulfilment_notes:"Pickup or same-day delivery"};
validateAgricultureAttributes(basic);
for (const field of AGRICULTURE_ATTRIBUTES.filter(a=>a.required)) assert.throws(()=>validateAgricultureAttributes({...basic,[field.key]:""}));
for (const minimum_order of ["0","-1","1.5","100","Infinity"]) assert.throws(()=>validateAgricultureAttributes({...basic,minimum_order}));
assert.throws(()=>validateAgricultureAttributes({...basic,harvest_date:"2026-02-30"}));
assert.throws(()=>validateAgricultureAttributes({...basic,harvest_date:"2099-01-01"}));
assert.throws(()=>validateAgricultureAttributes({...basic,produce_type:"Eggs"}),/egg/i);
validateAgricultureAttributes({...basic,produce_type:"Eggs",egg_details:"Large, collected 2026-11-16"});
assert.throws(()=>validateAgricultureAttributes({...basic,produce_condition:"Live"}),/breed/i);
validateAgricultureAttributes({...basic,produce_type:"Chicken & other poultry",produce_condition:"Live",breed_variety:"Broiler",animal_age:"8 weeks, about 2 kg",health_details:"Active, vaccination record available"});
for(const produce_type of ["Crayfish & seafood","Catfish & other fish"]) {
 assert.throws(()=>validateAgricultureAttributes({...basic,produce_type}),/fish|seafood/i);
 validateAgricultureAttributes({...basic,produce_type,fish_preparation:"Whole smoked fish, medium size"});
}
assert.equal(farmMinimumQuantity(basic),2);
assert.equal(farmMinimumQuantity({}),1);
console.log("PASS: produce requirements, live poultry, eggs, crayfish/catfish, dates, units and minimum-order validation");
