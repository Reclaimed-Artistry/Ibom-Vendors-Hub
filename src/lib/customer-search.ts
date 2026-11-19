/** Match literal user text rather than treating % and _ as SQL wildcards. */
export function customerSearchPattern(query: string): string {
  return `%${query.trim().slice(0, 200).replace(/[\\%_]/g, "\\$&")}%`;
}
