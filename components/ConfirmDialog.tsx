"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./ui";

/**
 * Small centered confirmation modal for guarding a discard/destructive action.
 * Esc or a backdrop click cancels. Sits above drawers (z-50) and toasts (z-60).
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  secondaryConfirmLabel,
  onSecondaryConfirm,
  onConfirm,
  onCancel,
  hideCancelButton = false,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  /**
   * Optional third choice, rendered between Cancel and the primary confirm
   * button — only when both this and `onSecondaryConfirm` are provided, so
   * every existing two-button call site is unaffected (Sprint Heron Week 3,
   * plan §5.4 — the Roadmap discard-confirmation dialog's three-choice
   * shape: Cancel / Discard changes and switch / Update Roadmap and
   * switch). Rendered as a plain neutral `variant="ghost"` button — no red
   * at all (product-designer's ruling, Sprint Heron Week 3c,
   * QA-REPORT-HERON-W3.md finding #12: red-on-hover-red-tint read as
   * destructive-adjacent, which is the association this choice is meant to
   * avoid; it parallels an "undo"-style choice ("discard my edit"), not a
   * hard delete, so it gets the same visual weight as Cancel).
   */
  secondaryConfirmLabel?: string;
  onSecondaryConfirm?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Omit the Cancel button and render a corner X instead, wired to the same
   * `onCancel` (Sprint Heron, docs/plans/roadmap-dialog-viewmode-and-archive-
   * reversal.md T17/T18). Scoped, not universal: existing two-button
   * delete-confirmations keep Cancel and gain no X (product-designer's call,
   * docs/design/roadmap-dialog-viewmode-and-archive-reversal.md §1b) — Cancel
   * already is the "get me out" affordance there, so a redundant X would be
   * clutter with no matching removal.
   */
  hideCancelButton?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-green-90/40" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full rounded-2xl border border-beige-20 bg-white p-6 shadow-2xl animate-slide-up motion-reduce:animate-none",
          secondaryConfirmLabel ? "max-w-md" : "max-w-sm"
        )}
      >
        {hideCancelButton && (
          <button
            onClick={onCancel}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-beige-60 transition-colors hover:bg-beige-10 hover:text-green-90"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        )}
        <h2 className="pr-8 font-display text-lg font-semibold text-green-90">{title}</h2>
        {body && <p className="mt-2 pr-8 text-sm text-beige-60">{body}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {!hideCancelButton && (
            <Button variant="secondary" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          {secondaryConfirmLabel && onSecondaryConfirm && (
            <Button variant="ghost" size="sm" onClick={onSecondaryConfirm}>
              {secondaryConfirmLabel}
            </Button>
          )}
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
