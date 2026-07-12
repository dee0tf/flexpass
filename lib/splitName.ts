/**
 * tickets.user_name stores "First Last" as one string (checkout now collects
 * first/last name as two separate required fields and joins them). CSV
 * exports split it back apart so hosts get First Name / Last Name columns
 * for filtering, sorting, and mail-merge instead of one combined field.
 */
export function splitName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
