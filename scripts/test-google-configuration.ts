import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { googleConfigured, googleCredentials } from "../src/lib/google-auth";

async function main() {
  const originalId = process.env.GOOGLE_CLIENT_ID;
  const originalSecret = process.env.GOOGLE_CLIENT_SECRET;
  try {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    assert.equal(await googleConfigured(), false);
    process.env.GOOGLE_CLIENT_ID = "test.apps.googleusercontent.com";
    assert.equal(await googleConfigured(), false, "ID alone is insufficient");
    process.env.GOOGLE_CLIENT_SECRET = " local-test-secret ";
    assert.deepEqual(await googleCredentials(), {
      clientId: "test.apps.googleusercontent.com", clientSecret: "local-test-secret",
    });
    assert.equal(await googleConfigured(), true);
    delete process.env.GOOGLE_CLIENT_ID;
    assert.equal(await googleConfigured(), false, "secret alone is insufficient");
    process.env.GOOGLE_CLIENT_ID = "   ";
    assert.equal(await googleConfigured(), false, "whitespace is not a credential");
    assert(!readFileSync("src/lib/google-auth.ts", "utf8").includes("platform_settings"), "OAuth must not read legacy database credentials or switches");
    assert(!readFileSync("src/app/actions/admin.ts", "utf8").includes("saveGoogleSignInAction"), "admin cannot write OAuth credentials");
    console.log("Google environment-only configuration checks passed.");
  } finally {
    if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
