"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";
export type ToastState = { message: string; type: ToastType } | null;

const CONFIG: Record<ToastType, { icon: React.ElementType; bg: string; border: string }> = {
  success: { icon: CheckCircle2, bg: "#16a34a", border: "#15803d" },
  error:   { icon: XCircle,      bg: "#dc2626", border: "#b91c1c" },
  warning: { icon: AlertTriangle, bg: "#d97706", border: "#b45309" },
  info:    { icon: Info,          bg: "#480082", border: "#3a006b" },
};

interface ToastProps {
  toast: ToastState;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const cfg = CONFIG[toast.type];
  const Icon = cfg.icon;

  return (
    <div
      className="fixed top-5 right-5 z-[9999] flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold max-w-sm"
      style={{
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        animation: "slideInFromTop 0.25s ease-out",
      }}
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onClose}
        className="shrink-0 opacity-70 hover:opacity-100 transition ml-1"
        aria-label="Close"
      >
        <X size={14} />
      </button>
      <style>{`
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
