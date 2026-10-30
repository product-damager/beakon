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
        self.assertIn("status = initiatives.status", sql)

    def test_new_rows_are_internal_with_deterministic_id(self):
        self.add("Rollout Preview", note(quarter="2026-Q4", tier="T2"))
        inits, _, _, sql, _ = self.build()
        r = inits["Rollout Preview"]
        self.assertEqual(r["id"], "v-rollout-preview")
        self.assertEqual((r["target_start"], r["target_end"]), ("2026-10-01", "2026-12-31"))
        self.assertIn("target_start", r["vault_fields"])
        self.assertIn("'internal'", sql)
        self.assertNotIn("visibility = excluded", sql)  # insert-only

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
        init_stmt = [s for s in sql.split(";") if "insert into initiatives" in s][0]
        okr_stmt = [s for s in sql.split(";") if "insert into okrs" in s][0]
        self.assertIn("is distinct from", init_stmt)
        self.assertIn("is distinct from", okr_stmt)
        self.assertNotIn("archived = excluded.archived", okr_stmt)


class BuildOkrs(Base):
    def test_commitments_objectives_and_scope(self):
        _, okrs, skips, sql, _ = self.build()
        self.assertEqual(set(okrs), {"fr-1", "fr-2", "ac-1"})
        self.assertEqual(okrs["fr-1"]["strategic_objective_id"], "so-core")  # default F&R
        self.assertEqual(okrs["ac-1"]["strategic_objective_id"], "so-ai")    # default AC
        self.assertEqual(okrs["fr-2"]["strategic_objective_id"], "so-data")  # explicit
        self.assertEqual(okrs["fr-2"]["tier"], "T1")
        self.assertEqual((okrs["fr-1"]["year"], okrs["fr-1"]["quarter"]), (2026, 4))
        self.assertEqual(okrs["fr-1"]["deliverable_detail"], "A GA")
        self.assertEqual(okrs["fr-1"]["id"], "okr-v-fr-1")
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
        live = self.live([{"source_key": "fr-1", "achievement": 0.4, "governance_status": "validated", "health": "at_risk"},
                          {"source_key": "fr-2", "achievement": 1, "governance_status": "validated", "health": "on_track"},
                          {"source_key": "ac-1", "achievement": 0.5, "governance_status": "rejected", "health": "blocked"}])
        with self.assertRaises(SystemExit):
            vs.main(["write-back", "--okr", self.okr, "--live", live, "--backup-dir", bdir])
        before = open(self.okr).read()
        vs.main(["write-back", "--okr", self.okr, "--live", live, "--backup-dir", bdir, "--backup"])
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
            vs.main(["write-back", "--okr", self.okr, "--live", live, "--backup-dir", bdir])

    def test_allowlisted_product_term_is_not_a_customer(self):
        self.assertFalse(vs.denylisted("Autopromo Legacy read-only"))
        self.assertTrue(vs.denylisted("BPCE Legacy read-only"))
        self.assertTrue(vs.denylisted("Autopromo for BPCE"))

    def test_not_assessed_is_not_started(self):
        self.assertEqual(vs.commitment_status(None, "draft"), "not_started")
        self.assertEqual(vs.commitment_status(0, "validated"), "not_started")


if __name__ == "__main__":
    unittest.main()
