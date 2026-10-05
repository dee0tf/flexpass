/**
 * Big F/M marker shown on tickets and the check-in result, for events that
 * price tickets by gender. Checkout only offers Male/Female; anything else
 * (older tickets, blanks) gets no marker.
 */
export function genderMark(gender: string | null | undefined) {
  if (gender === "Female") return { letter: "F", word: "Female", color: "#E0457B" };
  if (gender === "Male") return { letter: "M", word: "Male", color: "#2F6FE4" };
  return null;
}

export const GENDERS = ["Male", "Female"] as const;

/**
 * Gender for the i-th ticket of an order: that attendee's own pick from
 * `genders` (sent per ticket by checkout), else the order-level `fallback`
 * (older clients sent just one). Anything other than Male/Female -> null.
 */
export function ticketGender(genders: unknown, fallback: unknown, i: number): string | null {
  // Paystack metadata carries the compact form ("MFF") to stay well under its
  // size limit; checkout's API calls send the full ["Male", "Female", ...].
  const own = Array.isArray(genders) ? genders[i]
    : typeof genders === "string" ? ({ M: "Male", F: "Female" } as Record<string, string>)[genders[i]]
    : undefined;
  if (own === "Male" || own === "Female") return own;
  return fallback === "Male" || fallback === "Female" ? fallback : null;
}
