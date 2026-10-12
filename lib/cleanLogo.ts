// Brand logos go on the dark "Trusted by" strip, so a solid backdrop (white
// box, black square) or a big empty canvas around the mark looks bad there.
// cleanLogoPixels works on raw RGBA so the browser upload and one-off Node
// scripts share it; cleanLogoFile is the browser wrapper used on upload.

export interface Rgba { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }

// Colour distance below which a pixel counts as background, and the band
// above it that fades out instead of cutting hard (keeps anti-aliased edges)
const BG_TOLERANCE = 40;
const BG_FEATHER = 30;
// The edge must be at least this uniform before we treat it as a backdrop;
// otherwise it's a photo or a logo that runs to the edge, so leave it alone
const MIN_UNIFORM_EDGE = 0.9;
const PAD_FRACTION = 0.04;

const dist = (d: Uint8ClampedArray, i: number, c: number[]) =>
  Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2]);

export function cleanLogoPixels({ data: src, width: w, height: h }: Rgba): Rgba {
  const data = new Uint8ClampedArray(src);

  const edge: number[] = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);

  const opaqueEdge = edge.filter((p) => data[p * 4 + 3] > 200);
  // Mostly transparent edge = already a cut-out logo; only trim it
  if (opaqueEdge.length > edge.length * 0.5) {
    const avg = [0, 1, 2].map((k) => opaqueEdge.reduce((s, p) => s + data[p * 4 + k], 0) / opaqueEdge.length);
    const uniform = opaqueEdge.filter((p) => dist(data, p * 4, avg) < BG_TOLERANCE).length;
    if (uniform >= opaqueEdge.length * MIN_UNIFORM_EDGE) {
      // Flood fill from the edge so background-coloured parts inside the
      // logo (white text in a black badge, say) are kept
      const seen = new Uint8Array(w * h);
      const stack = edge.slice();
      while (stack.length) {
        const p = stack.pop()!;
        if (seen[p]) continue;
        seen[p] = 1;
        const i = p * 4;
        const d = dist(data, i, avg);
        if (d >= BG_TOLERANCE + BG_FEATHER) continue;
        data[i + 3] = d < BG_TOLERANCE ? 0 : Math.min(data[i + 3], Math.round(((d - BG_TOLERANCE) / BG_FEATHER) * 255));
        if (d >= BG_TOLERANCE) continue; // feathered edge pixel: don't spread past it
        const x = p % w;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (p >= w) stack.push(p - w);
        if (p < w * (h - 1)) stack.push(p + w);
      }
    }
  }

  // Trim to the visible mark plus a little breathing room
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 16) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { data: new Uint8ClampedArray(src), width: w, height: h }; // nothing left; keep the original

  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * PAD_FRACTION);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) out.set(data.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x1 + 1) * 4), y * cw * 4);
  return { data: out, width: cw, height: ch };
}

const MAX_DIMENSION = 800;

/** Browser only: returns a trimmed PNG with any solid backdrop made transparent. */
export async function cleanLogoFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const cleaned = cleanLogoPixels({ data: ctx.getImageData(0, 0, w, h).data, width: w, height: h });
  canvas.width = cleaned.width; canvas.height = cleaned.height;
  ctx.putImageData(new ImageData(cleaned.data, cleaned.width, cleaned.height), 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/png"));
}
