/**
 * Loan officer registry.
 *
 * Loan officers are registered loan agents who can assess and disburse loan
 * applications. The agent gate runs synchronously in Server Components
 * (layouts and pages), so the registry is held in memory and seeded from the
 * `LOAN_AGENTS` environment variable, e.g.:
 *
 *   LOAN_AGENTS="officer@example.com:Officer Name:0800 000 0000,agent2@example.com:Agent Two:0801 111 1111"
 *
 * Entries may also be plain emails ("officer@example.com"); the name is then
 * derived from the address and the phone is left unset.
 */
export interface LoanAgent {
  email: string;
  name: string;
  phone?: string;
}

function parseName(email: string): string {
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function parseLoanAgents(raw?: string): LoanAgent[] {
  const agents: LoanAgent[] = [];
  if (!raw) return agents;
  for (const entry of raw.split(",")) {
    const [email, name, phone] = entry.trim().split(":").map((part) => part.trim());
    if (!email) continue;
    agents.push({
      email: email.toLowerCase(),
      name: name || parseName(email),
      phone: phone || undefined,
    });
  }
  return agents;
}

let LOAN_AGENTS: LoanAgent[] = parseLoanAgents(process.env.LOAN_AGENTS);

/** Replace the in-memory registry (useful for seeding from a database). */
export function setLoanAgents(agents: LoanAgent[]): void {
  LOAN_AGENTS = agents.map((agent) => ({
    email: agent.email.toLowerCase(),
    name: agent.name,
    phone: agent.phone ?? undefined,
  }));
}

/** All registered loan agents. */
export function getLoanAgents(): readonly LoanAgent[] {
  return LOAN_AGENTS;
}

/**
 * Look up a registered loan agent by email (case-insensitive).
 * Returns `undefined` when the email is not a registered loan officer.
 */
export function getLoanAgentByEmail(email: string): LoanAgent | undefined {
  const key = email.trim().toLowerCase();
  return LOAN_AGENTS.find((agent) => agent.email === key);
}

/**
 * Round-robin agent assignment. `count` is the number of existing
 * applications; the agent at `count % total` receives the next one.
 * Falls back to the `LOAN_NOTIFICATION_EMAIL` recipient (or an unassigned
 * placeholder) when no loan officers are configured.
 */
export function selectLoanAgent(count: number): LoanAgent {
  if (LOAN_AGENTS.length > 0) {
    return LOAN_AGENTS[Number(count) % LOAN_AGENTS.length];
  }
  const fallbackEmail = String(process.env.LOAN_NOTIFICATION_EMAIL ?? "")
    .split(",")[0]
    ?.trim();
  if (fallbackEmail) {
    return { email: fallbackEmail, name: parseName(fallbackEmail) };
  }
  return { email: "", name: "Unassigned Loan Officer" };
}
