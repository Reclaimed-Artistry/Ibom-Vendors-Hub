import assert from "node:assert/strict";
import { filterByText, scoreTextMatch } from "../src/lib/customer-search";

const items = [
  { title: "Ada Inyang", searchText: "Ada Inyang ada@example.test" },
  { title: "Victor Udo", searchText: "Victor Udo victor@example.test" },
  { title: "Jollof Rice", searchText: "Jollof Rice spicy party size" },
  { title: "Chidi Eze", searchText: "Chidi Eze chidi@example.test" },
];
const titles = (q: string) => filterByText(items, q, (i) => i.searchText).map((i) => i.title);

assert.deepEqual(titles("ada"), ["Ada Inyang"]);
assert.deepEqual(titles("ada iny"), ["Ada Inyang"]);
assert.deepEqual(titles("jollof rice"), ["Jollof Rice"]);
assert.deepEqual(titles("spicy"), ["Jollof Rice"]);
assert.deepEqual(titles("example.test"), ["Ada Inyang", "Victor Udo", "Chidi Eze"]);
assert.deepEqual(titles("zzz"), []);
assert.deepEqual(titles(""), []);
assert.equal(scoreTextMatch("Jollof Rice", "jollof"), 40);
assert.equal(scoreTextMatch("Jollof Rice", "rice"), 30);
assert.equal(scoreTextMatch("Jollof Rice", "pasta"), -1);
assert.equal(filterByText(items, "a", (i) => i.searchText, 2).length, 2);
console.log("PASS: generic smart search (partial, multi-token, scoring, limit)");
