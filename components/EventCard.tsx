import Link from "next/link";
import Image from "next/image";
import { Event } from "@/lib/types";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <Link href={`/events/${event.id}`} className="block">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        {/* Event Image */}
        {event.image_url ? (
          <div className="w-full h-48 relative">
            <Image
              src={event.image_url}
              alt={event.title}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-gray-200"></div>
        )}
        
        {/* Event details */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-2">{event.title}</h3>
          <p className="text-sm text-gray-600 mb-1">{event.location}</p>
          <p className="text-xs text-gray-500 mb-2">
            {new Date(event.date).toLocaleDateString("en-NG", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-xl font-bold text-flex-purple">₦{event.price.toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}

