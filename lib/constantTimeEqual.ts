import { timingSafeEqual } from "crypto";

// Plain string `!==` short-circuits on the first differing byte, which is a
// timing side-channel for secret comparisons (door-staff scan codes here).
// timingSafeEqual requires equal-length buffers, so the length check has to
// happen first — that itself leaks length, but length alone (of an 8-char
// fixed-format code) isn't the secret.
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
