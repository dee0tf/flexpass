import { Fragment, type CSSProperties } from "react";

interface Props {
  text: string;
  // ms before the first letter falls
  delay?: number;
  // ms between letters
  stagger?: number;
  className?: string;
  style?: CSSProperties;
  // Words to paint in a highlight colour (exact, case-insensitive match).
  highlight?: { words: string[]; color: string };
}

/**
 * Letters drop in one by one (see .fp-drop in globals.css). Pure CSS — no
 * client JS — so it renders on the server and animates on first paint.
 * Letters are grouped per word so lines only ever break between words, and
 * screen readers get the plain text instead of a letter-by-letter spell-out.
 */
export default function DropText({ text, delay = 0, stagger = 35, className = "", style, highlight }: Props) {
  const words = text.split(/\s+/).filter(Boolean);
  const hl = new Set((highlight?.words ?? []).map((w) => w.toLowerCase()));
  let i = 0;

  return (
    <span className={className} style={style}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, wi) => {
          const color = hl.has(word.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase()) ? highlight?.color : undefined;
          return (
            <Fragment key={wi}>
              <span className="inline-block whitespace-nowrap" style={color ? { color } : undefined}>
                {Array.from(word).map((ch, ci) => (
                  <span key={ci} className="fp-drop" style={{ animationDelay: `${delay + i++ * stagger}ms` }}>
                    {ch}
                  </span>
                ))}
              </span>
              {/* A real space between word blocks is what lets the line wrap */}
              {wi < words.length - 1 && " "}
            </Fragment>
          );
        })}
      </span>
    </span>
  );
}
