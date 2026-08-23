"use client";

import { useEffect, useState } from "react";

/** Close a popover when the user clicks/taps outside of `ref`. */
export function useOutsideClose(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, ref, close]);
}

/** Roughly how tall a dropdown-style popover shell (search box + capped
 * scrollable list) tends to be — used only as a rough budget for the
 * one-time collision check below, not an exact measurement. */
const POPOVER_HEIGHT_BUDGET_PX = 300;

/**
 * Decides whether a popover anchored below `triggerRef` has room to open
 * downward, or should flip upward instead — e.g. a dropdown inside a
 * short, vertically-centered modal (Settings dialog) opening low enough
 * that its bottom edge would land past the viewport. A one-time check on
 * open is enough: the popover already closes on outside click/scroll via
 * `useOutsideClose`, so it never needs to react to a live resize.
 */
export function usePopoverPlacement(
  triggerRef: React.RefObject<HTMLElement | null>,
  open: boolean
): "top" | "bottom" {
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    setPlacement(roomBelow < POPOVER_HEIGHT_BUDGET_PX && rect.top > POPOVER_HEIGHT_BUDGET_PX ? "top" : "bottom");
  }, [open, triggerRef]);
  return placement;
}
