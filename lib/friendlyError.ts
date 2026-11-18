/**
 * Turns database / storage / network errors into plain English for users.
 *
 * Postgres and Supabase errors ("violates foreign key constraint",
 * "duplicate key value", "row-level security policy") must never reach a
 * host or buyer. Messages our own API routes wrote are already English and
 * pass through unchanged.
 *
 * Log the raw error (console.error) before calling this — the original
 * wording is what you need for debugging.
 */

const DEFAULT_FALLBACK = "Something went wrong on our side. Please try again in a moment — if it keeps happening, contact FlexPass support.";

// Postgres / PostgREST error codes -> what actually happened, for a person.
const BY_CODE: Record<string, string> = {
  "23503": "This can't be changed or removed because other records depend on it — for example, a ticket class that people already hold tickets from. Tickets that have been sold or issued are always kept so their QR codes keep working.",
  "23505": "This already exists, so it wasn't added again. Refresh the page to see the latest version.",
  "23502": "Some required information is missing. Check that every field is filled in and try again.",
  "23514": "One of the values isn't allowed — check for negative numbers, empty names or dates in the wrong order, then try again.",
  "22P02": "One of the values is in the wrong format — for example, letters typed into a number field. Check the form and try again.",
  "22007": "One of the dates or times isn't valid. Pick it again from the date picker and try once more.",
  "22008": "One of the dates or times isn't valid. Pick it again from the date picker and try once more.",
  "22003": "One of the numbers is too large. Use a smaller value and try again.",
  "42501": "You don't have permission to do this. Try logging out and back in — if it still fails, make sure you're signed in to the account that owns this event.",
  "PGRST116": "We couldn't find what you were looking for. It may have been removed — refresh the page and try again.",
  "PGRST301": "Your session has expired. Please log in again.",
};

// Wording that only ever comes from the database/infrastructure, never from us.
const TECHNICAL = /violates|constraint|duplicate key|null value|relation "|column "|syntax error|invalid input syntax|row-level security|permission denied|PGRST|JWT|postgres|pg_|function .*\(|schema cache|ECONN|ETIMEDOUT|fetch failed|StorageApiError|Payload too large|mime type|exceeded the maximum allowed size|Bucket not found|The resource already exists|is not valid JSON|Unexpected token|Unexpected end of JSON/i;

function byKeyword(msg: string): string | null {
  if (/foreign key/i.test(msg)) return BY_CODE["23503"];
  if (/duplicate key|already exists/i.test(msg)) return BY_CODE["23505"];
  if (/null value/i.test(msg)) return BY_CODE["23502"];
  if (/check constraint/i.test(msg)) return BY_CODE["23514"];
  if (/invalid input syntax|invalid input value/i.test(msg)) return BY_CODE["22P02"];
  if (/row-level security|permission denied/i.test(msg)) return BY_CODE["42501"];
  if (/JWT|session/i.test(msg)) return BY_CODE["PGRST301"];
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) return "That file is too large. Use an image under 5MB and try again.";
  if (/mime type/i.test(msg)) return "That file type isn't supported. Use a PNG, JPG or WebP image.";
  if (/ECONN|ETIMEDOUT|fetch failed/i.test(msg)) return "We couldn't reach our servers just now. Please try again in a moment.";
  return null;
}

export function friendlyError(err: unknown, fallback: string = DEFAULT_FALLBACK): string {
  if (!err) return fallback;

  // Browser couldn't reach the server at all.
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
    return "We couldn't reach FlexPass. Check your internet connection and try again.";
  }

  const obj = typeof err === "object" ? (err as { code?: unknown; message?: unknown }) : null;
  const code = obj && obj.code != null ? String(obj.code) : "";
  if (code && BY_CODE[code]) return BY_CODE[code];

  const msg = typeof err === "string" ? err : obj && typeof obj.message === "string" ? obj.message : "";
  if (!msg.trim()) return fallback;

  if (TECHNICAL.test(msg)) return byKeyword(msg) ?? fallback;

  // Already a human message (e.g. written by one of our API routes).
  return msg;
}
