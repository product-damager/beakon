"use client";

import { useEffect, type ReactNode } from "react";

export function Drawer({
  open,
  onClose,
  width = 460,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-green-90/25" onClick={onClose} />
      <div
        className="calm-scroll relative flex h-full flex-col overflow-y-auto bg-white shadow-2xl animate-slide-in"
        style={{ width, maxWidth: "94vw" }}
      >
        {children}
      </div>
    </div>
  );
}
