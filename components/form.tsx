"use client";

import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

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
