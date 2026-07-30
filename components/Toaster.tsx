"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useRoadmap, type Toast } from "@/lib/store";
import { cn } from "@/lib/cn";

/**
 * One auto-dismissing toast. Toasts carrying an action (Undo / View) linger a
 * little longer so there's time to reach for the button.
 */
function ToastItem({ toast }: { toast: Toast }) {
  const { dismissToast } = useRoadmap();
  useEffect(() => {
    const ms = toast.action ? 7000 : 4500;
    const timer = setTimeout(() => dismissToast(toast.id), ms);
    return () => clearTimeout(timer);
  }, [toast.id, toast.action, dismissToast]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg",
        "animate-slide-up motion-reduce:animate-none",
        toast.tone === "error" ? "border-red-30" : "border-beige-20"
      )}
    >
      <span className="flex-1 text-sm text-green-90">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick();
            dismissToast(toast.id);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-green-70 transition-colors hover:bg-beige-10 hover:text-green-60"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-beige-60 transition-colors hover:bg-beige-10 hover:text-green-90"
      >
        <X size={15} />
      </button>
    </div>
  );
}

/** Bottom-right stack of ephemeral notifications. Announced politely for SR users. */
export function Toaster() {
  const { toasts } = useRoadmap();
  if (toasts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
