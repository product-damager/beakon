"use client";

import { useState } from "react";
import {
  Activity,
  Archive,
  ArchiveRestore,
  CalendarRange,
  CircleDot,
  Clock,
  Eye,
  Palette,
  User,
  Users,
  X,
} from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { formatDateEN, quarterLabelFromISO } from "@/lib/dates";
import {
  HEALTH_META,
  normalizeThemeColor,
  ownerName,
  STATUSES,
  TEAMS,
  THEME_COLOR_META,
  type Health,
  type Initiative,
  type Status,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { Drawer } from "./Drawer";
import { ConfirmDialog } from "./ConfirmDialog";
import { Avatar, Button, Eyebrow, HealthTag, StatusTag } from "./ui";
import { Field, InlineTagSelect, SearchableSelect, TextArea, TextInput } from "./form";
import {
  CollapsibleSection,
  DeliveryLinksEditor,
  DependencyPicker,
  DiveEditor,
  makeWouldCycle,
  PropRow,
  ThemeCreator,
  withScheme,
} from "./initiative-fields";

const HEALTH_KEYS = Object.keys(HEALTH_META) as Health[];
const VISIBILITIES = ["internal", "external"] as const;

/**
 * One drawer for viewing and editing an initiative. Existing initiatives edit in
 * place and autosave per field (discrete controls commit immediately, free text
 * on blur); "New" opens the same drawer on a local draft with an explicit Create.
 */
export function InitiativeDrawer() {
  const { selectedId, editorDraft, getInitiative } = useRoadmap();
  const creating = editorDraft !== null;
  const existing = !creating && selectedId ? getInitiative(selectedId) : undefined;
  const source = creating ? editorDraft : existing;
  if (!source) return null;
  // Key by id so switching initiatives (or create → view) fully resets local state.
  return <DrawerBody key={source.id} source={source} creating={creating} />;
}

function DrawerBody({ source, creating }: { source: Initiative; creating: boolean }) {
  const {
    initiatives,
    owners,
    themes,
    getOwner,
    getTheme,
    saveInitiative,
    addTheme,
    archiveInitiative,
    unarchiveInitiative,
    closeEditor,
    select,
    notify,
  } = useRoadmap();

  const [d, setD] = useState<Initiative>(source);
  const [titleTouched, setTitleTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Both detail sections start collapsed: the drawer opens on the at-a-glance
  // read (properties + summary) and you expand into the case or the plumbing.
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Local edit + autosave. Discrete controls commit immediately via patch(); free
  // text commits on blur via saveNow(). In create mode nothing persists until Create.
  const set = <K extends keyof Initiative>(key: K, value: Initiative[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));
  const patch = (p: Partial<Initiative>) => {
    const next = { ...d, ...p };
    setD(next);
    if (!creating) saveInitiative(next);
  };
  const saveNow = () => {
    if (!creating) saveInitiative(d);
  };

  const theme = getTheme(d.themeId);
  const titleMissing = d.title.trim().length === 0;
  const dateOutOfOrder = d.targetStart > d.targetEnd;
  // "Q3 2026" for a single quarter; a range drops the repeated year ("Q2 – Q3 2026")
  // so the chip stays short enough to sit beside the two date inputs.
  const qStart = quarterLabelFromISO(d.targetStart);
  const qEnd = quarterLabelFromISO(d.targetEnd);
  const [qStartQ, qStartY] = qStart.split(" ");
  const timeframeQuarter =
    qStart === qEnd
      ? qStart
      : qStartY === qEnd.split(" ")[1]
        ? `${qStartQ} – ${qEnd}`
        : `${qStart} – ${qEnd}`;

  const wouldCycle = makeWouldCycle(initiatives, d.id, d.dependsOn);
  const blocks = initiatives.filter((x) => x.dependsOn.includes(d.id) && !x.archived);
  const ownerOptions = ["", ...owners.map((o) => o.id)];
  const themeOptions = [
    { value: "", label: "No theme" },
    ...themes.map((t) => ({
      value: t.id,
      label: t.name,
      dot: THEME_COLOR_META[normalizeThemeColor(t.color)].dot,
    })),
  ];

  const dirty = creating && JSON.stringify(d) !== JSON.stringify(source);
  const attemptClose = () => {
    if (dirty) setConfirmOpen(true);
    else if (creating) closeEditor();
    else select(null);
  };

  const create = () => {
    if (titleMissing || dateOutOfOrder) {
      setTitleTouched(true);
      return;
    }
    const cleanLinks = d.deliveryLinks
      .filter((l) => l.url.trim() || l.label.trim())
      .map((l) => ({ ...l, url: withScheme(l.url), label: l.label.trim() }));
    const toSave: Initiative = { ...d, title: d.title.trim(), deliveryLinks: cleanLinks };
    saveInitiative(toSave);
    notify({
      message: "Initiative created",
      tone: "success",
      action: { label: "View", onClick: () => select(toSave.id) },
    });
    closeEditor();
  };

  return (
    <Drawer open onClose={attemptClose} width={560}>
      {/* Header — theme marker + inline title */}
      <div className="sticky top-0 z-10 border-b border-beige-20 bg-white px-6 pb-4 pt-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {creating ? (
              <Eyebrow>New</Eyebrow>
            ) : (
              <>
                {theme && (
                  <span
                    className={cn(
                      "h-3 w-1 shrink-0 rounded-[2px]",
                      THEME_COLOR_META[normalizeThemeColor(theme.color)].dot
                    )}
                  />
                )}
                <Eyebrow>{theme?.name ?? "No theme"}</Eyebrow>
              </>
            )}
          </div>
          <button
            onClick={attemptClose}
            className="rounded-md p-1 text-beige-60 hover:bg-beige-10 hover:text-green-90"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <input
          value={d.title}
          onChange={(e) => set("title", e.target.value)}
          onBlur={() => {
            setTitleTouched(true);
            patch({ title: d.title.trim() });
          }}
          placeholder="What is this initiative?"
          aria-label="Title"
          autoFocus={creating}
          className="w-full bg-transparent font-display text-xl font-semibold leading-snug text-green-90 placeholder:text-beige-40 focus:outline-none"
        />
        {creating && titleTouched && titleMissing && (
          <p className="mt-1 text-xs text-red-70">Give the initiative a title.</p>
        )}
      </div>

      {/* Properties — compact labeled rows, edited in place */}
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <PropRow icon={CircleDot} label="Status">
          <InlineTagSelect
            label="Change status"
            value={d.status}
            options={STATUSES}
            render={(s: Status) => <StatusTag status={s} />}
            onSelect={(status) => patch({ status })}
          />
        </PropRow>
        <PropRow icon={Activity} label="Health">
          <InlineTagSelect
            label="Change health"
            value={d.health}
            options={HEALTH_KEYS}
            render={(h: Health) => <HealthTag health={h} />}
            onSelect={(health) => patch({ health })}
          />
        </PropRow>
        <PropRow icon={CalendarRange} label="Timeframe">
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              type="date"
              value={d.targetStart}
              onChange={(e) => patch({ targetStart: e.target.value })}
              aria-label="Target start"
              style={{ width: "132px" }}
            />
            <span className="text-beige-60" aria-hidden>
              →
            </span>
            <TextInput
              type="date"
              value={d.targetEnd}
              onChange={(e) => patch({ targetEnd: e.target.value })}
              aria-invalid={dateOutOfOrder}
              aria-label="Target end"
              style={{ width: "132px" }}
            />
            <span className="mono-label-sm shrink-0 whitespace-nowrap rounded-md border border-beige-20 bg-beige-5 px-2 py-1 text-beige-60">
              {timeframeQuarter}
            </span>
          </div>
        </PropRow>
        {dateOutOfOrder && (
          <p className="px-2 pb-1 text-xs text-red-70">End date must be on or after the start date.</p>
        )}
        <PropRow icon={User} label="Owner">
          <InlineTagSelect
            label="Change owner"
            value={d.ownerId}
            options={ownerOptions}
            render={(id) =>
              id ? (
                <span className="inline-flex items-center gap-2">
                  <Avatar name={ownerName(getOwner(id))} className="h-5 w-5 text-[9px]" neutral />
                  {ownerName(getOwner(id))}
                </span>
              ) : (
                <span className="text-beige-60">Unassigned</span>
              )
            }
            onSelect={(ownerId) => patch({ ownerId })}
          />
        </PropRow>
        <PropRow icon={Users} label="Team">
          <InlineTagSelect
            label="Change team"
            value={d.team}
            options={TEAMS}
            render={(t) => (
              <span className="mono-label inline-flex items-center rounded-md bg-beige-10 px-2 py-1 text-beige-60">
                {t}
              </span>
            )}
            onSelect={(team) => patch({ team })}
          />
        </PropRow>
        <PropRow icon={Palette} label="Theme">
          <div>
            <SearchableSelect
              ariaLabel="Theme"
              value={d.themeId}
              onChange={(v) => patch({ themeId: v })}
              placeholder="No theme"
              options={themeOptions}
            />
            <ThemeCreator
              onCreate={(t) => {
                addTheme(t);
                patch({ themeId: t.id });
              }}
            />
          </div>
        </PropRow>
        <PropRow icon={Eye} label="Visibility">
          <InlineTagSelect
            label="Change visibility"
            value={d.visibility}
            options={VISIBILITIES}
            render={(v) => (
              <span
                className={cn(
                  "mono-label inline-flex items-center rounded-md px-2 py-1",
                  v === "external" ? "bg-green-30 text-green-70" : "bg-beige-30 text-beige-60"
                )}
              >
                {v === "external" ? "External" : "Internal"}
              </span>
            )}
            onSelect={(visibility) => patch({ visibility })}
          />
        </PropRow>
        {d.visibility === "external" && (
          <p className="px-2 text-xs text-beige-60">
            Shown on the public /share roadmap — title, summary, timeframe &amp; status only. Notes and
            scores stay internal.
          </p>
        )}
      </div>

      {/* Main — always open: the at-a-glance read */}
      <div className="flex flex-col gap-4 border-t border-beige-20 px-6 py-5">
        <Field label="Summary">
          <TextArea
            value={d.summary}
            onChange={(e) => set("summary", e.target.value)}
            onBlur={saveNow}
            placeholder="One or two lines a stakeholder can grasp quickly."
          />
        </Field>

        {/* The PM case for the initiative — why it matters and how it ranks. */}
        <CollapsibleSection
          label="Rationale & prioritization"
          open={rationaleOpen}
          onToggle={() => setRationaleOpen((o) => !o)}
          hint="Problem, DIVE score, outcome & goal"
        >
          <Field label="Problem">
            <TextArea value={d.problem} onChange={(e) => set("problem", e.target.value)} onBlur={saveNow} />
          </Field>

          <DiveEditor scores={d.scores} onChange={(scores) => patch({ scores })} />

          <Field label="Expected outcome">
            <TextArea
              value={d.expectedOutcome}
              onChange={(e) => set("expectedOutcome", e.target.value)}
              onBlur={saveNow}
            />
          </Field>
          <Field label="Strategic goal">
            <TextInput
              value={d.strategicGoal}
              onChange={(e) => set("strategicGoal", e.target.value)}
              onBlur={saveNow}
              placeholder="Which company goal does this serve?"
            />
          </Field>
        </CollapsibleSection>

        <CollapsibleSection
          label="Links, dependencies & notes"
          open={moreOpen}
          onToggle={() => setMoreOpen((o) => !o)}
          hint="Delivery links, dependencies & internal notes"
        >
          <DeliveryLinksEditor
            links={d.deliveryLinks}
            onChange={(deliveryLinks) => patch({ deliveryLinks })}
          />

          <div>
            <Eyebrow className="mb-2">Depends on</Eyebrow>
            <DependencyPicker
              candidates={initiatives.filter((x) => x.id !== d.id && !x.archived)}
              selected={d.dependsOn}
              onChange={(dependsOn) => patch({ dependsOn })}
              wouldCycle={wouldCycle}
              resolveTitle={(id) => initiatives.find((x) => x.id === id)?.title ?? id}
            />
          </div>

          {!creating && blocks.length > 0 && (
            <div>
              <Eyebrow className="mb-2">Blocks</Eyebrow>
              <ul className="space-y-1">
                {blocks.map((b) => (
                  <li key={b.id}>
                    <button
                      onClick={() => select(b.id)}
                      className="text-left text-sm text-green-70 underline-offset-2 hover:text-green-60 hover:underline"
                    >
                      {b.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Field label="Internal notes" hint="Never shown on the external roadmap.">
            <TextArea value={d.notes} onChange={(e) => set("notes", e.target.value)} onBlur={saveNow} />
          </Field>
        </CollapsibleSection>

        {!creating && (
          <div>
            <Eyebrow className="mb-1.5 flex items-center gap-1.5">
              <Clock size={12} /> Activity
            </Eyebrow>
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-beige-30 bg-beige-5/50 px-3 py-3 text-sm text-beige-60">
              Change history and comments are coming in a later milestone.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-beige-20 bg-white px-6 py-3">
        {creating ? (
          <>
            <Button variant="secondary" onClick={attemptClose}>
              Cancel
            </Button>
            <Button onClick={create} disabled={titleMissing || dateOutOfOrder}>
              Create initiative
            </Button>
          </>
        ) : (
          <>
            {d.archived ? (
              <Button
                variant="ghost"
                onClick={() => {
                  unarchiveInitiative(d.id);
                  notify({ message: `“${d.title}” restored` });
                }}
              >
                <ArchiveRestore size={15} /> Restore
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  archiveInitiative(d.id);
                  notify({
                    message: `“${d.title}” archived`,
                    action: { label: "Undo", onClick: () => unarchiveInitiative(d.id) },
                  });
                }}
              >
                <Archive size={15} /> Archive
              </Button>
            )}
            <span className="ml-auto text-xs text-beige-60">
              Updated {formatDateEN(d.updatedAt.slice(0, 10))}
            </span>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Discard this initiative?"
        body="You haven't created this initiative yet. If you close now, it won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          setConfirmOpen(false);
          closeEditor();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Drawer>
  );
}
