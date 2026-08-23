// ── Supabase data layer for Beakon ──
// Maps between the DB (snake_case rows) and the app's camelCase domain types,
// and holds every read/write against Supabase. The store (lib/store.tsx) calls
// these; the UI never touches Supabase directly.

import { supabase } from "./supabase";
import { normalizeThemeColor } from "./types";
import { normalizeOkrFilters } from "./okrFilters";
import type { OkrFilters } from "./okrFilters";
import { normalizeCollapsedGroupKeys } from "./okrGrouping";
import type {
  BusinessUnit,
  DeliveryLink,
  Initiative,
  Okr,
  OkrInitiativeLink,
  OkrOwner,
  OkrView,
  Owner,
  Roadmap,
  StrategicObjective,
  Status,
  Team,
  Theme,
  TimelineSort,
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
  team_id: string | null;
  theme_id: string | null;
  strategic_objective_id: string | null;
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
    // team_id is nullable at the DB level only transitionally (until the
    // Heron Week 1 backfill runs on a given environment) — every row written
    // by the app going forward always sets a real team, so the "" fallback
    // here mirrors ownerId/themeId's existing not-yet-set convention rather
    // than meaning anything on its own.
    teamId: row.team_id ?? "",
    themeId: row.theme_id ?? "",
    // Nullable and stays that way — unlike team, an unset strategic
    // objective is a real, expected, permanent state (ADR 007 decision 1).
    strategicObjectiveId: row.strategic_objective_id ?? null,
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
    team_id: i.teamId || null,
    theme_id: i.themeId || null,
    strategic_objective_id: i.strategicObjectiveId,
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
  team_id: string | null;
}

function rowToOwner(o: OwnerRow): Owner {
  return {
    id: o.id,
    name: o.name,
    surname: o.surname ?? undefined,
    role: o.role ?? "",
    email: o.email ?? undefined,
    teamId: o.team_id ?? undefined,
  };
}

function ownerToRow(o: Owner) {
  return {
    id: o.id,
    name: o.name,
    surname: o.surname ?? "",
    role: o.role ?? "",
    email: o.email ?? null,
    team_id: o.teamId ?? null,
  };
}

interface RoadmapRow {
  id: string;
  owner_id: string | null;
  name: string;
  view_mode: Roadmap["viewMode"];
  filters: Record<string, unknown> | null;
  group_by: Roadmap["groupBy"];
  zoom: Roadmap["zoom"];
  zoom_scale: number | string;
  density: Roadmap["density"];
  timeline_sort: TimelineSort | null;
  visibility: Roadmap["visibility"];
  editable: boolean;
  is_system: boolean;
  position: number | string;
}

function rowToRoadmap(row: RoadmapRow): Roadmap {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    viewMode: row.view_mode,
    filters: row.filters ?? {},
    groupBy: row.group_by,
    zoom: row.zoom,
    zoomScale: Number(row.zoom_scale),
    density: row.density,
    timelineSort: row.timeline_sort ?? null,
    visibility: row.visibility,
    editable: row.editable,
    isSystem: row.is_system,
    position: Number(row.position),
  };
}

/**
 * DB row for insert/update. `is_system`/`created_at`/`updated_at` are
 * omitted — `is_system` is never set by the app (the one System row is
 * seed-only) and `updated_at` is trigger-maintained.
 */
function roadmapToRow(r: Roadmap) {
  return {
    id: r.id,
    owner_id: r.ownerId,
    name: r.name,
    view_mode: r.viewMode,
    filters: r.filters,
    group_by: r.groupBy,
    zoom: r.zoom,
    zoom_scale: r.zoomScale,
    density: r.density,
    timeline_sort: r.timelineSort,
    visibility: r.visibility,
    editable: r.editable,
    position: r.position ?? 0,
  };
}

interface OkrViewRow {
  id: string;
  owner_id: string;
  name: string;
  filters: OkrFilters;
  visibility: OkrView["visibility"];
  editable: boolean;
  position: number | string;
  collapsed_group_keys: string[];
}

function rowToOkrView(row: OkrViewRow): OkrView {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    filters: normalizeOkrFilters(row.filters),
    visibility: row.visibility,
    editable: row.editable,
    position: Number(row.position),
    collapsedGroupKeys: normalizeCollapsedGroupKeys(row.collapsed_group_keys ?? []),
  };
}

/**
 * DB row for insert/update. `created_at`/`updated_at` are omitted —
 * `updated_at` is trigger-maintained (`okr_views_touch_updated_at`).
 */
function okrViewToRow(v: OkrView) {
  return {
    id: v.id,
    owner_id: v.ownerId,
    name: v.name,
    filters: v.filters,
    visibility: v.visibility,
    editable: v.editable,
    position: v.position ?? 0,
    collapsed_group_keys: v.collapsedGroupKeys,
  };
}

export interface Workspace {
  initiatives: Initiative[];
  themes: Theme[];
  owners: Owner[];
  /**
   * Moved here from OkrWorkspace/fetchOkrWorkspace() by Sprint Heron Week 1
   * (ADR 007 decision 3): once Initiative/Owner depend on `teams` for every
   * list/filter/settings render (and Initiative depends on
   * `strategic_objectives` for its optional objective display), these three
   * reference tables have to be available wherever Initiative/Owner are —
   * which today means eagerly, on every app open. `okrs`/`okr_owners`/
   * `okr_initiatives` stay lazy in OkrWorkspace — OKR-specific write data is
   * still only needed on `/okrs`.
   */
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
  /**
   * Small, always-needed metadata (Sprint Heron Week 2), same reasoning as
   * teams/businessUnits/strategicObjectives above — every nav render needs
   * to know which Roadmaps exist (at minimum the System row) to resolve
   * `activeRoadmap`, so this is eager rather than lazy.
   */
  roadmaps: Roadmap[];
  /**
   * Saved/shareable "My OKRs" filter views (Sprint Heron Week 3, ADR 009).
   * Fetched eagerly alongside `roadmaps`, not lazily via OkrWorkspace —
   * despite being conceptually "about OKRs," this is sidebar-shaped data
   * (the "My views" nav section needs the list on every render), the same
   * classification call that already put `roadmaps` in this eager bucket.
   */
  okrViews: OkrView[];
}

// ── Reads ──

/** Load the full authenticated workspace (all initiatives incl. archived). */
export async function fetchWorkspace(): Promise<Workspace> {
  const sb = client();
  const [iniRes, linkRes, themeRes, ownerRes, buRes, teamRes, soRes, roadmapRes, okrViewRes] =
    await Promise.all([
      sb.from("initiatives").select("*").order("position", { ascending: true }),
      sb.from("delivery_links").select("*").order("position", { ascending: true }),
      sb.from("themes").select("*"),
      sb.from("owners").select("*"),
      sb.from("business_units").select("*"),
      sb.from("teams").select("*"),
      sb.from("strategic_objectives").select("*"),
      sb.from("roadmaps").select("*").order("position", { ascending: true }),
      sb.from("okr_views").select("*").order("position", { ascending: true }),
    ]);
  for (const r of [iniRes, linkRes, themeRes, ownerRes, buRes, teamRes, soRes, roadmapRes, okrViewRes]) {
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
  const businessUnits = ((buRes.data ?? []) as BusinessUnitRow[]).map(rowToBusinessUnit);
  const teams = ((teamRes.data ?? []) as TeamRow[]).map(rowToTeam);
  const strategicObjectives = ((soRes.data ?? []) as StrategicObjectiveRow[]).map(rowToStrategicObjective);
  const roadmaps = ((roadmapRes.data ?? []) as RoadmapRow[]).map(rowToRoadmap);
  const okrViews = ((okrViewRes.data ?? []) as OkrViewRow[]).map(rowToOkrView);

  return { initiatives, themes, owners, teams, businessUnits, strategicObjectives, roadmaps, okrViews };
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
  okrs: Okr[];
  okrOwners: OkrOwner[];
  okrInitiatives: OkrInitiativeLink[];
}

/**
 * Load the OKR-specific workspace (OKRs, ownership, initiative links). Kept
 * separate from fetchWorkspace() — that one loads on every app open today
 * and this is lazily called, only on `/okrs`.
 *
 * `businessUnits`/`teams`/`strategicObjectives` used to live here too, but
 * Sprint Heron Week 1 moved them into fetchWorkspace()/Workspace instead
 * (ADR 007 decision 3) — Initiative/Owner now depend on `teams` (and
 * Initiative on `strategic_objectives`) for every list/filter/settings
 * render, so these three reference tables have to be eagerly available
 * wherever Initiative/Owner are, not just on `/okrs`. Callers here should
 * read them from useRoadmap() instead.
 */
export async function fetchOkrWorkspace(): Promise<OkrWorkspace> {
  const sb = client();
  const [okrRes, ownerRes, initRes] = await Promise.all([
    sb.from("okrs").select("*").order("position", { ascending: true }),
    sb.from("okr_owners").select("*"),
    sb.from("okr_initiatives").select("*"),
  ]);
  for (const r of [okrRes, ownerRes, initRes]) {
    if (r.error) throw r.error;
  }

  const okrs = ((okrRes.data ?? []) as OkrRow[]).map(rowToOkr);
  const okrOwners = ((ownerRes.data ?? []) as OkrOwnerRow[]).map(rowToOkrOwner);
  const okrInitiatives = ((initRes.data ?? []) as OkrInitiativeRow[]).map((r) => ({
    okrId: r.okr_id,
    initiativeId: r.initiative_id,
  }));

  return { okrs, okrOwners, okrInitiatives };
}

/**
 * Upsert an OKR and fully replace its owners and initiative links.
 *
 * Delegates to the `persist_okr` Postgres RPC (supabase/schema.sql,
 * supabase/migrations/2026-08-persist-okr-rpc.sql) instead of four
 * separate upsert/delete/insert calls: Supabase's JS client can't span
 * multiple `.from()` calls in one client-side transaction, so a failure
 * partway through the old sequence (e.g. a duplicate (okr_id, owner_id)
 * insert) could leave the OKR with zero owners/links in the DB. The RPC's
 * plpgsql body is one transaction — any error rolls back everything.
 */
export async function persistOkr(o: Okr, owners: OkrOwner[], initiativeIds: string[]): Promise<void> {
  const sb = client();
  const row = okrToRow(o);

  const { error } = await sb.rpc("persist_okr", {
    p_id: row.id,
    p_title: row.title,
    p_strategic_objective_id: row.strategic_objective_id,
    p_team_id: row.team_id,
    p_business_unit_id: row.business_unit_id,
    p_year: row.year,
    p_quarter: row.quarter,
    p_deliverable_detail: row.deliverable_detail,
    p_governance_status: row.governance_status,
    p_okr_class: row.okr_class,
    p_target_date: row.target_date,
    p_achievement: row.achievement,
    p_health: row.health,
    p_notes: row.notes,
    p_carried_from_id: row.carried_from_id,
    p_archived: row.archived,
    p_position: row.position,
    p_owners: owners.map(okrOwnerToRow),
    p_initiative_ids: initiativeIds,
  });
  if (error) throw error;
}

// ── Roadmaps (Sprint Heron Week 2) — unified List/Board/Timeline saved view ──

/**
 * Upsert a Roadmap via the `persist_roadmap` RPC (supabase/schema.sql,
 * supabase/migrations/2026-08-persist-roadmap-rpc.sql) — mirrors
 * persistOkr()'s delegation to a Postgres function. The authorization
 * logic (owner full-write / shared-editable filtered-write / System-row
 * refusal / unauthorized-caller exception) is real conditional logic that
 * plain RLS can't express as a single `using`/`with check` boolean, so
 * there's deliberately no UPDATE policy on `roadmaps` at all — see ADR 008
 * decision 1. Note the RPC may silently ignore some of the fields sent
 * here (e.g. a shared-editable caller's `name`/`visibility` are pinned to
 * their current DB values) — that's a documented, deliberate choice in the
 * function itself, not a bug in this call site.
 */
export async function persistRoadmap(r: Roadmap): Promise<void> {
  const sb = client();
  const row = roadmapToRow(r);

  const { error } = await sb.rpc("persist_roadmap", {
    p_id: row.id,
    p_owner_id: row.owner_id,
    p_name: row.name,
    p_view_mode: row.view_mode,
    p_filters: row.filters,
    p_group_by: row.group_by,
    p_zoom: row.zoom,
    p_zoom_scale: row.zoom_scale,
    p_density: row.density,
    p_timeline_sort: row.timeline_sort,
    p_visibility: row.visibility,
    p_editable: row.editable,
    p_position: row.position,
  });
  if (error) throw error;
}

/**
 * Delete a Roadmap. No RPC needed here (unlike persistRoadmap) — the
 * `roadmaps` table's plain `DELETE` RLS policy (owner-only, never on
 * `is_system` rows) is a single boolean check, exactly the case ADR 008
 * decision 1 says plain RLS is fine for; only the write-side authorization
 * (owner vs. shared-editable vs. system) needed the RPC's conditional logic.
 */
export async function deleteRoadmap(id: string): Promise<void> {
  const sb = client();
  const { error } = await sb.from("roadmaps").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Upsert an OkrView through `persist_okr_view()` — mirrors `persistRoadmap`
 * exactly, minus the fields OkrView doesn't have (viewMode/groupBy/zoom/
 * density/timelineSort). See supabase/migrations/2026-08-persist-okr-view-
 * rpc.sql for the RPC's full authorization shape: owner gets a full write;
 * a shared+editable non-owner's write is silently narrowed to name/filters
 * only, with owner_id/visibility/editable/position pinned to their current
 * DB values regardless of what's sent here — that's a documented,
 * deliberate choice in the function itself, not a bug in this call site.
 */
export async function persistOkrView(v: OkrView): Promise<void> {
  const sb = client();
  const row = okrViewToRow(v);

  const { error } = await sb.rpc("persist_okr_view", {
    p_id: row.id,
    p_owner_id: row.owner_id,
    p_name: row.name,
    p_filters: row.filters,
    p_visibility: row.visibility,
    p_editable: row.editable,
    p_position: row.position,
    p_collapsed_group_keys: row.collapsed_group_keys,
  });
  if (error) throw error;
}

/**
 * Delete an OkrView. No RPC needed here (unlike persistOkrView) — the
 * `okr_views` table's plain `DELETE` RLS policy (owner-only) is a single
 * boolean check, exactly the case ADR 008 decision 1 (and ADR 009, for this
 * entity) says plain RLS is fine for; only the write-side authorization
 * (owner vs. shared-editable) needed the RPC's conditional logic.
 */
export async function deleteOkrView(id: string): Promise<void> {
  const sb = client();
  const { error } = await sb.from("okr_views").delete().eq("id", id);
  if (error) throw error;
}
