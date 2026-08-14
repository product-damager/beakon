// ── Supabase data layer for Beakon ──
// Maps between the DB (snake_case rows) and the app's camelCase domain types,
// and holds every read/write against Supabase. The store (lib/store.tsx) calls
// these; the UI never touches Supabase directly.

import { supabase } from "./supabase";
import { normalizeThemeColor } from "./types";
import type {
  BusinessUnit,
  DeliveryLink,
  Initiative,
  Okr,
  OkrInitiativeLink,
  OkrOwner,
  Owner,
  StrategicObjective,
  Status,
  Team,
  Theme,
} from "./types";

function client() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

// ── Row shapes (as returned by PostgREST) ──
interface InitiativeRow {
  id: string;
  title: string;
  summary: string | null;
  problem: string | null;
  expected_outcome: string | null;
  status: Status;
  owner_id: string | null;
  team: string;
  theme_id: string | null;
  strategic_goal: string | null;
  demand: number | string | null;
  impact: number | string | null;
  viability: number | string | null;
  effort: number | string | null;
  health: Initiative["health"];
  target_start: string;
  target_end: string;
  depends_on: string[] | null;
  visibility: Initiative["visibility"];
  notes: string | null;
  archived: boolean;
  position: number | string;
  updated_at: string;
}

interface DeliveryLinkRow {
  id: string;
  initiative_id: string;
  label: string;
  url: string;
  type: DeliveryLink["type"];
  position: number | string;
}

// ── Mappers ──
function rowToInitiative(row: InitiativeRow, links: DeliveryLink[]): Initiative {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? "",
    problem: row.problem ?? "",
    expectedOutcome: row.expected_outcome ?? "",
    status: row.status,
    ownerId: row.owner_id ?? "",
    team: row.team,
    themeId: row.theme_id ?? "",
    strategicGoal: row.strategic_goal ?? "",
    // Any NULL score column means the initiative was saved unscored.
    scores:
      row.demand == null || row.impact == null || row.viability == null || row.effort == null
        ? null
        : {
            demand: Number(row.demand),
            impact: Number(row.impact),
            viability: Number(row.viability),
            effort: Number(row.effort),
          },
    health: row.health,
    targetStart: row.target_start,
    targetEnd: row.target_end,
    deliveryLinks: links,
    dependsOn: row.depends_on ?? [],
    visibility: row.visibility,
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
    archived: row.archived,
    position: Number(row.position),
  };
}

/** DB row for insert/update. `updated_at` is omitted — a trigger maintains it. */
function initiativeToRow(i: Initiative) {
  return {
    id: i.id,
    title: i.title,
    summary: i.summary,
    problem: i.problem,
    expected_outcome: i.expectedOutcome,
    status: i.status,
    owner_id: i.ownerId || null,
    team: i.team,
    theme_id: i.themeId || null,
    strategic_goal: i.strategicGoal,
    demand: i.scores?.demand ?? null,
    impact: i.scores?.impact ?? null,
    viability: i.scores?.viability ?? null,
    effort: i.scores?.effort ?? null,
    health: i.health,
    target_start: i.targetStart,
    target_end: i.targetEnd,
    depends_on: i.dependsOn,
    visibility: i.visibility,
    notes: i.notes,
    archived: i.archived,
    position: i.position ?? 0,
  };
}

function rowToTheme(t: { id: string; name: string; description: string | null; color: string }): Theme {
  return { id: t.id, name: t.name, description: t.description ?? "", color: normalizeThemeColor(t.color) };
}

interface OwnerRow {
  id: string;
  name: string;
  surname: string | null;
  role: string | null;
  email: string | null;
  team: string | null;
}

function rowToOwner(o: OwnerRow): Owner {
  return {
    id: o.id,
    name: o.name,
    surname: o.surname ?? undefined,
    role: o.role ?? "",
    email: o.email ?? undefined,
    team: o.team ?? undefined,
  };
}

function ownerToRow(o: Owner) {
  return {
    id: o.id,
    name: o.name,
    surname: o.surname ?? "",
    role: o.role ?? "",
    email: o.email ?? null,
    team: o.team ?? null,
  };
}

export interface Workspace {
  initiatives: Initiative[];
  themes: Theme[];
  owners: Owner[];
}

// ── Reads ──

/** Load the full authenticated workspace (all initiatives incl. archived). */
export async function fetchWorkspace(): Promise<Workspace> {
  const sb = client();
  const [iniRes, linkRes, themeRes, ownerRes] = await Promise.all([
    sb.from("initiatives").select("*").order("position", { ascending: true }),
    sb.from("delivery_links").select("*").order("position", { ascending: true }),
    sb.from("themes").select("*"),
    sb.from("owners").select("*"),
  ]);
  for (const r of [iniRes, linkRes, themeRes, ownerRes]) {
    if (r.error) throw r.error;
  }

  const linksByInitiative = new Map<string, DeliveryLink[]>();
  for (const l of (linkRes.data ?? []) as DeliveryLinkRow[]) {
    const list = linksByInitiative.get(l.initiative_id) ?? [];
    list.push({ id: l.id, label: l.label, url: l.url, type: l.type });
    linksByInitiative.set(l.initiative_id, list);
  }

  const initiatives = ((iniRes.data ?? []) as InitiativeRow[]).map((row) =>
    rowToInitiative(row, linksByInitiative.get(row.id) ?? [])
  );
  const themes = (themeRes.data ?? []).map(rowToTheme);
  const owners = ((ownerRes.data ?? []) as OwnerRow[]).map(rowToOwner);

  return { initiatives, themes, owners };
}

// ── Writes ──

/** Upsert an initiative and fully replace its delivery links. */
export async function persistInitiative(i: Initiative): Promise<void> {
  const sb = client();

  const { error: upsertErr } = await sb.from("initiatives").upsert(initiativeToRow(i));
  if (upsertErr) throw upsertErr;

  // Replace links: simplest correct sync for a handful of rows per initiative.
  const { error: delErr } = await sb.from("delivery_links").delete().eq("initiative_id", i.id);
  if (delErr) throw delErr;

  if (i.deliveryLinks.length > 0) {
    const rows = i.deliveryLinks.map((l, idx) => ({
      id: l.id,
      initiative_id: i.id,
      label: l.label,
      url: l.url,
      type: l.type,
      position: idx,
    }));
    const { error: insErr } = await sb.from("delivery_links").insert(rows);
    if (insErr) throw insErr;
  }
}

/** Persist a board move: new status + fractional sort position. */
export async function persistMove(id: string, status: Status, position: number): Promise<void> {
  const sb = client();
  const { error } = await sb.from("initiatives").update({ status, position }).eq("id", id);
  if (error) throw error;
}

/**
 * Persist a timeline reschedule: just the target dates. A targeted update (like
 * persistMove) — never touches delivery links, so a date drag can't fail on the
 * link-replacement step. `updated_at` is trigger-maintained.
 */
export async function persistSchedule(
  id: string,
  targetStart: string,
  targetEnd: string
): Promise<void> {
  const sb = client();
  const { error } = await sb
    .from("initiatives")
    .update({ target_start: targetStart, target_end: targetEnd })
    .eq("id", id);
  if (error) throw error;
}

/** Soft-delete: archive an initiative. */
export async function persistArchive(id: string): Promise<void> {
  const sb = client();
  const { error } = await sb.from("initiatives").update({ archived: true }).eq("id", id);
  if (error) throw error;
}

/** Restore a soft-deleted initiative (the Undo of persistArchive). */
export async function persistUnarchive(id: string): Promise<void> {
  const sb = client();
  const { error } = await sb.from("initiatives").update({ archived: false }).eq("id", id);
  if (error) throw error;
}

/** Upsert an owner profile (name/surname/team edited from settings). */
export async function persistOwner(o: Owner): Promise<void> {
  const sb = client();
  const { error } = await sb.from("owners").upsert(ownerToRow(o));
  if (error) throw error;
}

/** Insert a new theme (id generated client-side). */
export async function createTheme(t: Theme): Promise<void> {
  const sb = client();
  const { error } = await sb.from("themes").insert({
    id: t.id,
    name: t.name,
    description: t.description,
    color: t.color,
  });
  if (error) throw error;
}

// ── Public share page ──

/** Minimal, safe projection used by the external roadmap (no notes/scores/owners). */
export interface PublicInitiative {
  id: string;
  title: string;
  status: Status;
  themeId: string;
  targetStart: string;
  targetEnd: string;
}

export interface PublicRoadmap {
  items: PublicInitiative[];
  themes: Theme[];
}

/** Read the anon-accessible external_roadmap view + themes for the public page. */
export async function fetchExternalRoadmap(): Promise<PublicRoadmap> {
  const sb = client();
  const [itemsRes, themeRes] = await Promise.all([
    sb.from("external_roadmap").select("*"), // view is ordered by position
    sb.from("themes").select("*"),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (themeRes.error) throw themeRes.error;

  const items: PublicInitiative[] = (itemsRes.data ?? []).map(
    (r: { id: string; title: string; status: Status; theme_id: string; target_start: string; target_end: string }) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      themeId: r.theme_id,
      targetStart: r.target_start,
      targetEnd: r.target_end,
    })
  );
  const themes = (themeRes.data ?? []).map(rowToTheme);
  return { items, themes };
}

// ── OKRs (Sprint Grackle) — Phase 1: schema & data-access only, no UI yet ──

interface BusinessUnitRow {
  id: string;
  name: string;
}

interface TeamRow {
  id: string;
  name: string;
  business_unit_id: string;
}

interface StrategicObjectiveRow {
  id: string;
  name: string;
  description: string | null;
  year: number;
  sponsor_id: string | null;
}

interface OkrRow {
  id: string;
  title: string;
  strategic_objective_id: string;
  team_id: string | null;
  business_unit_id: string | null;
  year: number;
  quarter: number;
  deliverable_detail: string | null;
  governance_status: Okr["governanceStatus"];
  okr_class: Okr["okrClass"];
  target_date: string | null;
  achievement: number | string | null;
  health: Okr["health"];
  notes: string | null;
  carried_from_id: string | null;
  archived: boolean;
  position: number | string;
  updated_at: string;
}

interface OkrOwnerRow {
  okr_id: string;
  owner_id: string;
  role: string;
}

interface OkrInitiativeRow {
  okr_id: string;
  initiative_id: string;
}

function rowToBusinessUnit(row: BusinessUnitRow): BusinessUnit {
  return { id: row.id, name: row.name };
}

function rowToTeam(row: TeamRow): Team {
  return { id: row.id, name: row.name, businessUnitId: row.business_unit_id };
}

function rowToStrategicObjective(row: StrategicObjectiveRow): StrategicObjective {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    year: Number(row.year),
    sponsorId: row.sponsor_id ?? undefined,
  };
}

/** Any NULL score column means the OKR hasn't been assessed yet — null stays null, never 0. */
function rowToOkr(row: OkrRow): Okr {
  return {
    id: row.id,
    title: row.title,
    strategicObjectiveId: row.strategic_objective_id,
    teamId: row.team_id ?? undefined,
    businessUnitId: row.business_unit_id ?? undefined,
    year: Number(row.year),
    quarter: Number(row.quarter),
    deliverableDetail: row.deliverable_detail ?? "",
    governanceStatus: row.governance_status,
    okrClass: row.okr_class,
    targetDate: row.target_date ?? undefined,
    achievement: row.achievement == null ? null : Number(row.achievement),
    health: row.health,
    notes: row.notes ?? "",
    carriedFromId: row.carried_from_id ?? undefined,
    archived: row.archived,
    position: Number(row.position),
    updatedAt: row.updated_at,
  };
}

/** DB row for insert/update. `updated_at` is omitted — a trigger maintains it. */
function okrToRow(o: Okr) {
  return {
    id: o.id,
    title: o.title,
    strategic_objective_id: o.strategicObjectiveId,
    team_id: o.teamId || null,
    business_unit_id: o.businessUnitId || null,
    year: o.year,
    quarter: o.quarter,
    deliverable_detail: o.deliverableDetail,
    governance_status: o.governanceStatus,
    okr_class: o.okrClass,
    target_date: o.targetDate || null,
    achievement: o.achievement,
    health: o.health,
    notes: o.notes,
    carried_from_id: o.carriedFromId || null,
    archived: o.archived,
    position: o.position ?? 0,
  };
}

function rowToOkrOwner(row: OkrOwnerRow): OkrOwner {
  return { okrId: row.okr_id, ownerId: row.owner_id, role: row.role };
}

function okrOwnerToRow(o: OkrOwner) {
  return { okr_id: o.okrId, owner_id: o.ownerId, role: o.role };
}

export interface OkrWorkspace {
  businessUnits: BusinessUnit[];
  teams: Team[];
  strategicObjectives: StrategicObjective[];
  okrs: Okr[];
  okrOwners: OkrOwner[];
  okrInitiatives: OkrInitiativeLink[];
}

/**
 * Load the OKR workspace (business units, teams, strategic objectives, OKRs,
 * ownership, initiative links). Kept separate from fetchWorkspace() — that one
 * loads on every app open today and is initiative-only; this is lazily called.
 */
export async function fetchOkrWorkspace(): Promise<OkrWorkspace> {
  const sb = client();
  const [buRes, teamRes, soRes, okrRes, ownerRes, initRes] = await Promise.all([
    sb.from("business_units").select("*"),
    sb.from("teams").select("*"),
    sb.from("strategic_objectives").select("*"),
    sb.from("okrs").select("*").order("position", { ascending: true }),
    sb.from("okr_owners").select("*"),
    sb.from("okr_initiatives").select("*"),
  ]);
  for (const r of [buRes, teamRes, soRes, okrRes, ownerRes, initRes]) {
    if (r.error) throw r.error;
  }

  const businessUnits = ((buRes.data ?? []) as BusinessUnitRow[]).map(rowToBusinessUnit);
  const teams = ((teamRes.data ?? []) as TeamRow[]).map(rowToTeam);
  const strategicObjectives = ((soRes.data ?? []) as StrategicObjectiveRow[]).map(rowToStrategicObjective);
  const okrs = ((okrRes.data ?? []) as OkrRow[]).map(rowToOkr);
  const okrOwners = ((ownerRes.data ?? []) as OkrOwnerRow[]).map(rowToOkrOwner);
  const okrInitiatives = ((initRes.data ?? []) as OkrInitiativeRow[]).map((r) => ({
    okrId: r.okr_id,
    initiativeId: r.initiative_id,
  }));

  return { businessUnits, teams, strategicObjectives, okrs, okrOwners, okrInitiatives };
}

/** Upsert an OKR and fully replace its owners and initiative links. */
export async function persistOkr(o: Okr, owners: OkrOwner[], initiativeIds: string[]): Promise<void> {
  const sb = client();

  const { error: upsertErr } = await sb.from("okrs").upsert(okrToRow(o));
  if (upsertErr) throw upsertErr;

  const { error: delOwnersErr } = await sb.from("okr_owners").delete().eq("okr_id", o.id);
  if (delOwnersErr) throw delOwnersErr;
  if (owners.length > 0) {
    const { error: insOwnersErr } = await sb.from("okr_owners").insert(owners.map(okrOwnerToRow));
    if (insOwnersErr) throw insOwnersErr;
  }

  const { error: delInitErr } = await sb.from("okr_initiatives").delete().eq("okr_id", o.id);
  if (delInitErr) throw delInitErr;
  if (initiativeIds.length > 0) {
    const rows = initiativeIds.map((initiativeId) => ({ okr_id: o.id, initiative_id: initiativeId }));
    const { error: insInitErr } = await sb.from("okr_initiatives").insert(rows);
    if (insInitErr) throw insInitErr;
  }
}
