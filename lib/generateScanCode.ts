// Unambiguous alphabet (no 0/O/1/I/L) since this code gets read aloud or
// typed by hand at the door. 8 chars is plenty against guessing given it's
// scoped to one event and grants nothing beyond scan access to it.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Isomorphic — Web Crypto's getRandomValues is available globally in both
// the browser (event editor, host-generated codes) and Node 19+ (admin API
// route), so the same generator produces identically-shaped codes either way.
export function generateScanCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join("");
}
