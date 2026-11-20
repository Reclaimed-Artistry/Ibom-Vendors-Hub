/** Match literal user text rather than treating % and _ as SQL wildcards. */
export function customerSearchPattern(query: string): string {
  return `%${query.trim().slice(0, 200).replace(/[\\%_]/g, "\\$&")}%`;
}

export type SearchableCustomer = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
};

/** Lowercase and strip punctuation so "Ada Inyang" and "ada-inyang" compare alike. */
export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function initials(name: string): string {
  return normalizeSearchText(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Score how well a customer matches a typed query. Higher is better; -1 means
 * no match. Every typed token must match the name, email, phone or initials,
 * so "ada iny" still finds "Ada Inyang" and "ai" can match initials.
 */
export function scoreCustomerMatch(customer: SearchableCustomer, query: string): number {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return 0;
  const name = normalizeSearchText(customer.full_name);
  const email = normalizeSearchText(customer.email);
  const phone = digitsOnly(customer.phone ?? "");
  const nameInitials = initials(customer.full_name);
  let score = 0;
  for (const token of tokens) {
    const tokenDigits = digitsOnly(token);
    if (name.startsWith(token)) score += 40;
    else if (name.includes(token)) score += 30;
    else if (email.includes(token)) score += 25;
    else if (tokenDigits.length >= 3 && phone.includes(tokenDigits)) score += 20;
    else if (token.length >= 2 && nameInitials.startsWith(token)) score += 15;
    else return -1;
  }
  return score;
}

/** Return the best-matching customers for a typed query, best first. */
export function filterCustomers<T extends SearchableCustomer>(
  customers: T[],
  query: string,
  limit = 8,
): T[] {
  if (!query.trim()) return [];
  return customers
    .map((customer) => ({ customer, score: scoreCustomerMatch(customer, query) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.customer.full_name.localeCompare(b.customer.full_name))
    .slice(0, limit)
    .map((entry) => entry.customer);
}

/**
 * Generic fuzzy scoring for any searchable text (used by every smart search
 * on the site). Higher is better; -1 means no match. Every typed token must
 * appear in the text, so partial words and multi-word queries both work.
 */
export function scoreTextMatch(text: string, query: string): number {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return 0;
  const haystack = normalizeSearchText(text);
  let score = 0;
  for (const token of tokens) {
    if (haystack.startsWith(token)) score += 40;
    else if (haystack.includes(token)) score += 30;
    else return -1;
  }
  return score;
}

/** Filter and rank items by fuzzy text match, best first. */
export function filterByText<T>(items: T[], query: string, getText: (item: T) => string, limit = 8): T[] {
  if (!query.trim()) return [];
  return items
    .map((item) => ({ item, score: scoreTextMatch(getText(item), query) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}
