// Strips invisible Unicode characters (zero-width space/joiners, BOM, word
// joiner, soft hyphen) that a mobile keyboard or a copy-paste can silently
// insert into an email address. These don't match a plain \s-based regex,
// so an address with one embedded passes format validation looking
// completely normal, gets charged successfully via Paystack, then silently
// fails to deliver the confirmation email — invisible on screen the whole
// time. Also trims ordinary leading/trailing whitespace.
//
// Built from char codes (not literal escapes in a character class) so the
// invisible characters themselves never have to appear in this file's source.
const INVISIBLE_CODEPOINTS = [0x200b, 0x200c, 0x200d, 0xfeff, 0x2060, 0x00ad];
const INVISIBLE_CHARS = new RegExp(
  `[${INVISIBLE_CODEPOINTS.map(c => String.fromCharCode(c)).join("")}]`,
  "g"
);

export function sanitizeEmail(value: string): string {
  return value.replace(INVISIBLE_CHARS, "").trim();
}
