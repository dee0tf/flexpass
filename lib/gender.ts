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
