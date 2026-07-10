"use client";

import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui";
import { Field, TextInput } from "./form";
import { Logo } from "./Logo";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    setError(null);
    const err = await signIn(email);
    if (err) {
      setError(err);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-beige-5 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo size={30} tile />
          <div className="leading-tight">
            <div className="font-display text-xl font-semibold text-green-90">Beakon</div>
            <div className="mono-label-sm text-beige-60">Roadmap workspace</div>
          </div>
        </div>

        <div className="rounded-2xl border border-beige-20 bg-white p-6 shadow-sm">
          {status === "sent" ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-10 text-green-70">
                <MailCheck size={22} />
              </div>
              <h1 className="font-display text-lg font-semibold text-green-90">Check your inbox</h1>
              <p className="mt-2 text-sm leading-relaxed text-green-70">
                We sent a magic sign-in link to{" "}
                <span className="font-medium text-green-90">{email}</span>. Open it on this device
                to continue.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 text-[13px] font-medium text-green-70 underline-offset-2 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-lg font-semibold text-green-90">Sign in</h1>
              <p className="mt-1 text-sm text-green-70">
                Use your Kameleoon email. We&apos;ll send you a one-time magic link — no password
                needed.
              </p>
              <form onSubmit={submit} className="mt-5">
                <Field label="Work email">
                  <TextInput
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@kameleoon.com"
                  />
                </Field>
                {error && <p className="mt-2 text-[13px] text-red-60">{error}</p>}
                <Button type="submit" className="mt-4 w-full" disabled={status === "sending"}>
                  {status === "sending" ? "Sending…" : "Send magic link"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-beige-60">
          Access is limited to the Kameleoon product team.
        </p>
      </div>
    </div>
  );
}
