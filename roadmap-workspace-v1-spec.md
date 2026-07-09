# Roadmap Workspace v1 Product Spec

## Product summary

Roadmap Workspace is a lightweight internal roadmap application for a product team. It is designed for internal planning first, with a controlled path to share selected roadmap items externally later.

The product should be built as a web app that feels closer to a real product tool than a spreadsheet or slide deck. The first version should prioritize clarity, speed, and trust over breadth.

## Problem

Product teams often manage roadmap communication across slides, docs, Jira, Notion, and spreadsheets. This creates duplicate updates, inconsistent views for different audiences, and no clean way to expose a curated external roadmap.

The main problem to solve in v1 is to create one canonical roadmap workspace with multiple audience-specific views, especially a strong timeline view.

## Goals

- Create one source of truth for roadmap initiatives.
- Support internal product planning and review.
- Make roadmap communication easy for leadership, engineering, and product.
- Allow selective external sharing later without rebuilding the product.
- Include a strong timeline view as a core experience.

## Non-goals

- Full idea management platform.
- Full customer feedback repository.
- Advanced portfolio planning across dozens of business units.
- Deep analytics or forecasting.
- Complex workflow automation in v1.

## Target users

### Primary users

- Product managers.
- Head of product or product leadership.
- Engineering managers.
- Design leads or cross-functional stakeholders.

### Secondary users

- Executives who need a quick roadmap snapshot.
- External viewers who may later see a curated public or partner-facing roadmap.

## Core use cases

1. A product manager creates and updates roadmap initiatives.
2. The product team reviews initiatives by quarter, theme, owner, and status.
3. Leadership reviews a clean timeline of what is planned and in progress.
4. Engineering checks linked delivery references for each initiative.
5. The team marks selected items as externally shareable for a future lightweight external view.

## Product principles

- Default to clarity over flexibility.
- Timeline is a first-class view, not an afterthought.
- Internal and external visibility must be built into the data model.
- Data entry should be lightweight.
- Views should feel presentation-ready without export work.

## Information architecture

### Main entities

#### Initiative

The primary roadmap object.

Fields:
- id
- title
- summary
- problem
- expected outcome
- status
- owner
- team
- theme
- strategic goal
- priority score
- confidence
- target start date
- target end date
- target quarter
- delivery links
- dependencies
- visibility (internal or external)
- last updated at
- notes

#### Theme

Used to group initiatives at a higher level.

Fields:
- id
- name
- description
- color token

#### Delivery link

Reference to execution systems.

Fields:
- id
- initiative id
- label
- url
- type (Jira, Linear, spec, doc, other)

## Core views

### 1. Timeline view

This is mandatory and should be treated as the signature view in v1.

Purpose:
- Show initiatives across time in a way that is understandable in less than one minute.
- Support roadmap communication with leadership and cross-functional stakeholders.
- Serve as the strongest candidate for eventual external sharing.

Requirements:
- Display initiatives as bars across a time axis.
- Support grouping by theme, team, or owner.
- Allow zoom levels: month, quarter, half-year.
- Visually distinguish statuses such as planned, in progress, at risk, done.
- Show dependencies optionally.
- Allow filtering by visibility, owner, team, theme, and status.
- Open initiative detail in a side panel on click.
- Support a clean presentation mode with reduced UI chrome.

### 2. Board view

Purpose:
- Give product managers a fast operational view.

Requirements:
- Columns by status.
- Cards with title, owner, quarter, and priority.
- Quick edit for status and owner.

### 3. List view

Purpose:
- Support scanning, sorting, and editing.

Requirements:
- Table of initiatives.
- Sort by quarter, owner, priority, status, or last update.
- Inline filters.
- Search by title, summary, or theme.

### 4. Initiative detail view

Purpose:
- Provide the full planning context.

Requirements:
- Drawer or side panel.
- Full metadata.
- Delivery links.
- Notes.
- Visibility setting.
- Activity area reserved for later, even if simplified in v1.

### 5. External share view

Purpose:
- Render only approved initiatives in a simple clean page.

Requirements:
- Show only initiatives with external visibility.
- Read-only.
- No sensitive notes or internal-only fields.
- Timeline-first layout.
- Optional intro text and branding placeholder.

## Functional requirements

### Initiative management

- Create, edit, archive, and view initiatives.
- Assign owner, theme, team, status, and dates.
- Add links to delivery systems or specs.
- Mark initiative visibility as internal or external.

### Filtering and saved views

- Filter by owner.
- Filter by team.
- Filter by theme.
- Filter by status.
- Filter by visibility.
- Save named views for common stakeholder audiences.

Suggested default saved views:
- Leadership.
- Product weekly.
- Engineering sync.
- External draft.

### Search

- Search across title, summary, theme, and owner.

### Permissions

v1 can start simple:
- Admin/editor role for product team.
- Viewer role for internal stakeholders.
- External viewer mode for shared roadmap page.

## Suggested scoring model

A lightweight scoring model is enough for v1.

Fields:
- impact (1 to 5)
- effort (1 to 5)
- strategic fit (1 to 5)
- urgency (1 to 5)

Derived field:
- priority score

Simple formula example:
- priority score = impact + strategic fit + urgency - effort

The exact formula should stay configurable later, but fixed in v1 for simplicity.

## UX requirements

- The home experience should open into the timeline view by default.
- The app should feel calm, structured, and presentation-friendly.
- The timeline must remain readable on a laptop without feeling cramped.
- Initiative creation should take less than two minutes.
- Filters should be easy to understand and reversible.
- External share mode should feel trustworthy and minimal.

## Suggested visual direction

- Internal tool but not admin-panel ugly.
- Clean product UI with strong information hierarchy.
- Neutral base palette with restrained accent colors.
- High emphasis on readability and spacing.
- Timeline bars should carry meaning through color, not decoration.

## Technical recommendation for v1

### Product shape

A custom web app is the best fit.

### Suggested stack

- Frontend: Next.js or equivalent modern React app.
- UI: component library plus custom timeline components.
- Data: Supabase or lightweight hosted Postgres.
- Auth: simple email auth or internal password gate.
- Deployment: Vercel for frontend-first speed, or Render if backend and jobs are expected early.

### Why this stack

- Fast to build in Claude Code.
- Easy preview deployments.
- Flexible enough to evolve from internal tool to polished external-facing app.
- Strong support for timeline-heavy interfaces and filtering.

## Deployment recommendation

### Best first choice

Vercel is the best default for a working prototype when the product is primarily a web app and speed matters.

Reasons:
- Fast deployment cycle.
- Strong preview workflow.
- Easy collaboration during iteration.
- Good fit for frontend-led product prototyping.

### When to prefer Render

Choose Render if the product is expected to need more backend infrastructure early, such as custom APIs, scheduled jobs, or a more traditional app architecture.

### When Retool is appropriate

Retool is only the best choice if the goal is to optimize for internal operations speed over product-like UX. It is less ideal if there is a real chance the product will later be shown externally.

## Competitive patterns worth borrowing

### From Productboard-like tools

- Roadmap views tied to prioritization.
- Clear timeline communication.
- Stakeholder-friendly sharing.

### From Aha!-style tools

- Strategy fields such as goals and themes.
- Structured initiative records.

### From Jira-adjacent tools

- Link roadmap items to delivery work.
- Make execution traceable.

### From presentation-first roadmap tools

- Beautiful timeline view.
- Polished views with low editing friction.

## v1 milestone plan

### Milestone 1

- Data model.
- Initiative CRUD.
- Timeline view.
- Board view.
- List view.

### Milestone 2

- Filters and saved views.
- Initiative detail panel.
- External visibility toggle.
- Shareable external roadmap page.

### Milestone 3

- Role-based access.
- Dependency visualization.
- Improved presentation mode.

## Open questions to resolve before building

- Is the roadmap mainly date-driven or quarter-driven?
- Should the timeline optimize for initiatives only, or also show releases and milestones?
- Which execution tools need linking first, Jira, Linear, Notion, or something else?
- Is the external view intended for customers, partners, or recruiting/marketing use?
- Should confidence and risk be visible in the main timeline or only inside details?
- How many initiatives are typically active in one quarter?
- Should ownership be by individual or by team?
- Does the team need comments and history in v1, or can that wait?

## Success criteria

A successful v1 should make the product team say:
- this is easier to maintain than slides,
- this is clearer than Jira,
- this is good enough to show leadership,
- and this could become an external roadmap later with minimal extra work.
