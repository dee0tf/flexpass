"use client";

import { useState } from "react";
import Image from "next/image";

// Every logo gets roughly the same visual area rather than the same height:
// same height makes a wide wordmark dwarf a square crest, same box makes it
// tiny. Height scales by aspect^-0.5 so area stays constant, clamped so
// extreme shapes stay readable.
const BASE_HEIGHT = 76;
const MIN_HEIGHT = 36;
const MAX_WIDTH = 240;

export default function TrustedByLogo({ src, alt, title }: { src: string; alt: string; title?: string }) {
  const [aspect, setAspect] = useState(1);
  const height = Math.max(MIN_HEIGHT, Math.min(BASE_HEIGHT, BASE_HEIGHT / Math.sqrt(aspect), MAX_WIDTH / aspect));

  return (
    <Image src={src} alt={alt} title={title} width={320} height={160} sizes="240px"
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
      }}
      style={{ height, width: "auto" }}
      className="object-contain" />
  );
}
