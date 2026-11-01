"""Unit tests for vault_sync.py — run: python3 -m unittest discover scripts/vault-sync"""

import json
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import vault_sync as vs  # noqa: E402


def note(squad="Finalize & Roll out", status="idea", **extra):
    fm = {"type": "feature", "squad": squad, "area": "Feature flags", "status": status,
          "quarter": "", "owner": "", **extra}
    body = "\n".join(f"{k}: {v}" for k, v in fm.items())
    return f"---\n{body}\n---\n# x\n\nBody text with a secret customer name that must never be read.\n"


OKR = {
    "quarter": "2026-Q4",
    "squads": [
        {"name": "Finalize & Roll out", "commitments": [
            {"key": "fr-1", "governance": "draft", "status": "not_started", "progress": None,
             "text": "We have shipped A.", "deliverables": [{"text": "A GA", "url": None}]},
            {"key": "fr-2", "governance": "draft", "status": "not_started", "progress": None,
             "text": "We have shipped B.", "strategic_objective": "data", "tier": "T1"},
        ], "objectives": [{"obj": "O1", "title": "x", "krs": [{"baseline": 75.0}]}]},
        {"name": "Assets Creation", "commitments": [
            {"key": "ac-1", "governance": "draft", "status": "not_started", "progress": None, "text": "We have C."}]},
        {"name": "BU / PBX adoption", "commitments": []},
    ],
}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.vault = self.tmp.name
        os.makedirs(os.path.join(self.vault, "04 Features"))
        self.okr = os.path.join(self.vault, "okr.json")
        with open(self.okr, "w", encoding="utf-8") as f:
            f.write(json.dumps(OKR, indent=1, ensure_ascii=False) + "\n")
        self.out = os.path.join(self.vault, "out")

    def tearDown(self):
        self.tmp.cleanup()

    def add(self, name, text):
        with open(os.path.join(self.vault, "04 Features", name + ".md"), "w", encoding="utf-8") as f:
            f.write(text)

    def build(self, current=None):
        cur = os.path.join(self.vault, "current.json")
        with open(cur, "w") as f:
            json.dump(current or {"initiatives": [], "okrs": [], "owners": []}, f)
        inits, okrs, skips = vs.main(["build", "--vault", self.vault, "--okr", self.okr, "--current", cur,
                                      "--out", self.out, "--today", "2026-10-30"])
        sql = open(os.path.join(self.out, "vault-sync-2026-10-30.sql")).read()
        rep = open(os.path.join(self.out, "vault-sync-2026-10-30.md")).read()
        return {r["source_key"]: r for r in inits}, {r["source_key"]: r for r in okrs}, skips, sql, rep


class BuildInitiatives(Base):
    def test_status_mapping_and_scope(self):
        for st, exp in [("idea", "planned"), ("discovery", "opportunity_framing"), ("spec", "solution_framing"),
                        ("prototype", "solution_framing"), ("in-dev", "in_development"), ("shipped", "released")]:
            self.add(f"F {st}", note(status=st))
        self.add("Other squad", note(squad="other"))
        inits, _, skips, _, _ = self.build()
        for st, exp in [("idea", "planned"), ("in-dev", "in_development"), ("shipped", "released")]:
            self.assertEqual(inits[f"F {st}"]["status"], exp)
            self.assertFalse(inits[f"F {st}"]["archived"])
        self.assertNotIn("Other squad", inits)
        self.assertTrue(any(k == "Other squad" for k, _ in skips))

    def test_parked_archives_and_keeps_status(self):
        self.add("Parked one", note(status="parked"))
        prior = {"id": "i-x", "title": "Parked one", "status": "in_development", "archived": False,
                 "source": "vault", "source_key": "Parked one", "target_start": "2026-01-01", "target_end": "2026-03-31"}
        inits, _, _, sql, _ = self.build({"initiatives": [prior], "okrs": [], "owners": []})
        r = inits["Parked one"]
        self.assertTrue(r["archived"])
        self.assertEqual(r["id"], "i-x")
        self.assertIn("case when v.status_kept then i.status else v.status end", sql)
        self.assertIn("true", sql.split("insert into _vs_init values")[1].split(";")[0])  # status_kept flag set

    def test_new_rows_are_internal_with_deterministic_id(self):
        self.add("Rollout Preview", note(quarter="2026-Q4", tier="T2"))
        inits, _, _, sql, _ = self.build()
        r = inits["Rollout Preview"]
        self.assertEqual(r["id"], "v-rollout-preview")
        self.assertEqual((r["target_start"], r["target_end"]), ("2026-10-01", "2026-12-31"))
        self.assertIn("target_start", r["vault_fields"])
        self.assertIn("'internal'", sql)
        self.assertNotIn("visibility", sql.split("update initiatives i set")[1])  # insert-only

    def test_beakon_link_adopts_existing_row(self):
        self.add("Rollout Preview", note(beakon="i-ff-rollout"))
        prior = {"id": "i-ff-rollout", "title": "FF: Rollout Preview", "status": "planned", "archived": False,
                 "source": None, "source_key": None, "target_start": "2026-07-01", "target_end": "2026-09-30"}
        inits, _, _, _, rep = self.build({"initiatives": [prior], "okrs": [], "owners": []})
        r = inits["Rollout Preview"]
        self.assertEqual(r["id"], "i-ff-rollout")
        self.assertEqual((r["target_start"], r["target_end"]), ("2026-07-01", "2026-09-30"))  # kept, not owned
        self.assertNotIn("target_start", r["vault_fields"])
        self.assertIn("'FF: Rollout Preview' → 'Rollout Preview'", rep)

    def test_bad_link_validation_and_denylist(self):
        self.add("Ghost", note(beakon="i-nope"))
        self.add("BPCE thing", note())
        self.add("Bad tier", note(tier="T9"))
        self.add("Bad quarter", note(quarter="Q4 2026"))
        inits, _, skips, _, _ = self.build()
        self.assertEqual(inits, {})
        reasons = dict(skips)
        self.assertIn("does not exist", reasons["Ghost"])
        self.assertIn("denylist", reasons["BPCE thing"])
        self.assertIn("tier", reasons["Bad tier"])
        self.assertIn("quarter", reasons["Bad quarter"])

    def test_owner_by_full_name(self):
        self.add("Owned", note(owner="Ivan Kulagin"))
        self.add("Unknown owner", note(owner="Nobody Here"))
        cur = {"initiatives": [], "okrs": [], "owners": [{"id": "u-ivan", "name": "Ivan", "surname": "Kulagin"}]}
        inits, _, skips, _, _ = self.build(cur)
        self.assertEqual(inits["Owned"]["owner_id"], "u-ivan")
        self.assertIn("owner_id", inits["Owned"]["vault_fields"])
        self.assertNotIn("owner_id", inits["Unknown owner"]["vault_fields"])  # still synced
        self.assertTrue(any(k == "Unknown owner" for k, _ in skips))

    def test_note_bodies_are_never_read_into_rows(self):
        self.add("Clean", note())
        inits, _, _, sql, _ = self.build()
        self.assertNotIn("secret customer", sql)

    def test_archive_when_note_removed_and_idempotent_keys(self):
        self.add("Kept", note())
        cur = {"initiatives": [
            {"id": "v-kept", "title": "Kept", "status": "planned", "archived": False, "source": "vault",
             "source_key": "Kept", "team_id": "team-finalize-rollout", "area": "Feature flags", "tier": None,
             "owner_id": None, "target_start": "2026-10-01", "target_end": "2026-12-31",
             "vault_fields": ["title", "team_id", "status", "archived", "area", "tier"]},
            {"id": "v-gone", "title": "Gone", "status": "planned", "archived": False, "source": "vault",
             "source_key": "Gone"}], "okrs": [], "owners": []}
        inits, _, _, sql, rep = self.build(cur)
        self.assertIn("source_key not in ('Kept')", sql)
        self.assertIn("archive initiative `v-gone`", rep)
        self.assertIn("0 create · 0 update · 1 unchanged", rep)  # re-run on the same vault changes nothing


class ReviewFixes(Base):
    def test_invalid_note_is_skipped_not_archived(self):
        self.add("Typo", note(tier="T9"))  # still exists, fails validation
        cur = {"initiatives": [{"id": "v-typo", "title": "Typo", "status": "planned", "archived": False,
                                "source": "vault", "source_key": "Typo"}], "okrs": [], "owners": []}
        _, _, skips, sql, rep = self.build(cur)
        self.assertIn("'Typo'", sql.split("source_key not in")[1])  # protected from archive
        self.assertNotIn("archive initiative `v-typo`", rep)
        self.assertTrue(any(k == "Typo" for k, _ in skips))

    def test_crlf_frontmatter_is_read(self):
        self.add("Windows note", note().replace("\n", "\r\n"))
        inits, _, _, _, _ = self.build()
        self.assertIn("Windows note", inits)

    def test_duplicate_ids_fail_the_build(self):
        self.add("Same Name", note())
        self.add("same-name", note())
        with self.assertRaises(SystemExit):
            self.build()

    def test_upserts_only_write_on_change_and_okr_archived_is_beakons(self):
        self.add("Clean", note())
        _, _, _, sql, _ = self.build()
        init_upd = [s for s in sql.split(";") if "update initiatives i set" in s][0]
        okr_upd = [s for s in sql.split(";") if "update okrs o set" in s][0]
        self.assertIn("is distinct from", init_upd)
        self.assertIn("is distinct from", okr_upd)
        self.assertNotIn("archived", okr_upd)  # archived is insert-only for OKRs
        self.assertIn("on conflict (id) do nothing", sql)


class QaFixes(Base):
    def test_second_write_back_works_after_fresh_backup(self):
        bdir = os.path.join(self.vault, "backups")
        p = os.path.join(self.vault, "live.json")
        with open(p, "w") as f:
            json.dump([{"source_key": "2026-Q4/fr-1", "achievement": 0.2, "governance_status": "draft", "health": "on_track"}], f)
        vs.main(["write-back", "--vault", self.vault, "--okr", self.okr, "--live", p, "--backup-dir", bdir, "--backup"])
        time.sleep(0.02)
        with open(p, "w") as f:
            json.dump([{"source_key": "2026-Q4/fr-1", "achievement": 0.5, "governance_status": "draft", "health": "on_track"}], f)
        vs.main(["write-back", "--vault", self.vault, "--okr", self.okr, "--live", p, "--backup-dir", bdir, "--backup"])
        c = json.load(open(self.okr))["squads"][0]["commitments"][0]
        self.assertEqual(c["progress"], 50)
        self.assertEqual(len([f for f in os.listdir(bdir) if f.endswith(".bak")]), 2)  # none overwritten

    def test_link_conflicting_with_existing_vault_row_is_skipped(self):
        self.add("Rollout Preview", note(beakon="i-old"))
        cur = {"initiatives": [
            {"id": "i-old", "title": "FF: Rollout Preview", "status": "planned", "archived": False,
             "source": None, "source_key": None, "target_start": "2026-07-01", "target_end": "2026-09-30"},
            {"id": "v-rollout-preview", "title": "Rollout Preview", "status": "planned", "archived": False,
             "source": "vault", "source_key": "Rollout Preview"}], "okrs": [], "owners": []}
        inits, _, skips, _, _ = self.build(cur)
        self.assertNotIn("Rollout Preview", inits)
        self.assertIn("conflicts with v-rollout-preview", dict(skips)["Rollout Preview"])

    def test_possible_rename_is_flagged(self):
        self.add("Rollout Preview v2", note())
        cur = {"initiatives": [{"id": "v-rollout-preview", "title": "Rollout Preview", "status": "planned",
                                "archived": False, "source": "vault", "source_key": "Rollout Preview",
                                "team_id": "team-finalize-rollout"}], "okrs": [], "owners": []}
        _, _, _, _, rep = self.build(cur)
        self.assertIn("possible rename: `v-rollout-preview`", rep)

    def test_non_ascii_title_gets_a_stable_id(self):
        self.assertTrue(vs.slug("Приоритеты").startswith("h"))
        self.assertEqual(vs.slug("Приоритеты"), vs.slug("Приоритеты"))
        self.assertNotEqual(vs.slug("Приоритеты"), vs.slug("Сегменты"))


class QuarterKeys(Base):
    def q4_rows(self, keyed=True):
        k = lambda x: f"2026-Q4/{x}" if keyed else x
        return [{"id": f"okr-v-{x}", "title": "t", "team_id": "team-finalize-rollout", "year": 2026, "quarter": 4,
                 "deliverable_detail": "", "strategic_objective_id": "so-core", "tier": None, "archived": False,
                 "source": "vault", "source_key": k(x),
                 "vault_fields": ["title", "team_id", "year", "quarter", "deliverable_detail", "strategic_objective_id", "tier"]}
                for x in ("fr-1", "fr-2", "ac-1")]

    def test_legacy_bare_key_is_adopted_and_rekeyed(self):
        _, okrs, _, _, rep = self.build({"initiatives": [], "okrs": self.q4_rows(keyed=False), "owners": []})
        self.assertEqual(okrs["2026-Q4/fr-1"]["id"], "okr-v-fr-1")  # same record, not a new one
        self.assertIn("source_key: 'fr-1' → '2026-Q4/fr-1'", rep)
        self.assertIn("0 create", rep.split("## OKRs")[1])
        self.assertIn("## Archive (gone from the vault): 0", rep)  # re-keyed records are not "missing"

    def test_string_year_quarter_in_dump_is_handled(self):
        rows = self.q4_rows(keyed=False)
        for r in rows: r["year"], r["quarter"] = "2026", "4"
        _, okrs, _, _, rep = self.build({"initiatives": [], "okrs": rows, "owners": []})
        self.assertEqual(okrs["2026-Q4/fr-1"]["id"], "okr-v-fr-1")  # adopted, not duplicated
        self.assertIn("## Archive (gone from the vault): 0", rep)

    def test_next_quarter_neither_overwrites_nor_archives_q4(self):
        q1 = json.loads(json.dumps(OKR)); q1["quarter"] = "2027-Q1"
        with open(self.okr, "w", encoding="utf-8") as f:
            f.write(json.dumps(q1, indent=1, ensure_ascii=False) + "\n")
        _, okrs, _, sql, rep = self.build({"initiatives": [], "okrs": self.q4_rows(), "owners": []})
        self.assertEqual(set(okrs), {"2027-Q1/fr-1", "2027-Q1/fr-2", "2027-Q1/ac-1"})
        self.assertTrue(all(r["id"].startswith("okr-v-2027-q1-") for r in okrs.values()))  # new records
        self.assertIn("year = 2027 and quarter = 1", sql)  # archive scoped to Q1
        self.assertIn("## Archive (gone from the vault): 0", rep)

    def test_write_back_matches_quarter_key(self):
        bdir = os.path.join(self.vault, "backups")
        p = os.path.join(self.vault, "live.json")
        with open(p, "w") as f:
            json.dump([{"source_key": "2026-Q4/fr-1", "achievement": 0.3, "governance_status": "draft", "health": "on_track"}], f)
        vs.main(["write-back", "--vault", self.vault, "--okr", self.okr, "--live", p, "--backup-dir", bdir, "--backup"])
        c = json.load(open(self.okr))["squads"][0]["commitments"][0]
        self.assertEqual((c["key"], c["progress"], c["status"]), ("fr-1", 30, "in_progress"))

    def test_write_back_ignores_bare_or_other_quarter_keys(self):
        bdir = os.path.join(self.vault, "backups")
        p = os.path.join(self.vault, "live.json")
        with open(p, "w") as f:
            json.dump([{"source_key": "fr-1", "achievement": 0.9, "governance_status": "draft", "health": "blocked"},
                       {"source_key": "2027-Q1/fr-1", "achievement": 0.9, "governance_status": "draft", "health": "blocked"}], f)
        vs.main(["write-back", "--vault", self.vault, "--okr", self.okr, "--live", p, "--backup-dir", bdir, "--backup"])
        c = json.load(open(self.okr))["squads"][0]["commitments"][0]
        self.assertIsNone(c.get("progress"))  # okr.json is 2026-Q4: neither key applies


class BuildOkrs(Base):
    def test_commitments_objectives_and_scope(self):
        _, okrs, skips, sql, _ = self.build()
        self.assertEqual(set(okrs), {"2026-Q4/fr-1", "2026-Q4/fr-2", "2026-Q4/ac-1"})
        self.assertEqual(okrs["2026-Q4/fr-1"]["strategic_objective_id"], "so-core")  # default F&R
        self.assertEqual(okrs["2026-Q4/ac-1"]["strategic_objective_id"], "so-ai")    # default AC
        self.assertEqual(okrs["2026-Q4/fr-2"]["strategic_objective_id"], "so-data")  # explicit
        self.assertEqual(okrs["2026-Q4/fr-2"]["tier"], "T1")
        self.assertEqual((okrs["2026-Q4/fr-1"]["year"], okrs["2026-Q4/fr-1"]["quarter"]), (2026, 4))
        self.assertEqual(okrs["2026-Q4/fr-1"]["deliverable_detail"], "A GA")
        self.assertEqual(okrs["2026-Q4/fr-1"]["id"], "okr-v-2026-q4-fr-1")
        self.assertNotIn("governance_status", sql)  # live state is Beakon's
        self.assertNotIn("achievement", sql)


class WriteBack(Base):
    def live(self, rows):
        p = os.path.join(self.vault, "live.json")
        with open(p, "w") as f:
            json.dump(rows, f)
        return p

    def test_refuses_without_backup_then_writes_only_owned_keys(self):
        bdir = os.path.join(self.vault, "backups")
        live = self.live([{"source_key": "2026-Q4/fr-1", "achievement": 0.4, "governance_status": "validated", "health": "at_risk"},
                          {"source_key": "2026-Q4/fr-2", "achievement": 1, "governance_status": "validated", "health": "on_track"},
                          {"source_key": "2026-Q4/ac-1", "achievement": 0.5, "governance_status": "rejected", "health": "blocked"}])
        with self.assertRaises(SystemExit):
            vs.main(["write-back", "--vault", self.vault, "--okr", self.okr, "--live", live, "--backup-dir", bdir])
        before = open(self.okr).read()
        vs.main(["write-back", "--vault", self.vault, "--okr", self.okr, "--live", live, "--backup-dir", bdir, "--backup"])
        after = json.load(open(self.okr))
        c = {x["key"]: x for s in after["squads"] for x in s["commitments"]}
        self.assertEqual((c["fr-1"]["status"], c["fr-1"]["progress"], c["fr-1"]["health"]), ("in_progress", 40, "at_risk"))
        self.assertEqual(c["fr-2"]["status"], "done")
        self.assertEqual(c["ac-1"]["status"], "dropped")
        self.assertEqual(c["fr-1"]["text"], "We have shipped A.")
        self.assertEqual(after["squads"][0]["objectives"], OKR["squads"][0]["objectives"])
        self.assertIn('"baseline": 75.0', open(self.okr).read())  # formatting preserved
        self.assertEqual(len([f for f in os.listdir(bdir) if f.endswith(".bak")]), 1)
        self.assertEqual(open(os.path.join(bdir, os.listdir(bdir)[0]) if os.listdir(bdir)[0].endswith(".bak")
                              else os.path.join(bdir, [f for f in os.listdir(bdir) if f.endswith(".bak")][0])).read(), before)
        time.sleep(0.01)
        with self.assertRaises(SystemExit):  # a second write-back needs a fresh backup
            vs.main(["write-back", "--vault", self.vault, "--okr", self.okr, "--live", live, "--backup-dir", bdir])

    def test_allowlisted_product_term_is_not_a_customer(self):
        self.assertFalse(vs.denylisted("Autopromo Legacy read-only"))
        self.assertTrue(vs.denylisted("BPCE Legacy read-only"))
        self.assertTrue(vs.denylisted("Autopromo for BPCE"))

    def test_not_assessed_is_not_started(self):
        self.assertEqual(vs.commitment_status(None, "draft"), "not_started")
        self.assertEqual(vs.commitment_status(0, "validated"), "not_started")


FR_NOTE = """---
type: okr
squad: Finalize & Roll out
---
# Finalize & Roll out — Q4 2026 OKR

## OKR — Kameleoon format (for the OKR sheet)

Final list, café — hand-written.

| # | Strategic objective | OKR | % |
| --- | --- | --- | --- |
| 1 | A trusted platform | We have shipped A. | 10% |
| 2 | A trusted platform | We have shipped B. | 0% |

**Quarter average:** 5% (Nov 1).

## OKR — measurable

| KR | Baseline |
| --- | --- |
| x | 75 |
"""


class LiveBlock(unittest.TestCase):
    C = [{"key": "a", "text": "Short.", "governance": "to_validate", "progress": 30, "status": "in_progress", "health": "on_track"},
         {"key": "b", "text": "Not synced.", "progress": 99},
         {"key": "c", "text": "Customers who manage personalizations by API can do everything | they do\nin the editor.",
          "governance": None, "progress": None, "status": "not_started", "health": None}]

    def rows(self, block):
        return [l for l in block if l.startswith("| ") and not l.startswith("| #") and not l.startswith("| ---")]

    def test_row_content_and_position(self):
        block = vs.live_block(self.C, {"a", "c"}, "2026-11-02")
        self.assertEqual(block[0], "### Live state from Beakon — synced 2026-11-02")
        self.assertIn("Generated from Beakon. Edit progress in Beakon, not here.", block)
        rows = self.rows(block)
        self.assertEqual(rows[0], "| 1 | Short. | To validate | 30% | In progress | On track |")
        self.assertTrue(rows[1].startswith("| 3 | "))  # unsynced "b" has no row, "c" keeps # 3
        self.assertTrue(rows[1].endswith(" | — | — | Not started | — |"))  # empty values

    def test_long_text_is_cut_at_a_word_and_escaped(self):
        t = vs.short_text(self.C[2]["text"])
        self.assertEqual(t, "Customers who manage personalizations by API can do…")
        self.assertLessEqual(len(t), 61)
        self.assertEqual(vs.short_text("a | b\nc"), "a \\| b c")
        self.assertEqual(vs.short_text("x" * 70), "x" * 60 + "…")

    def test_average(self):
        def avg(progress):
            cs = [{"key": str(i), "progress": p} for i, p in enumerate(progress)]
            return vs.live_block(cs, {c["key"] for c in cs}, "2026-11-02")[-1]
        self.assertEqual(avg([90, 20, 15, 0, 70, 30]), "Average: 38% (6 of 6 commitments with a %)")  # 37.5 up
        self.assertEqual(avg([40, 45, None]), "Average: 43% (2 of 3 commitments with a %)")
        self.assertEqual(avg([None, None]), "Average: —")


class LiveNotes(Base):
    def setUp(self):
        super().setUp()
        self.okr_dir = os.path.join(self.vault, "02 OKR")
        self.bdir = os.path.join(self.okr_dir, "backups")
        os.makedirs(self.okr_dir)
        self.fr = os.path.join(self.okr_dir, "2026-Q4 OKR — Finalize & Roll out.md")
        self.ac = os.path.join(self.okr_dir, "2026-Q4 OKR — Assets Creation.md")
        self.put(self.fr, FR_NOTE)
        self.put(self.ac, FR_NOTE.replace("Finalize & Roll out", "Assets Creation"))
        self.others = {"2026-Q4 OKR.md": "# Quarter\n", "2026-Q3 OKR — Finalize & Roll out.md": "# Q3 é\n"}
        for name, text in self.others.items():
            self.put(os.path.join(self.okr_dir, name), text)

    def put(self, path, text):
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(text)

    def get(self, path):
        with open(path, encoding="utf-8", newline="") as f:
            return f.read()

    def run_wb(self, rows, backup=True, today="2026-11-02"):
        p = os.path.join(self.vault, "live.json")
        with open(p, "w") as f:
            json.dump(rows, f)
        argv = ["write-back", "--vault", self.vault, "--okr", self.okr, "--live", p,
                "--backup-dir", self.bdir, "--today", today] + (["--backup"] if backup else [])
        return vs.main(argv)

    LIVE = [{"source_key": "2026-Q4/fr-1", "achievement": 0.4, "governance_status": "validated", "health": "at_risk"},
            {"source_key": "2026-Q4/fr-2", "achievement": None, "governance_status": "draft", "health": "on_track"},
            {"source_key": "2026-Q4/ac-1", "achievement": 0.5, "governance_status": "draft", "health": "on_track"}]

    def outside(self, text):
        s, e = text.index(vs.LIVE_START), text.index(vs.LIVE_END)
        return text[:s + len(vs.LIVE_START)], text[e:]

    def test_first_insert(self):
        report = self.run_wb(self.LIVE)
        self.assertIn("note 2026-Q4 OKR — Finalize & Roll out: markers inserted", report)
        new = self.get(self.fr)
        self.assertIn("| 2 | A trusted platform | We have shipped B. | 0% |\n\n" + vs.LIVE_START + "\n### Live state", new)
        self.assertIn(vs.LIVE_END + "\n\n**Quarter average:** 5% (Nov 1).", new)
        self.assertIn("| 1 | We have shipped A. | Validated | 40% | In progress | At risk |", new)
        self.assertIn("Average: 40% (1 of 2 commitments with a %)", new)
        before, after = new[:new.index(vs.LIVE_START)], new[new.index(vs.LIVE_END) + len(vs.LIVE_END):]
        self.assertEqual(before[:-1] + after[1:], FR_NOTE)  # only the block was added

    def test_refresh_in_place_keeps_every_byte_outside_the_markers(self):
        for nl in ("\n", "\r\n"):
            with self.subTest(nl=nl):
                text = FR_NOTE.replace("**Quarter", vs.LIVE_START + "\nstale — hand edit\n" + vs.LIVE_END + "\n\n**Quarter")
                self.put(self.fr, text.replace("\n", nl))
                self.run_wb(self.LIVE)
                new = self.get(self.fr)
                self.assertEqual(self.outside(new), self.outside(text.replace("\n", nl)))
                self.assertNotIn("stale", new)
                self.assertIn("| 1 | We have shipped A. | Validated | 40% |", new)
                self.assertEqual(new.count("\r\n") > 0, nl == "\r\n")
                if nl == "\r\n":
                    self.assertNotIn("\n", new.replace("\r\n", ""))  # block uses the note's line ending
                time.sleep(0.01)

    def test_same_day_rerun_leaves_note_untouched(self):
        self.run_wb(self.LIVE)
        os.utime(self.fr, (1, 1))
        before = self.get(self.fr)
        time.sleep(0.01)
        report = self.run_wb(self.LIVE)
        self.assertIn("note 2026-Q4 OKR — Finalize & Roll out: unchanged", report)
        self.assertEqual((self.get(self.fr), os.path.getmtime(self.fr)), (before, 1))

    def test_broken_markers_and_no_table_are_skipped(self):
        broken = FR_NOTE.replace("**Quarter", vs.LIVE_START + "\n**Quarter")
        no_table = "# Assets Creation\n\nNo table here.\n"
        self.put(self.fr, broken)
        self.put(self.ac, no_table)
        report = self.run_wb(self.LIVE)
        self.assertIn("note 2026-Q4 OKR — Finalize & Roll out: skipped (broken markers)", report)
        self.assertIn("note 2026-Q4 OKR — Assets Creation: skipped (no OKR — Kameleoon format table)", report)
        self.assertEqual((self.get(self.fr), self.get(self.ac)), (broken, no_table))
        self.assertEqual(json.load(open(self.okr))["squads"][0]["commitments"][0]["progress"], 40)  # okr.json still written
        for name, text in (("duplicated", FR_NOTE + vs.LIVE_START + "\n" + vs.LIVE_END + "\n" + vs.LIVE_START + "\n"),
                           ("reversed", FR_NOTE + vs.LIVE_END + "\nx\n" + vs.LIVE_START + "\n")):
            with self.subTest(name):
                self.put(self.fr, text)
                time.sleep(0.01)
                self.assertIn("note 2026-Q4 OKR — Finalize & Roll out: skipped (broken markers)", self.run_wb(self.LIVE))
                self.assertEqual(self.get(self.fr), text)

    def test_squad_name_that_is_not_a_file_name_is_skipped(self):
        okr = json.load(open(self.okr))
        okr["squads"][1]["name"] = "../Assets Creation"
        with open(self.okr, "w", encoding="utf-8") as f:
            f.write(json.dumps(okr, indent=1, ensure_ascii=False) + "\n")
        report = self.run_wb(self.LIVE)
        self.assertIn("note 2026-Q4 OKR — ../Assets Creation: skipped (squad name is not a file name)", report)
        self.assertEqual(self.get(self.ac), FR_NOTE.replace("Finalize & Roll out", "Assets Creation"))

    def test_backup_dir_defaults_inside_the_given_vault(self):
        p = os.path.join(self.vault, "live.json")
        with open(p, "w") as f:
            json.dump(self.LIVE, f)
        vs.main(["write-back", "--vault", self.vault, "--okr", self.okr, "--live", p, "--backup", "--today", "2026-11-02"])
        self.assertTrue(os.path.exists(os.path.join(self.bdir, vs.MARKER)))

    def test_only_notes_of_synced_squads_are_touched(self):
        os.remove(self.ac)
        names = set(os.listdir(self.okr_dir))
        report = self.run_wb(self.LIVE)
        self.assertIn("note 2026-Q4 OKR — Assets Creation: skipped (missing note)", report)
        self.assertFalse(os.path.exists(self.ac))  # never created
        self.assertEqual(set(os.listdir(self.okr_dir)), names | {"backups"})  # nothing for "BU / PBX adoption"
        self.assertFalse(any("PBX" in r for r in report))
        for name, text in self.others.items():
            self.assertEqual(self.get(os.path.join(self.okr_dir, name)), text)

    def test_notes_are_backed_up_and_guarded(self):
        self.run_wb(self.LIVE)
        baks = [f for f in os.listdir(self.bdir) if f.endswith(vs.NOTE_BACKUP_SUFFIX)]
        fr_bak = [f for f in baks if f.startswith("2026-Q4 OKR — Finalize & Roll out.")]
        self.assertEqual(len(fr_bak), 1)
        self.assertEqual(self.get(os.path.join(self.bdir, fr_bak[0])), FR_NOTE)
        self.assertFalse(any(f.startswith("2026-Q4 OKR.") for f in baks))  # quarter note is not a candidate
        time.sleep(0.02)
        # A fresh okr.json backup alone is not enough when a note would change.
        with open(os.path.join(self.bdir, "okr.json.manual.bak"), "w") as f:
            f.write("{}")
        okr_before, note_before = open(self.okr).read(), self.get(self.fr)
        with self.assertRaises(SystemExit):
            self.run_wb([dict(self.LIVE[0], achievement=0.9)], backup=False)
        self.assertEqual((open(self.okr).read(), self.get(self.fr)), (okr_before, note_before))
        time.sleep(0.02)
        self.run_wb([dict(self.LIVE[0], achievement=0.9)])
        self.assertIn("| 90% |", self.get(self.fr))
        self.assertEqual(len([f for f in os.listdir(self.bdir) if f.startswith("2026-Q4 OKR — Finalize & Roll out.")]), 2)

    # QA findings (tasks 6.x)

    def test_note_edited_during_the_run_keeps_the_edit(self):
        real = vs.backup_file

        def edit_after_backup(src, backup_dir, stem, ext, stamp):
            real(src, backup_dir, stem, ext, stamp)
            if src == self.fr:
                with open(self.fr, "a", encoding="utf-8") as f:
                    f.write("typed in Obsidian\n")
        vs.backup_file = edit_after_backup
        try:
            report = self.run_wb(self.LIVE)
        finally:
            vs.backup_file = real
        self.assertIn("note 2026-Q4 OKR — Finalize & Roll out: skipped (note changed during the run)", report)
        self.assertEqual(self.get(self.fr), FR_NOTE + "typed in Obsidian\n")

    def test_vault_is_required_with_a_copied_okr_json(self):
        p = os.path.join(self.vault, "live.json")
        with open(p, "w") as f:
            json.dump(self.LIVE, f)
        with self.assertRaises(SystemExit):
            vs.main(["write-back", "--okr", self.okr, "--live", p, "--backup-dir", self.bdir, "--backup"])
        self.assertFalse(os.path.exists(self.bdir))  # refused before anything ran

    def test_insert_keeps_a_missing_final_newline(self):
        text = FR_NOTE[:FR_NOTE.index("\n\n**Quarter")]  # note ends with the table, no newline
        self.put(self.fr, text)
        self.run_wb(self.LIVE)
        new = self.get(self.fr)
        self.assertTrue(new.startswith(text + "\n\n" + vs.LIVE_START + "\n"))
        self.assertTrue(new.endswith("\n" + vs.LIVE_END))

    def test_fenced_code_is_ignored(self):
        fenced = "```\n" + vs.LIVE_START + "\nexample\n" + vs.LIVE_END + "\n| not | the table |\n```\n"
        text = FR_NOTE.replace("Final list, café — hand-written.\n", "Final list.\n\n" + fenced)
        self.put(self.fr, text)
        report = self.run_wb(self.LIVE)
        self.assertIn("note 2026-Q4 OKR — Finalize & Roll out: markers inserted", report)
        new = self.get(self.fr)
        self.assertIn(fenced, new)  # example untouched
        self.assertIn("| 2 | A trusted platform | We have shipped B. | 0% |\n\n" + vs.LIVE_START, new)

    def test_bom_and_indented_markers_are_recognised(self):
        text = "﻿" + vs.LIVE_START + "\nold\n  " + vs.LIVE_END + "  \n" + FR_NOTE
        self.put(self.fr, text)
        report = self.run_wb(self.LIVE)
        self.assertIn("note 2026-Q4 OKR — Finalize & Roll out: updated", report)
        new = self.get(self.fr)
        self.assertTrue(new.startswith("﻿" + vs.LIVE_START + "\n### Live state"))
        self.assertTrue(new.endswith("  " + vs.LIVE_END + "  \n" + FR_NOTE))

    def test_unchanged_notes_are_not_backed_up(self):
        self.run_wb(self.LIVE)
        time.sleep(0.01)
        self.run_wb(self.LIVE)  # same day, same state: notes unchanged
        fr = [f for f in os.listdir(self.bdir) if f.startswith("2026-Q4 OKR — Finalize & Roll out.")]
        self.assertEqual(len(fr), 1)

    def test_text_escaping(self):
        self.assertEqual(vs.short_text("a \\| b"), "a \\\\\\| b")
        self.assertEqual(vs.short_text("see <!-- x -->"), "see &lt;!-- x -->")


if __name__ == "__main__":
    unittest.main()
