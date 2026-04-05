"use client";

export default function LoadingSpinner() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <div className="relative mb-6">
        <div className="h-14 w-14 rounded-full border-4 border-[#eDdedd] border-t-[#480082] animate-spin" />
      </div>
      <p className="font-display text-[#480082] font-semibold text-lg tracking-wide">FlexPass</p>
      <p className="text-sm text-[#9F67FE] mt-1">Tap, Flex, Enter, Repeat.</p>
    </div>
  );
}
