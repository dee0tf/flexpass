"use client";

import { useState } from "react";
import { buyerTotalFor, nextRoundBuyerTotal, priceForBuyerTotal } from "@/lib/platformFee";

const naira = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Sits under a tier's Price field and shows what the buyer pays at checkout.
 * With "Set what buyers pay" on, the host types the checkout total instead
 * and the tier price is worked back from it — FlexPass's 5% is unchanged.
 */
export default function FeeCalculator({ price, onPriceChange }: {
  price: string;
  onPriceChange: (price: string) => void;
}) {
  const priceNum = Number(price) || 0;
  // A saved tier whose price only makes sense as a worked-back total
  // (e.g. 7142.86 → ₦7,500) reopens in buyer-total mode.
  const [buyerMode, setBuyerMode] = useState(
    () => priceNum > 0 && priceNum % 1 !== 0 && buyerTotalFor(priceNum) % 1 === 0
  );
  const [typedBuyerTotal, setBuyerTotal] = useState(() => (priceNum > 0 ? String(buyerTotalFor(priceNum)) : ""));
  // Keep what the host typed while it matches the price; if they edit the
  // Price field directly instead, show the total that price now gives.
  const expectedTotal = priceNum > 0 ? buyerTotalFor(priceNum) : 0;
  const buyerTotal = Math.abs(expectedTotal - (Number(typedBuyerTotal) || 0)) < 0.001
    ? typedBuyerTotal
    : (priceNum > 0 ? String(expectedTotal) : "");

  const applyBuyerTotal = (value: string) => {
    setBuyerTotal(value);
    const total = Number(value);
    onPriceChange(total > 0 ? String(priceForBuyerTotal(total)) : "");
  };

  const toggleBuyerMode = () => setBuyerMode(!buyerMode);

  const total = expectedTotal;
  const roundUp = priceNum > 0 && !buyerMode ? nextRoundBuyerTotal(total) : null;

  return (
    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--card-border)" }}>
      <label className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        <input type="checkbox" checked={buyerMode} onChange={toggleBuyerMode} />
        Set what buyers pay at checkout (fee included)
      </label>

      {buyerMode && (
        <div className="mt-3 sm:w-1/3">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Buyer Pays (₦)</label>
          <input type="number" placeholder="e.g. 7500" value={buyerTotal} min="0"
            onChange={e => applyBuyerTotal(e.target.value)}
            className="w-full p-2 rounded-lg text-sm focus:outline-none focus:ring-2 transition"
            style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }} />
        </div>
      )}

      {priceNum > 0 ? (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Buyer pays <strong style={{ color: "var(--text-primary)" }}>{naira(total)}</strong>
          {" · "}You get <strong style={{ color: "var(--text-primary)" }}>{naira(priceNum)}</strong>
        </p>
      ) : (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Enter a price to see what buyers pay at checkout.
        </p>
      )}

      {roundUp !== null && (
        <button type="button" onClick={() => { setBuyerMode(true); applyBuyerTotal(String(roundUp)); }}
          className="mt-2 text-xs font-semibold hover:opacity-80 transition"
          style={{ color: "var(--brand-indigo)" }}>
          Round up: buyers pay {naira(roundUp)} →
        </button>
      )}
    </div>
  );
}
