/** Personal copies are deliberate; never copy customer/vendor transactional mail. */
export function adminEmailRecipients(primary: string[] = []): string[] {
  const copies = process.env.ADMIN_NOTIFICATION_COPY_EMAILS ?? "victorgodwininyang@gmail.com";
  return [...new Set([...primary, ...copies.split(",")].map(value => value.trim().toLowerCase()).filter(Boolean))];
}
