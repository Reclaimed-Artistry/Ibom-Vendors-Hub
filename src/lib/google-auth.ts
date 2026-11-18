import { authCookieDomain, safeAuthNext } from "@/lib/auth-navigation";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cache } from "react";
import { appUrl } from "@/lib/domains";
import { getSettings } from "@/lib/settings";

/**
 * "Sign in with Google" — server-side authorization-code flow.
 *
 * The ID token is verified against Google's published JWKS (signature, issuer,
 * audience, expiry) rather than trusted from the browser, the state value is
 * bound to an HttpOnly cookie to stop CSRF/login-swapping, and nothing is read
 * from a redirect parameter. Accounts are matched by verified email only.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const GOOGLE_STATE_COOKIE = "ivh_google_state";
const STATE_MAX_AGE = 600;

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  /** Where the pair came from, so the admin card can say so out loud. */
  source: "dashboard" | "environment";
}

/**
 * Resolves the OAuth client. Credentials saved in Admin -> Platform settings
 * win over environment variables, so the owner can (re)connect Google sign-in
 * without a redeploy; the stored kill switch disables the feature either way.
 */
export const googleCredentials = cache(async (): Promise<GoogleCredentials | null> => {
  const settings = await getSettings();
  if (!settings.google_signin_enabled) return null;

  const storedId = settings.google_client_id?.trim() ?? "";
  const storedSecret = settings.google_client_secret?.trim() ?? "";
  const envId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";

  // Field-by-field: a value saved in the dashboard wins, the environment fills
  // in whatever is missing — so pasting only the client ID on a deployment that
  // already has the secret in its environment works immediately.
  const clientId = storedId || envId;
  const clientSecret = storedSecret || envSecret;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, source: storedId || storedSecret ? "dashboard" : "environment" };
});

export async function googleConfigured() {
  return (await googleCredentials()) !== null;
}

/** Everything the admin card needs, without ever returning the secret. */
export async function googleSignInStatus() {
  const settings = await getSettings();
  const credentials = await googleCredentials();
  return {
    enabled: settings.google_signin_enabled,
    savedClientId: settings.google_client_id ?? "",
    hasStoredSecret: Boolean(settings.google_client_secret),
    hasEnvSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    source: credentials?.source ?? null,
    live: credentials !== null,
    redirectUri: googleRedirectUri(),
    origin: appUrl(),
  };
}

export function googleRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${appUrl()}/auth/google/callback`;
}

/** Only same-origin paths may be used as a post-login destination. */
export const safeNext = safeAuthNext;

/** Creates the CSRF state, stores it in an HttpOnly cookie and returns the consent URL. */
export async function beginGoogleSignIn(next?: string | null) {
  const state = crypto.randomBytes(24).toString("hex");
  const destination = safeNext(next);
  const store = await cookies();
  store.set(GOOGLE_STATE_COOKIE, destination ? `${state}|${destination}` : state, {
    httpOnly: true,
    domain: authCookieDomain((await headers()).get("host")),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });

  const credentials = await googleCredentials();
  if (!credentials) throw new GoogleAuthError("Google sign-in is not configured on this deployment.", "not_configured");

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
    include_granted_scopes: "true",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * A failure the sign-in page can explain in plain language.
 * `reason` maps to /login?oauth=<reason>.
 */
export class GoogleAuthError extends Error {
  readonly reason: "not_configured" | "state" | "expired" | "client" | "redirect" | "code" | "failed";

  constructor(
    message: string,
    reason: GoogleAuthError["reason"] = "failed",
  ) {
    super(message);
    this.reason = reason;
  }
}

/** Turns Google's OAuth error codes into something the owner can act on. */
function reasonForGoogleError(error: string | undefined): GoogleAuthError["reason"] {
  switch (error) {
    case "invalid_client":
    case "unauthorized_client":
      return "client";
    case "redirect_uri_mismatch":
      return "redirect";
    case "invalid_grant":
      return "code";
    default:
      return "failed";
  }
}

function equalState(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/**
 * Completes the flow: validates state, exchanges the code and verifies the ID
 * token. Throws GoogleAuthError with a user-safe message on any failure.
 */
export async function completeGoogleSignIn(
  code: string | null,
  state: string | null,
): Promise<{ identity: GoogleIdentity; next: string | null }> {
  const credentials = await googleCredentials();
  if (!credentials) throw new GoogleAuthError("Google sign-in is not configured on this deployment.", "not_configured");
  if (!code) throw new GoogleAuthError("Google did not return an authorization code.");

  const store = await cookies();
  const cookie = store.get(GOOGLE_STATE_COOKIE)?.value ?? "";
  store.set(GOOGLE_STATE_COOKIE, "", { path: "/", domain: authCookieDomain((await headers()).get("host")), maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  const [expectedState, ...rest] = cookie.split("|");
  const next = safeNext(rest.join("|") || null);
  if (!state || !expectedState || !equalState(state, expectedState)) {
    throw new GoogleAuthError("This sign-in attempt expired or was tampered with. Please try again.", "expired");
  }

  let idToken: string | undefined;
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await response.json().catch(() => ({}))) as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !json.id_token) {
      throw new GoogleAuthError(
        `Google rejected the sign-in (${json.error ?? response.status}${json.error_description ? `: ${json.error_description}` : ""}).`,
        reasonForGoogleError(json.error),
      );
    }
    idToken = json.id_token;
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    throw new GoogleAuthError("Google could not be reached. Please try again.");
  }

  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: credentials.clientId,
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email) throw new GoogleAuthError("Google did not share an email address for this account.");
    return {
      identity: {
        email,
        emailVerified: payload.email_verified === true || payload.email_verified === "true",
        name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0],
        picture: typeof payload.picture === "string" ? payload.picture : undefined,
      },
      next,
    };
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    throw new GoogleAuthError("Google returned a token this site could not verify. Please try again.");
  }
}
