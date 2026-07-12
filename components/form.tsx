"use client";

import {
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { useOutsideClose } from "./hooks";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-green-90">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-beige-60">{hint}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-lg border border-beige-30 bg-white px-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(baseInput, "h-9", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(baseInput, "min-h-[76px] py-2 leading-relaxed", props.className)} />;
}

export function NativeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(baseInput, "h-9 appearance-none pr-9", props.className)}
      />
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-beige-60"
      />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  /** Optional leading color dot (Tailwind bg class), e.g. for theme colors. */
  dot?: string;
}

/**
 * Single-select dropdown with a type-to-filter search box — a searchable
 * alternative to NativeSelect for long option lists. The trigger mirrors
 * NativeSelect's look so it sits cleanly among the other form fields.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  useOutsideClose(ref, open, close);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  const pick = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(baseInput, "flex h-9 items-center gap-2 pr-9 text-left")}
      >
        {selected?.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", selected.dot)} />}
        <span className={cn("truncate", selected ? "text-green-90" : "text-beige-60")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-beige-60"
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-beige-20 bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-beige-60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                } else if (e.key === "Enter" && shown.length > 0) {
                  e.preventDefault();
                  pick(shown[0].value);
                }
              }}
              placeholder="Search…"
              className="h-8 w-full rounded-lg border border-beige-30 bg-white pl-8 pr-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90"
            />
          </div>
          <div className="calm-scroll max-h-56 space-y-0.5 overflow-auto" role="listbox">
            {shown.map((o) => {
              const on = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(o.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-beige-10",
                    on && "bg-beige-10"
                  )}
                >
                  {o.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", o.dot)} />}
                  <span className="truncate text-green-90">{o.label}</span>
                  {on && <Check size={14} strokeWidth={3} className="ml-auto shrink-0 text-green-70" />}
                </button>
              );
            })}
            {shown.length === 0 && (
              <div className="px-2.5 py-2 text-sm text-beige-60">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 5,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max - min + 1 }, (_, k) => k + min).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "h-8 w-8 rounded-md text-[13px] font-semibold transition-colors",
            value === n
              ? "bg-green-90 text-white"
              : "bg-beige-10 text-green-70 hover:bg-beige-20"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
