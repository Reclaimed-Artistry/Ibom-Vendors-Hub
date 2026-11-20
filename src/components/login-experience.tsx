"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole, Plus, UserRound } from "lucide-react";
import { loginAction, registerCustomerAction, type ActionState } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { safeAuthNext } from "@/lib/auth-navigation";

const INITIAL_STATE: ActionState = {};

/** Adapted from the owner's supplied login demo, with real server actions. */
function FloatingField({
  label,
  error,
  hint,
  type = "text",
  id,
  ...inputProps
}: Omit<ComponentProps<"input">, "className"> & { id: string; label: string; error?: string; hint?: string }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const description = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="ivh-login__field">
      <div className="ivh-login__input-group">
        <span className="ivh-login__electric-glow" aria-hidden="true" />
        <span className="ivh-login__electric-border" aria-hidden="true" />
        <input
          {...inputProps}
          id={id}
          type={isPassword && visible ? "text" : type}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={description}
        />
        <label htmlFor={id}>{label}</label>
        {isPassword ? (
          <button
            type="button"
            className="ivh-login__password-toggle"
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-controls={id}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
          >
            {visible ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
          </button>
        ) : null}
      </div>
      {hint ? <p id={`${id}-hint`} className="ivh-login__hint">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="ivh-login__field-error">{error}</p> : null}
    </div>
  );
}

function FormFeedback({ state }: { state: ActionState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.error || state.message) ref.current?.focus();
  }, [state]);
  if (!state.error && !state.message) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={state.error ? "alert" : "status"}
      className={`ivh-login__feedback${state.error ? " ivh-login__feedback--error" : ""}`}
    >
      {state.error || state.message}
    </div>
  );
}

export function LoginExperience({
  next,
  heading = "Welcome back",
  subtitle = "Sign in to manage your store or track your orders.",
  notices,
  googleLogin,
  googleSignup,
  demoAccounts,
}: {
  next?: string;
  heading?: string;
  subtitle?: string;
  notices?: ReactNode;
  googleLogin?: ReactNode;
  googleSignup?: ReactNode;
  demoAccounts?: ReactNode;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, signIn, signingIn] = useActionState(loginAction, INITIAL_STATE);
  const [signupState, signUp, signingUp] = useActionState(registerCustomerAction, INITIAL_STATE);
  const [login, setLogin] = useState({ email: "", password: "", rememberMe: false });
  const [signup, setSignup] = useState({ fullName: "", email: "", password: "", confirmPassword: "", acceptTerms: false });
  const [confirmError, setConfirmError] = useState<string>();
  const loginHeading = useRef<HTMLHeadingElement>(null);
  const signupHeading = useRef<HTMLHeadingElement>(null);
  const switched = useRef(false);
  const busy = signingIn || signingUp;
  const destination = safeAuthNext(next) ?? undefined;
  const signupHref = destination ? `/register/customer?next=${encodeURIComponent(destination)}` : "/register/customer";

  useEffect(() => {
    if (switched.current) (mode === "signup" ? signupHeading : loginHeading).current?.focus();
  }, [mode]);

  function flip(value: "login" | "signup") {
    if (busy) return;
    switched.current = true;
    setMode(value);
  }

  function openSignup(event: MouseEvent<HTMLAnchorElement>) {
    // Keep the real registration URL usable without JS and with open-in-new-tab.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    flip("signup");
  }

  return (
    <main className="ivh-login" aria-labelledby={mode === "login" ? "login-heading" : "signup-heading"} data-login-design="neumorphic">
      <div className="ivh-login__background" aria-hidden="true">
        <span className="ivh-login__bg-circle ivh-login__bg-circle--one" />
        <span className="ivh-login__bg-circle ivh-login__bg-circle--two" />
        <span className="ivh-login__bg-circle ivh-login__bg-circle--three" />
      </div>
      <div className="ivh-login__content">
        <div className="ivh-login__brand"><Logo height={42} className="ivh-login__brand-link" /></div>
        <div className="ivh-login__wrapper">
          <div className="ivh-login__card" data-mode={mode}>
            <section
              className="ivh-login__panel"
              data-face="login"
              id="login-panel"
              aria-labelledby="login-heading"
              aria-hidden={mode !== "login"}
              inert={mode !== "login"}
            >
              <div className="ivh-login__emblem" aria-hidden="true"><LockKeyhole size={31} strokeWidth={2.1} /></div>
              <h1 id="login-heading" ref={loginHeading} tabIndex={-1} className="ivh-login__title">{heading}</h1>
              <p className="ivh-login__subtitle">{subtitle}</p>
              <div className="ivh-login__notices">{notices}</div>
              <div className="ivh-login__google">{googleLogin}</div>
              <form action={signIn} aria-label="Sign in" aria-busy={signingIn}>
                <FormFeedback state={loginState} />
                {destination ? <input type="hidden" name="next" value={destination} /> : null}
                <fieldset className="ivh-login__fields" disabled={busy || mode !== "login"}>
                  <legend className="sr-only">Sign in with your email and password</legend>
                  <FloatingField
                    label="Email address" id="loginEmail" name="email" type="email" autoComplete="email"
                    required maxLength={160} autoCapitalize="none" spellCheck={false}
                    value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })}
                    error={loginState.fieldErrors?.email}
                  />
                  <FloatingField
                    label="Password" id="loginPassword" name="password" type="password" autoComplete="current-password"
                    required maxLength={128}
                    value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })}
                    error={loginState.fieldErrors?.password}
                  />
                  <div className="ivh-login__options">
                    <label className="ivh-login__checkbox" title="Keep me signed in for up to 30 days on this device">
                      <input
                        type="checkbox" name="rememberMe" checked={login.rememberMe}
                        onChange={(event) => setLogin({ ...login, rememberMe: event.target.checked })}
                      />
                      <span>Remember me</span>
                    </label>
                    <Link href="/forgot-password">Forgot password?</Link>
                  </div>
                  <button type="submit" className="ivh-login__main-btn" disabled={busy}>
                    {signingIn ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
                    {signingIn ? "Signing in…" : "Login"}
                  </button>
                </fieldset>
              </form>
              {demoAccounts ? <div className="ivh-login__demo">{demoAccounts}</div> : null}
              <div className="ivh-login__switch-area">
                <span>Don&apos;t have an account?</span>
                <Link
                  href={signupHref} onClick={openSignup} className="ivh-login__switch-circle"
                  aria-label="Create an account" aria-controls="signup-panel" aria-disabled={busy}
                >
                  <Plus size={23} aria-hidden="true" />
                </Link>
              </div>
              <p className="ivh-login__vendor">Here to sell? <Link href="/register">Open a free store</Link></p>
            </section>

            <section
              className="ivh-login__panel"
              data-face="signup"
              id="signup-panel"
              aria-labelledby="signup-heading"
              aria-hidden={mode !== "signup"}
              inert={mode !== "signup"}
            >
              <div className="ivh-login__emblem" aria-hidden="true"><UserRound size={31} strokeWidth={2.1} /></div>
              <h2 id="signup-heading" ref={signupHeading} tabIndex={-1} className="ivh-login__title">Create Account</h2>
              <p className="ivh-login__subtitle">Start your journey with Ibom Vendors Hub</p>
              <div className="ivh-login__google">{googleSignup}</div>
              <form
                action={signUp}
                aria-label="Create account"
                aria-busy={signingUp}
                onSubmit={(event) => {
                  if (signup.password !== signup.confirmPassword) {
                    event.preventDefault();
                    setConfirmError("Passwords do not match.");
                    event.currentTarget.querySelector<HTMLInputElement>("#confirmPassword")?.focus();
                  } else { setConfirmError(undefined); }
                }}
              >
                <FormFeedback state={signupState} />
                {destination ? <input type="hidden" name="next" value={destination} /> : null}
                <fieldset className="ivh-login__fields" disabled={busy || mode !== "signup"}>
                  <legend className="sr-only">Create your shopping account</legend>
                  <FloatingField
                    label="Full name" id="signupName" name="fullName" autoComplete="name" required minLength={3} maxLength={120}
                    value={signup.fullName} onChange={(event) => setSignup({ ...signup, fullName: event.target.value })}
                    error={signupState.fieldErrors?.fullName}
                  />
                  <FloatingField
                    label="Email address" id="signupEmail" name="email" type="email" autoComplete="email"
                    required maxLength={160} autoCapitalize="none" spellCheck={false}
                    value={signup.email} onChange={(event) => setSignup({ ...signup, email: event.target.value })}
                    error={signupState.fieldErrors?.email}
                  />
                  <FloatingField
                    label="Password" id="signupPassword" name="password" type="password" autoComplete="new-password"
                    required minLength={8} maxLength={128} hint="At least 8 characters, including a letter and a number."
                    value={signup.password} onChange={(event) => { setSignup({ ...signup, password: event.target.value }); setConfirmError(undefined); }}
                    error={signupState.fieldErrors?.password}
                  />
                  <FloatingField
                    label="Confirm password" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password"
                    required minLength={8} maxLength={128}
                    value={signup.confirmPassword} onChange={(event) => { setSignup({ ...signup, confirmPassword: event.target.value }); setConfirmError(undefined); }}
                    error={confirmError || signupState.fieldErrors?.confirmPassword}
                  />
                  <div>
                    <label className="ivh-login__checkbox ivh-login__terms">
                      <input
                        type="checkbox" name="acceptTerms" required checked={signup.acceptTerms}
                        aria-invalid={signupState.fieldErrors?.acceptTerms ? true : undefined}
                        aria-describedby={signupState.fieldErrors?.acceptTerms ? "signup-terms-error" : undefined}
                        onChange={(event) => setSignup({ ...signup, acceptTerms: event.target.checked })}
                      />
                      <span>I agree to the <Link href="/terms">terms of service</Link> and <Link href="/privacy">privacy policy</Link>.</span>
                    </label>
                    {signupState.fieldErrors?.acceptTerms ? <p id="signup-terms-error" className="ivh-login__field-error">{signupState.fieldErrors.acceptTerms}</p> : null}
                  </div>
                  <button type="submit" className="ivh-login__main-btn" disabled={busy}>
                    {signingUp ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
                    {signingUp ? "Creating account…" : "Create account"}
                  </button>
                </fieldset>
              </form>
              <p className="ivh-login__vendor">Want to sell instead? <Link href="/register">Create your free storefront</Link></p>
              <div className="ivh-login__switch-area">
                <span>Already have an account?</span>
                <button
                  type="button" className="ivh-login__switch-circle" onClick={() => flip("login")}
                  aria-label="Back to login" aria-controls="login-panel" disabled={busy}
                >
                  <ArrowLeft size={22} aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>
        </div>
        <Link href="/" className="ivh-login__back"><ArrowLeft size={14} aria-hidden="true" /> Back to marketplace</Link>
      </div>
    </main>
  );
}
