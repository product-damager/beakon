# Beakon — Requests A & B (post-Kestrel feature briefs)

**Source:** colleague feedback after the internal demo, 2026-08-03.
**Status:** scoping / pre-build. Nothing here is committed to a sprint yet.

These two requests are, almost exactly, **the two halves of Productboard**: Request A is the
*Roadmaps / Views* half; Request B is the *Portal / Insights* half. They differ enormously in
risk, which drives the sequence below.

## Where they sit on the roadmap

| When | Work | Why here |
|---|---|---|
| Now (**Merlin** sprint) | Finish the internal-flow triage: **P3** quick Health/Status on drawer + unify edit feedback · **P4** searchable dependency picker + cycle guard · **P7b** create-form progressive-disclosure restructure | Pay down the flow debt while it's cheap, before adding new surface area. (P2 Archived-view already shipped in Kestrel.) |
| +1 | **Request A — Saved Timelines** | Highest-leverage new ask, stays inside the existing trust boundary, completes the original spec's promised "saved views" |
| +2 → +3 | **P1** change history / attribution, then **Request B** full portal loop | B crosses the external trust boundary deliberately; P1 is the substrate its triage inbox needs |
| Later | P5 timeline conflicts · P6 accessibility | Unchanged from the triage |

**Why A before B:** Request A introduces Beakon's *first per-user-owned, shareable object*.
That ownership + private/shared plumbing is exactly what B's client portal (and any future
"saved external roadmap") reuses. A shared-open Timeline is also the internal rehearsal of a
curated external roadmap — the surface B's voting/ideas attach to.

---

## Request A — Saved Timelines (personal & shared views)

> "Create and have their own Timelines (roadmaps), like in Productboard, with locked
> filters/sortings preserved on reload and next session. For now just closed/open so others can
> see or not; if open, everyone can edit."

### Product value
- The colleagues' **#1 ask** — it's what makes the tool feel like *theirs*, not one shared board.
- Fixes a real papercut hiding in the request: **no view state persists today.** Filters, sort,
  grouping, zoom and density all live in React `useState` in `lib/store.tsx` and reset on every
  reload. Persisting even the *current* view is an immediate win.
- Completes the original spec's **"saved views"** (Leadership / Product weekly / Engineering sync /
  External draft) — listed in Milestone 2 but never built.
- Lets each stakeholder audience get its own pre-framed roadmap without rebuilding filters each time.

### Scope
- **A0 · Persist the current view (quick win, ~S).** Serialize the store's view-state
  (`filters`, `groupBy`, `zoom`, `zoomScale`, `density`, `timelineSort`, active view kind) to
  `localStorage` per user and rehydrate on load. Kills the reload-reset papercut with no backend.
- **A1 · Named Views (the feature, ~M).** A *View* = a saved snapshot of that same view-state plus
  metadata (name, owner, visibility, view kind). Switcher in the app shell; Save / Save as /
  Rename / Delete; visibility toggle; auto-restore the user's last-open view.
- **A2 · Sharing.** `private` (owner only) / `shared` (all teammates can see). Editability of a
  shared view is an open question — see decisions.

### Technical notes
- All state a View needs is **already centralized** in `lib/store.tsx` — clean to serialize into a
  `config` JSON. "Applying" a view = calling the existing setters (`setFilters`, `setGroupBy`,
  `setZoom`, `setZoomScale`, `setDensity`, `setTimelineSort`) from `config`.
- New table `views`: `id, owner_id (→ owners.id), name, view_kind (timeline|board|list),
  config jsonb, visibility (private|shared), created_at, updated_at`.
- RLS: owner full CRUD on their rows; `shared` → all `authenticated` can SELECT; write policy on
  shared rows depends on the editability decision. This is the **first per-user-scoped RLS** in the
  app (today: `authenticated` = full access to everything, one shared dataset).
- Store gets a `views` slice (list, `activeViewId`, load/apply/save/rename/delete); persistence
  mirrors the existing `persist*` pattern in `lib/data.ts`.
- Stays **entirely inside the existing auth trust boundary** (magic-link, `@kameleoon.com`). No
  external exposure, no schema risk beyond one additive table. Low risk.

### Decisions / open questions
1. **Shared-view editability.** The request says "if open, everyone can edit." Productboard's actual
   default is *shared = others view only; duplicate to make your own*. Everyone-edits invites
   someone reordering your "Leadership" view an hour before a readout. **Recommendation:** shared =
   view-only + "Duplicate", add explicit editors later. Same build cost, avoids surprise edits.
2. **What a View captures.** Filters + sort + grouping + zoom + density + view kind — yes. Also
   pin *presentation mode*? **Recommendation:** no (presentation is a momentary toggle).
3. **Last-view auto-restore** per user vs. always opening a fixed default. **Recommendation:**
   restore last-open view.
4. **Seed the four spec views** (Leadership / Product weekly / Eng sync / External draft) as shared
   defaults, or start empty? 
5. **Owner key** = existing `owners.id` (already matched by email) — reuse, don't introduce a
   parallel identity.

---

## Request B — Customer Portal (voting + ideas + triage inbox)

> "An ability for clients to vote for certain initiatives, or send ideas. Then attach ideas to the
> initiatives." — confirmed scope: the **full loop** (voting + ideas + internal triage).

### Product value
- Brings a **client-driven prioritization signal** and idea intake directly into the roadmap.
- Closes the loop the DIVE model only estimates internally — real demand from real accounts.
- **Strategic note:** this is the biggest move in the backlog. It crosses Beakon from an *internal
  roadmap tool* into a *customer-facing feedback product* — explicitly a **v1 non-goal** ("full
  idea management platform", "full customer feedback repository"). Worth doing consciously, not by
  drift.

### Scope (three sub-features)
- **B1 · Voting.** Clients upvote initiatives surfaced on the public roadmap. One vote per client
  per initiative.
- **B2 · Ideas.** Clients submit ideas (title + description, optional contact).
- **B3 · Triage inbox.** Internal view to review incoming ideas → attach to an initiative /
  convert to a new initiative / merge duplicates / dismiss. Vote tallies visible internally on
  each initiative.

### Technical notes
- **Trust-boundary expansion (the crux).** Clients are not `@kameleoon.com`. Today `anon` has
  **zero write access** — RLS is `authenticated`-only, and `anon` can read only the
  `external_roadmap` view plus themes/owners for labels (`supabase/schema.sql`). B requires scoped
  `anon` (or a new external role) **writes**, which is a deliberate security change.
- The **`enforce_company_domain` trigger** blocks any non-`@kameleoon.com` signup. A client portal
  needs an explicit carve-out or a separate auth surface — this trigger will otherwise reject
  every client.
- New tables: `ideas` (`id, title, body, submitter, status, initiative_id nullable, created_at`)
  and `votes` (`id, initiative_id, voter, created_at`, `unique(initiative_id, voter)` for dedup).
- **Client identity options:** (a) fully anonymous + dedup/rate-limit by hash — weak, spam-prone,
  and we can't gate with CAPTCHA; (b) email-capture + magic-link "customer portal" (Supabase auth
  without the domain lock); (c) email-gate on the existing `/share` page. **Recommendation:** (b) —
  real signal and abuse resistance.
- **Depends on P1** (change history / attribution): the triage inbox needs to record who submitted,
  status transitions, and attach events. Building P1 first makes B3 nearly free.
- Anti-abuse: unique vote per identity + rate limiting (no CAPTCHA, by policy) — so identity
  choice matters more than usual.
- **Effort: L**, spanning 1–2 sprints. Sequence: P1 → B1/B2 (portal + capture) → B3 (inbox).

### Decisions / open questions
1. **Client identity model** — (a) anonymous / (b) magic-link portal / (c) email-gate on `/share`.
   **Recommendation:** (b).
2. **Vote visibility** — internal-only tallies, or public counts on `/share`? Public counts create
   bandwagon effects and expose relative priority to clients.
3. **Intake surface** — extend `/share`, or a new `/portal`? Public board vs. per-customer private?
4. **Moderation** — are submitted ideas public immediately, or held for internal triage first?
   **Recommendation:** held; nothing public until a PM promotes it.
5. **"Attach" depth** — link idea → initiative only, or also convert-to-initiative and
   merge-duplicates?
6. **PII / GDPR** — storing client emails and free-text ideas: retention, consent, and where it
   lives relative to internal data.

---

## Open cross-cutting question
Both A (shared views) and B (client portal) introduce **per-actor ownership and a sharing/visibility
model**. Worth designing that model once, in A, so B inherits it rather than reinventing it.
