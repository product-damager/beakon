-- Beakon seed data (sample). The canonical demo dataset lives in lib/seed.ts;
-- this file seeds enough to validate the schema and the external_roadmap view.

insert into owners (id, name, role) values
  ('u-magali', 'Magali Roux', 'Head of Product'),
  ('u-helene', 'Hélène Dupont', 'Senior PM'),
  ('u-seimour', 'Seimour Karim', 'Product Manager'),
  ('u-nadia', 'Nadia Belhaj', 'PM, Platform'),
  ('u-tom', 'Tom Verhoeven', 'Engineering Manager');

insert into themes (id, name, description, color) values
  ('t-ai', 'AI-led Experimentation', 'Make testing and personalization smarter with predictive models.', 'lime'),
  ('t-fm', 'Feature Management', 'Ship and control features safely with flags and rollouts.', 'blue'),
  ('t-web', 'Web Experimentation', 'Faster, flicker-free client-side and server-side testing.', 'green'),
  ('t-trust', 'Data & Trust', 'Statistical rigor, privacy, and results people can rely on.', 'pink'),
  ('t-platform', 'Platform & Scale', 'Performance, reliability, and enterprise readiness.', 'orange');

insert into initiatives
  (id, title, summary, expected_outcome, status, owner_id, team, theme_id, strategic_goal,
   reach, impact, confidence, effort, health, target_start, target_end, visibility, notes)
values
  ('i-pbx', 'PBX predictive targeting v2',
   'Second-generation predictive segments powering audience targeting.',
   'Adopting accounts see a measurable lift in conversion within one quarter.',
   'in_development', 'u-magali', 'Tech & Perso Builders', 't-ai', 'Lead the market on AI-driven experimentation',
   1200, 3, 0.8, 8, 'on_track', '2026-04-01', '2026-09-30', 'external',
   'Legal reviewing model card language before we can name accuracy figures externally.'),
  ('i-flicker', 'Zero-flicker rendering engine',
   'Rewrite the client-side apply path to eliminate flicker on slow connections.',
   'Sub-50ms apply time on P75 pages; flicker complaints drop to near zero.',
   'in_development', 'u-helene', 'Visual Builders', 't-web', 'Best-in-class web testing experience',
   2000, 3, 1, 5, 'on_track', '2026-05-01', '2026-08-15', 'external', 'Perf budget agreed with SDK team.'),
  ('i-stats', 'Bayesian stats engine GA',
   'Graduate the Bayesian results engine from beta to general availability.',
   'Bayesian reporting available to all plans with clear decision guidance.',
   'solution_framing', 'u-nadia', 'Tech & Perso Builders', 't-trust', 'Results people can trust',
   900, 2, 0.5, 8, 'at_risk', '2026-03-01', '2026-07-31', 'internal', 'Validation dataset behind schedule.');
