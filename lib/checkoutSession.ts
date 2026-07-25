// One id per browser tab session, used purely to correlate a visitor's
// checkout-funnel events (opened -> initiated -> abandoned/completed)
// before we ever have an email or payment reference to join on.
const STORAGE_KEY = "fp_checkout_session";

export function getCheckoutSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Storage can throw in private-browsing/locked-down contexts — tracking
    // must never break checkout.
    return null;
  }
}
