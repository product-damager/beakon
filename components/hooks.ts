"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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

// ── useClampedPopover ──────────────────────────────────────────────────────
//
// Extracted from `RoadmapNav.tsx`'s `NewRoadmapRow` (Sprint Heron Week 3),
// which was the one spot in the sidebar that got this right: a
// `document.body` portal, `position: fixed` coordinates computed from the
// trigger's `getBoundingClientRect()`, clamped against the viewport on all
// four edges (flipping above the trigger when there's no room below), kept
// in sync on scroll/resize, and closed-with-refocus if the trigger itself
// scrolls out of view within one of its own scrollable ancestors. Every
// other popover in this file/family (`RoadmapNav.tsx`'s "⋮" menu and Share
// panels, `AppShell.tsx`'s header Share button) instead used a plain
// `absolute right-0`/`left-0 top-full` — which clips inside any scrolling
// ancestor and can render fully off-screen near a viewport edge. This hook
// relocates the correct approach so it has exactly one home instead of one
// correct copy and N buggy ones.
//
// The clamping math and every edge case below is re-derived from nothing —
// it's the exact logic `NewRoadmapRow` shipped with, preserved verbatim,
// after a real QA history (`QA-REPORT-HERON-W3C/D/E/F/G.md`) found each
// piece the hard way:
//
//   - N1/N21 (viewport clamp): an unclamped position can render the whole
//     popover off the fold in any direction, unreachable by mouse or
//     keyboard since it's a `position: fixed` portal nothing scrolls.
//   - N20 (scroll-ancestor containment, not viewport intersection): a
//     trigger clipped by an `overflow: auto` ancestor still reports
//     coordinates outside that ancestor's box via `getBoundingClientRect`
//     alone — the popover has to walk the ancestor chain to catch that.
//   - N27 (containment, not mere intersection): since the popover anchors
//     off the trigger's edge, a *partially* clipped trigger already puts
//     the popover's whole body outside the ancestor — an intersection test
//     only flips once the trigger is *entirely* outside, leaving a window
//     where the popover has already detached and floats over unrelated
//     content.
//   - N3/N10/N11/N15/N16 (reposition, don't close, on scroll/resize): an
//     earlier version closed the popover on every scroll/resize event
//     instead of repositioning it, and went through two follow-up bug
//     passes because "was this the right event to close on" is a genuinely
//     hard heuristic (the popover's own input scrolling itself, a scroll
//     already in flight before the click, inertial scrolling past any
//     fixed arming delay, `resize` events whose `target` isn't even a
//     `Node`). Repositioning by default sidesteps the whole class; the one
//     remaining close condition (N20) is a state check recomputed fresh on
//     every call, not an event-type guess.
//   - N28 (refocus on auto-close): a keyboard/screen-reader user who
//     triggers the N20 auto-close, `Escape`, or `Cancel` must land back on
//     the trigger, not on `<body>`. `preventScroll: true` because this can
//     fire mid-scroll-gesture and must not fight it. Deliberately NOT used
//     for outside-click, where the browser is already moving focus to
//     whatever was just clicked.
//
// Outside-click is handled locally here (not the shared `useOutsideClose`
// hook) because the popover lives in a portal outside the trigger's own DOM
// subtree — a single ref can't cover both.

type ClampedPopoverAlign = "left" | "right";

export interface ClampedPopoverOptions {
  /** Fallback width/height (px) used for the first-paint clamp before the
   * popover has mounted and can be measured for real (see the two-pass
   * placement in `reposition` below). Tune per caller: the sidebar's "⋮"
   * menu is much smaller than a Share panel. */
  estimatedWidth?: number;
  estimatedHeight?: number;
  /** Which edge of the trigger the popover's matching edge aligns to.
   * "left" (default) mirrors an `absolute left-0`-style anchor (e.g. the
   * "+ New roadmap" popover, left-aligned to its trigger). "right" mirrors
   * an `absolute right-0`-style anchor (e.g. the "⋮" menu / Share panels,
   * right-aligned to a narrow trigger near the sidebar's own edge). */
  align?: ClampedPopoverAlign;
}

export interface ClampedPopover {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  coords: { top: number; left: number } | null;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  /** Closes the popover and returns focus to the trigger (N28) — use for
   * `Escape`/`Cancel`, not outside-click (the browser already moves focus
   * there on its own). */
  close: () => void;
}

/**
 * See the file-level comment above for the full rationale. `triggerRef` is
 * owned by the caller (not this hook) so multiple independent popovers
 * (e.g. a "⋮" menu and the Share panel it opens) can share one trigger
 * element's rect without fighting over who mounts it.
 */
export function useClampedPopover(
  triggerRef: React.RefObject<HTMLElement | null>,
  options: ClampedPopoverOptions = {}
): ClampedPopover {
  const { estimatedWidth = 256, estimatedHeight = 134, align = "left" } = options;
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // True while `el`'s own rect is still *fully* contained within every
  // scrollable ancestor's visible box (N20/N27 above).
  function isVisibleWithinScrollAncestors(el: HTMLElement): boolean {
    // Absorbs sub-pixel rounding noise between two independently-measured
    // rects (seen under non-integer browser zoom) without meaningfully
    // widening the containment check itself.
    const EPSILON = 0.5;
    const rect = el.getBoundingClientRect();
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const scrollsY = style.overflowY === "auto" || style.overflowY === "scroll";
      const scrollsX = style.overflowX === "auto" || style.overflowX === "scroll";
      if (!scrollsY && !scrollsX) continue;
      const ancestorRect = node.getBoundingClientRect();
      const clippedY =
        scrollsY && (rect.top < ancestorRect.top - EPSILON || rect.bottom > ancestorRect.bottom + EPSILON);
      const clippedX =
        scrollsX && (rect.left < ancestorRect.left - EPSILON || rect.right > ancestorRect.right + EPSILON);
      if (clippedY || clippedX) return false;
    }
    return true;
  }

  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, [triggerRef]);

  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    if (!isVisibleWithinScrollAncestors(triggerRef.current)) {
      closeAndRefocus();
      return;
    }
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current?.getBoundingClientRect();
    const height = popoverRect?.height ?? estimatedHeight;
    const width = popoverRect?.width ?? estimatedWidth;
    const top = Math.max(
      8,
      Math.min(
        triggerRect.bottom + height + 4 > window.innerHeight
          ? triggerRect.top - height - 4
          : triggerRect.bottom + 4,
        window.innerHeight - height - 8
      )
    );
    const anchorLeft = align === "right" ? triggerRect.right - width : triggerRect.left;
    const left = Math.max(8, Math.min(anchorLeft, window.innerWidth - width - 8));
    setCoords((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [align, closeAndRefocus, estimatedHeight, estimatedWidth, triggerRef]);

  // Initial placement on open, and a second pass once the popover has
  // mounted so `reposition` can measure its real size instead of the
  // estimate above. `isMeasured` flips false→true exactly once per open,
  // which triggers that second run.
  const isMeasured = coords !== null;
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, isMeasured, reposition]);

  // Keep tracking the trigger as the page scrolls or resizes, rather than
  // closing (see the file-level comment for why). `capture: true` so this
  // also catches a scrolling sidebar region, not just the window;
  // `passive: true` since this never calls `preventDefault`.
  useEffect(() => {
    if (!open) return;
    document.addEventListener("scroll", reposition, { capture: true, passive: true });
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  // Portal-local outside-click (see file-level comment for why this can't
  // be the shared `useOutsideClose` hook).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, triggerRef]);

  // Escape-to-close, handled at the document level rather than an
  // `onKeyDown` on the portaled popover div: clicking the trigger leaves
  // keyboard focus on the trigger `<button>` itself (nothing here moves
  // focus into the portal), and since the popover is a `document.body`
  // portal — a DOM sibling, not a descendant, of the trigger — a keydown
  // fired while focus sits on the trigger never bubbles into the portal's
  // own `onKeyDown`. Listening on `document` sidesteps that regardless of
  // where focus actually is while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAndRefocus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closeAndRefocus]);

  return { open, setOpen, coords, popoverRef, close: closeAndRefocus };
}
