"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CheckInScanner, { CheckInEvent } from "@/components/CheckInScanner";

export default function CheckInPage() {
  const [events, setEvents] = useState<CheckInEvent[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("events")
        .select("id, title, date")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });
      setEvents(data || []);
    })();
  }, []);

  return <CheckInScanner events={events} />;
}
