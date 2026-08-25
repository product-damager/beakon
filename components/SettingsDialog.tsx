"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ownerName, type BusinessUnit, type Owner, type Team } from "@/lib/types";
import { Avatar, Button, Eyebrow } from "./ui";
import { Field, TextInput } from "./form";
import { TeamPicker } from "./initiative-fields";

/** Profile settings — edit your display name and team. Launched from the sidebar. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentOwner, teams, businessUnits, saveProfile, notify } = useRoadmap();
  const { email } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-green-90/25" onClick={onClose} />
      <ProfileForm
        owner={currentOwner}
        email={email}
        teams={teams}
        businessUnits={businessUnits}
        onClose={onClose}
        onSave={async (patch) => {
          try {
            await saveProfile(patch);
            notify({ message: "Profile updated", tone: "success" });
            onClose();
          } catch {
            notify({ message: "Could not save your profile. Please try again.", tone: "error" });
          }
        }}
      />
    </div>
  );
}

function ProfileForm({
  owner,
  email,
  teams,
  businessUnits,
  onClose,
  onSave,
}: {
  owner: Owner | undefined;
  email: string | null;
  teams: Team[];
  businessUnits: BusinessUnit[];
  onClose: () => void;
  onSave: (patch: {
    name: string;
    surname: string;
    teamId: string;
    role: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(owner?.name ?? "");
  const [surname, setSurname] = useState(owner?.surname ?? "");
  const [role, setRole] = useState(owner?.role ?? "");
  const [teamId, setTeamId] = useState(owner?.teamId ?? "");
  const [saving, setSaving] = useState(false);

  // Live preview of how the name will render, using the same rule as everywhere else.
  const preview =
    ownerName({ id: "", name, surname, role: "", email: email ?? undefined }) || "—";
  const teamName = teams.find((t) => t.id === teamId)?.name ?? "";
  const previewSub = [teamName, role].filter(Boolean).join(" · ");

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), surname: surname.trim(), teamId, role: role.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative w-full max-w-md animate-slide-up rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-beige-20 px-6 py-4">
        <div>
          <Eyebrow>Profile</Eyebrow>
          <h2 className="font-display text-lg font-semibold text-green-90">Your settings</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-beige-60 hover:bg-beige-10 hover:text-green-90"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-beige-20 bg-beige-5 px-4 py-3">
          <Avatar name={preview} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-green-90">{preview}</div>
            {previewSub && <div className="truncate text-xs text-green-70">{previewSub}</div>}
            {email && <div className="truncate text-xs text-beige-60">{email}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <TextInput
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
            />
          </Field>
          <Field label="Surname">
            <TextInput
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Family name"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Team">
            <TeamPicker
              teams={teams}
              businessUnits={businessUnits}
              teamId={teamId}
              onChange={setTeamId}
            />
          </Field>
          <Field label="Job title">
            <TextInput
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Product Manager"
            />
          </Field>
        </div>

        <p className="text-xs text-beige-70">
          Leave both name fields empty to show your email instead. Extra spaces are trimmed.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-beige-20 px-6 py-3">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
