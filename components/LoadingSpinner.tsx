"use client";

export default function LoadingSpinner() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="flex gap-2">
        <div className="h-3 w-3 rounded-full bg-gradient-to-r from-[#f97316] to-[#581c87] animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="h-3 w-3 rounded-full bg-gradient-to-r from-[#f97316] to-[#581c87] animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="h-3 w-3 rounded-full bg-gradient-to-r from-[#f97316] to-[#581c87] animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
}
