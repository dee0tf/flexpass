import Image from "next/image";
import { createServerSupabase } from "@/lib/supabase";

// Below this many logos the strip looks empty, so it stays hidden until
// enough hosts have opted in (see host_brands / dashboard settings).
const MIN_LOGOS = 3;
// The track is padded out by repeating the list so short lists still fill
// the screen, then doubled so translateX(-50%) loops without a seam.
const MIN_TRACK_ITEMS = 8;
const MAX_LOGOS = 30;

export default async function TrustedBy() {
  const supabase = createServerSupabase();
  // RLS only exposes opted-in rows with a logo; the filters just make it explicit
  const { data } = await supabase
    .from("host_brands")
    .select("user_id, brand_name, logo_url")
    .eq("show_in_trusted_by", true)
    .not("logo_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(MAX_LOGOS);

  const logos = (data || []).filter((b): b is { user_id: string; brand_name: string | null; logo_url: string } => !!b.logo_url);
  if (logos.length < MIN_LOGOS) return null;

  const fill = Array.from({ length: Math.ceil(MIN_TRACK_ITEMS / logos.length) }, () => logos).flat();
  const track = [...fill, ...fill];
  // Keep the speed constant (~4s per logo) however many there are
  const duration = `${fill.length * 4}s`;

  return (
    <section className="bg-[#0E0D0D] py-10 overflow-hidden" aria-label="Trusted by event organizers">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-white/50 mb-6">
        Trusted by organizers across Nigeria
      </p>
      <div className="fp-marquee-mask">
        <ul className="fp-marquee flex w-max" style={{ animationDuration: duration }}>
          {track.map((brand, i) => {
            // Only the first copy is announced; the rest are visual repeats
            const isRepeat = i >= logos.length;
            // mr-5 rather than gap-5 on the <ul>: a gap would leave the two
            // halves half a gap apart and the loop would visibly jump
            return (
              <li key={`${brand.user_id}-${i}`} aria-hidden={isRepeat}
                className="relative mr-5 h-16 w-40 shrink-0 rounded-xl bg-white/95 shadow-lg shadow-black/30">
                <Image src={brand.logo_url} alt={isRepeat ? "" : brand.brand_name || "Event organizer"}
                  title={brand.brand_name || undefined}
                  fill sizes="160px" className="object-contain p-3" />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
