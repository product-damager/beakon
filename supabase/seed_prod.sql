-- Beakon PROD bootstrap — run once in the beakon-prod SQL editor.
-- Unlike seed.sql (demo data for the PREVIEW project), this seeds only the
-- reference tables real users need on day one: the initial owners and themes.
-- It creates NO initiatives — those are the real data you'll add in the app.
--
-- Safe to re-run: every row upserts, so you can edit a name/email/color below
-- and run it again to update. Requires the schema.sql columns (email, surname).
-- Note: `team` is intentionally NOT seeded — each person picks it in-app under
-- profile settings, and re-running this file won't clobber that choice.

-- ── Owners ──────────────────────────────────────────────────────────────
-- The `email` must match each person's product sign-in email exactly.
-- When they sign in, the app matches on it and auto-sets them as owner.
insert into owners (id, name, surname, role, email) values
  ('u-ivan',  'Ivan',    'Kulagin', 'Product Manager', 'ikulagin@kameleoon.com'),
  ('u-two',   'Loreena', 'Mercier', 'Product Manager', 'lmercier@kameleoon.com'),
  ('u-three', 'Lily',    'Pépin',   'Product Manager', 'apepin@kameleoon.com')
on conflict (id) do update
  set name = excluded.name, surname = excluded.surname,
      role = excluded.role, email = excluded.email;

-- ── Themes ──────────────────────────────────────────────────────────────
-- Starter set (same as the preview project). You can add more from the app
-- via the "＋ New theme" button in the initiative editor.
-- color ∈ green | blue | lime | pink | orange | beige
insert into themes (id, name, description, color) values
  ('t-ai',       'AI-led Experimentation', 'Make testing and personalization smarter with predictive models.', 'lime'),
  ('t-fm',       'Feature Management',      'Ship and control features safely with flags and rollouts.',        'blue'),
  ('t-web',      'Web Experimentation',     'Faster, flicker-free client-side and server-side testing.',        'green'),
  ('t-trust',    'Data & Trust',            'Statistical rigor, privacy, and results people can rely on.',      'pink'),
  ('t-platform', 'Platform & Scale',        'Performance, reliability, and enterprise readiness.',              'orange')
on conflict (id) do update
  set name = excluded.name, description = excluded.description, color = excluded.color;
