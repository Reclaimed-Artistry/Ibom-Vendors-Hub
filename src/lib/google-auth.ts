import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { appUrl } from "@/lib/domains";

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

export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

export function googleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export function googleConfigured() {
  return Boolean(googleClientId() && googleClientSecret());
}

export function googleRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${appUrl()}/auth/google/callback`;
}

/** Only same-origin paths may be used as a post-login destination. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}

/** Creates the CSRF state, stores it in an HttpOnly cookie and returns the consent URL. */
export async function beginGoogleSignIn(next?: string | null) {
  const state = crypto.randomBytes(24).toString("hex");
  const destination = safeNext(next);
  const store = await cookies();
  store.set(GOOGLE_STATE_COOKIE, destination ? `${state}|${destination}` : state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });

  const params = new URLSearchParams({
    client_id: googleClientId(),
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

export class GoogleAuthError extends Error {}

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
  if (!googleConfigured()) throw new GoogleAuthError("Google sign-in is not configured on this deployment.");
  if (!code) throw new GoogleAuthError("Google did not return an authorization code.");

  const store = await cookies();
  const cookie = store.get(GOOGLE_STATE_COOKIE)?.value ?? "";
  store.delete(GOOGLE_STATE_COOKIE);
  const [expectedState, ...rest] = cookie.split("|");
  const next = safeNext(rest.join("|") || null);
  if (!state || !expectedState || !equalState(state, expectedState)) {
    throw new GoogleAuthError("This sign-in attempt expired or was tampered with. Please try again.");
  }

  let idToken: string | undefined;
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
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
      audience: googleClientId(),
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
