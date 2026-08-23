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
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  /** Validation message; shown in red and takes precedence over `hint`. */
  error?: string;
  /** Adds a red asterisk to the label. */
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-green-90">
        {label}
        {required && (
          <span className="text-red-60" aria-hidden>
            {" "}
            *
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-70">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-beige-60">{hint}</span>
      ) : null}
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
 * Multi-select popover — checkbox list + optional search + select-all/clear,
 * behind a trigger that shares `NativeSelect`/`FilterPill`'s base chrome
 * (`h-9 rounded-lg border-beige-30 bg-white`, `FilterPill`'s `border-green-90`
 * open-state convention) per docs/design/okr-filters-archive-parity-and-
 * delayed-health.md §1. Generalized from `FilterBar.tsx`'s `FieldEditor`/
 * `FilterPill` minus the is/is-not `Segmented` mode toggle — this is for a
 * fixed, always-present field (reset to "all", not removable), so unlike
 * `FilterPill` there is no field-name prefix and no `X` remove button on the
 * trigger; clearing is "Select all"/"Clear" inside the popover, or the
 * bar's own "Clear all".
 */
export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = "All",
  searchable = false,
  ariaLabel,
  className,
}: {
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  useOutsideClose(ref, open, close);

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const allValues = options.map((o) => o.value);
  const allSelected = allValues.length > 0 && allValues.every((v) => values.includes(v));

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? placeholder
        : `${values.length} selected`;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          baseInput,
          "flex h-9 items-center gap-2 pr-9 text-left transition-colors",
          open ? "border-green-90" : "border-beige-30"
        )}
      >
        <span className={cn("truncate", values.length > 0 ? "text-green-90" : "text-beige-60")}>
          {summary}
        </span>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-beige-60"
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-beige-20 bg-white p-2 shadow-lg">
          {searchable && (
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
                  }
                }}
                placeholder="Search…"
                className="h-8 w-full rounded-lg border border-beige-30 bg-white pl-8 pr-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => onChange(allSelected ? [] : allValues)}
            className="mb-1 w-full rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-green-70 hover:bg-beige-10"
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>

          <div className="calm-scroll max-h-56 space-y-0.5 overflow-auto" role="listbox">
            {shown.map((o) => {
              const on = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-beige-10"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      on ? "border-green-90 bg-green-90 text-white" : "border-beige-40 bg-white"
                    )}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  {o.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", o.dot)} />}
                  <span className="truncate text-green-90">{o.label}</span>
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
        {selected?.dot && <span className={cn("h-3 w-1 shrink-0 rounded-[2px]", selected.dot)} />}
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
                  {o.dot && <span className={cn("h-3 w-1 shrink-0 rounded-[2px]", o.dot)} />}
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

/**
 * A tag/pill that opens an inline menu to pick a new value — powers quick
 * edits in place (drawer header, List rows). `render` draws both the trigger
 * and each option, so callers pass e.g. a <StatusTag/> or <HealthTag/>.
 * Clicks are stopped from bubbling so it works inside a clickable row.
 */
export function InlineTagSelect<T extends string>({
  label,
  value,
  options,
  render,
  onSelect,
  fill = false,
}: {
  label: string;
  value: T;
  options: readonly T[];
  render: (v: T) => ReactNode;
  onSelect: (v: T) => void;
  /** Fill the parent cell and make the whole area clickable, with the
   * chevron hidden until hover — for table cells, where the small
   * tag-plus-chevron hit target reads as fussier than it needs to be.
   * Defaults to the original inline, always-visible-chevron sizing used
   * inside drawers. */
  fill?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, open, () => setOpen(false));

  return (
    <div className={cn("group relative", fill ? "block" : "inline-block")} ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-90 focus-visible:ring-offset-1",
          fill ? "h-full w-full px-3 py-2.5 text-left hover:bg-beige-10" : "inline-flex hover:opacity-80"
        )}
      >
        {render(value)}
        <ChevronDown
          size={13}
          className={cn(
            "text-beige-60",
            fill && "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 min-w-[15rem] rounded-xl border border-beige-20 bg-white p-1 shadow-lg"
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={o === value}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                if (o !== value) onSelect(o);
              }}
              className="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left hover:bg-beige-10"
            >
              {render(o)}
              {o === value && (
                <Check size={14} strokeWidth={3} className="ml-auto shrink-0 text-green-70" />
              )}
            </button>
          ))}
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
