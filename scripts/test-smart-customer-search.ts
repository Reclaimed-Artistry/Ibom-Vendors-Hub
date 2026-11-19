import assert from "node:assert/strict";
import { filterCustomers, scoreCustomerMatch } from "../src/lib/customer-search";

const customers = [
  { id: "1", full_name: "Ada Inyang", email: "ada.inyang@example.test", phone: "08012345678" },
  { id: "2", full_name: "Victor Udo", email: "victor@example.test", phone: "09023456789" },
  { id: "3", full_name: "Adaeze Okon", email: "adaeze@example.test", phone: null },
  { id: "4", full_name: "Chidi Eze", email: "chidi@example.test", phone: "07034567890" },
];

const names = (q: string) => filterCustomers(customers, q).map((c) => c.full_name);

// Partial and multi-token name matching
assert.deepEqual(names("ada iny"), ["Ada Inyang"]);
assert.deepEqual(names("ada"), ["Ada Inyang", "Adaeze Okon"]);
assert.deepEqual(names("vic"), ["Victor Udo"]);
// Initials
assert.deepEqual(names("ai"), ["Ada Inyang"]);
// Email fragment
assert.deepEqual(names("victor@example"), ["Victor Udo"]);
// Phone digits
assert.deepEqual(names("12345678"), ["Ada Inyang"]);
assert.deepEqual(names("0801"), ["Ada Inyang"]);
// Case and punctuation insensitive
assert.deepEqual(names("ADA-INYANG"), ["Ada Inyang"]);
assert.deepEqual(names("  ada  "), ["Ada Inyang", "Adaeze Okon"]);
// No match / empty
assert.deepEqual(names("zzz"), []);
assert.deepEqual(names(""), []);
assert.deepEqual(names("   "), []);
// Every token must match
assert.deepEqual(names("ada zzz"), []);
// Scoring sanity
assert(scoreCustomerMatch(customers[0], "ada") > scoreCustomerMatch(customers[0], "inyang"));
assert.equal(scoreCustomerMatch(customers[0], "zzz"), -1);
assert.equal(scoreCustomerMatch(customers[0], ""), 0);
// Limit respected
assert(filterCustomers(customers, "a", 2).length <= 2);

console.log("PASS: smart customer search (partial, initials, email, phone, tokens, scoring, limit)");
