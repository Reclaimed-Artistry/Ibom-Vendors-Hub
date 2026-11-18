import assert from "node:assert/strict";
import { withSystem } from "../src/lib/db";
import { googleConfigured, googleSignInStatus } from "../src/lib/google-auth";

async function main() {
  assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1"), "Local DB only");
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  const rollback = new Error("rollback");
  try { await withSystem(async (db) => {
    await db.execute(`update platform_settings set google_signin_enabled=true,google_client_id='test.apps.googleusercontent.com',google_client_secret='local-test-secret' where id=1`);
    assert(await googleConfigured(), "saved credentials enable Google without the visual-settings cache");
    const status = await googleSignInStatus();
    assert.equal(status.source,"dashboard");assert.equal(status.hasStoredSecret,true);
    assert(!JSON.stringify(status).includes("local-test-secret"),"status never exposes secret");
    await db.execute(`update platform_settings set google_signin_enabled=false where id=1`);
    assert.equal(await googleConfigured(),false,"disabled provider remains off");
    await db.execute(`update platform_settings set google_signin_enabled=true,google_client_secret=null where id=1`);
    assert.equal(await googleConfigured(),false,"missing secret is accurately reported");
    process.env.GOOGLE_CLIENT_SECRET='environment-test-secret';
    assert(await googleConfigured(),"environment supplies missing secret");
    console.log("Google configuration checks passed: fresh saved settings, enabled switch, missing-secret detection, environment fallback and secret-safe status.");
    throw rollback;
  }); } catch(error) {if(error!==rollback)throw error;}
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>setTimeout(()=>process.exit(process.exitCode??0),50));
