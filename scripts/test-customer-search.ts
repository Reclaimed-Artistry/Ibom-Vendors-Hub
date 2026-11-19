import assert from "node:assert/strict";
import { Client } from "pg";
import { customerSearchPattern } from "../src/lib/customer-search";
async function main() {
  assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1"), "Local test only");
  const db=new Client({connectionString:process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres"});
  await db.connect();
  try {
    await db.query("create temporary table customer_search_fixture(full_name text,email text,phone text,role text)");
    await db.query(`insert into customer_search_fixture values
      ('Ada Inyang','ada@example.test','08012345678','customer'),
      ('Victor Udo','victor@example.test',null,'customer'),
      ('Admin Ada','admin@example.test','08011111111','admin')`);
    const search=async(q:string)=>(await db.query(`select full_name from customer_search_fixture u where u.role='customer' and (lower(u.full_name) like lower($1) or lower(u.email) like lower($1) or lower(u.phone) like lower($1) or $1='')`,[customerSearchPattern(q)])).rows;
    assert.equal((await search(' ada '))[0].full_name,'Ada Inyang');
    assert.equal((await search('VICTOR@EXAMPLE'))[0].full_name,'Victor Udo');
    assert.equal((await search('12345678'))[0].full_name,'Ada Inyang');
    assert.equal((await search('')).length,2);
    assert.equal((await search('   ')).length,2);
    for(const q of ['nomatch','%','_',"' OR 1=1 --"]) assert.equal((await search(q)).length,0);
    console.log('PASS: name, email, phone, case, trimming, clear/empty, no matches, literal wildcards, admin exclusion');
  } finally {await db.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
