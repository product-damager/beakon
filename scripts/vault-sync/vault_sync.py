#!/usr/bin/env python3
"""vault-sync — one writer per field between the PM's vault and Beakon.

See openspec/changes/vault-sync (design.md: field ownership). Standard library
only. Run by the PM through Claude; no credentials are stored or used here —
Claude reads/writes Supabase with its own tools and passes JSON in/out.

  build       vault (04 Features + okr.json) + current DB rows (JSON)
              -> idempotent SQL + a human report (creates/updates/archives/skips)
  write-back  live OKR state from Beakon (JSON) -> okr.json (status, progress,
              health, governance of synced commitments only), after a backup

Python rather than Node: okr.json is written by Python's json module
(indent=1, ensure_ascii=False); re-serializing it the same way is byte-exact,
so a write-back diff shows only the values it owns.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import sys

# ── Mapping tables (design.md "Field ownership") ──

SQUAD_TEAM = {
    "Finalize & Roll out": "team-finalize-rollout",
    "Assets Creation": "team-assets-creation",
}

# Vault feature status -> Beakon initiative status (D1). "parked" archives.
STATUS_MAP = {
    "idea": "planned",
    "discovery": "opportunity_framing",
    "spec": "solution_framing",
    "prototype": "solution_framing",
    "in-dev": "in_development",
    "shipped": "released",
}
PARKED = "parked"
VAULT_STATUSES = set(STATUS_MAP) | {PARKED}

TIERS = {"T1", "T2", "T3"}

# okr.json commitment strategic_objective -> Beakon strategic objective (D2).
OBJECTIVE_MAP = {"core": "so-core", "ai": "so-ai", "data": "so-data", "internal": "so-internal"}
OBJECTIVE_DEFAULT = {"Finalize & Roll out": "so-core", "Assets Creation": "so-ai"}

# Titles never sent to Supabase (privacy: no customer names). Case-insensitive
# whole-word patterns; extend when a new customer name shows up in a report.
CUSTOMER_DENYLIST = [r"\bbpce\b"]

QUARTER_RE = re.compile(r"^(\d{4})-Q([1-4])$")


# ── Small helpers ──

def sql_str(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def sql_arr(items):
    return "array[" + ", ".join(sql_str(i) for i in items) + "]::text[]" if items else "'{}'::text[]"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def quarter_dates(q):
    """'2026-Q4' -> ('2026-10-01', '2026-12-31')."""
    m = QUARTER_RE.match(q)
    year, n = int(m.group(1)), int(m.group(2))
    start = dt.date(year, 3 * (n - 1) + 1, 1)
    end = (dt.date(year + 1, 1, 1) if n == 4 else dt.date(year, 3 * n + 1, 1)) - dt.timedelta(days=1)
    return start.isoformat(), end.isoformat()


def parse_frontmatter(text):
    """Minimal YAML frontmatter: `key: value` lines; lists/quotes kept as text."""
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    if not m:
        return None
    fm = {}
    for line in m.group(1).splitlines():
        mm = re.match(r"([A-Za-z_][\w-]*):\s*(.*)$", line)
        if mm:
            v = mm.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            fm[mm.group(1)] = v
    return fm


def denylisted(title):
    return any(re.search(p, title, re.I) for p in CUSTOMER_DENYLIST)


# ── build ──

INIT_COMPARE = ["title", "team_id", "status", "archived", "area", "tier", "owner_id",
                "target_start", "target_end", "source", "source_key", "vault_fields"]
OKR_COMPARE = ["title", "team_id", "year", "quarter", "deliverable_detail",
               "strategic_objective_id", "tier", "archived", "source", "source_key", "vault_fields"]


def plan_initiatives(features_dir, current, today):
    """Return (rows, skips) for feature notes in scope."""
    owners = {(" ".join(filter(None, [o.get("name"), o.get("surname")]))).strip().lower(): o["id"]
              for o in current.get("owners", [])}
    existing = {r["id"]: r for r in current.get("initiatives", [])}
    by_key = {r["source_key"]: r for r in current.get("initiatives", []) if r.get("source") == "vault"}
    rows, skips = [], []
    for fn in sorted(os.listdir(features_dir)):
        if not fn.endswith(".md"):
            continue
        key = fn[:-3]
        fm = parse_frontmatter(open(os.path.join(features_dir, fn), encoding="utf-8").read())
        if not fm or fm.get("type") != "feature":
            continue
        squad = fm.get("squad", "")
        if squad not in SQUAD_TEAM:
            skips.append((key, f"squad {squad!r} is out of scope"))
            continue
        status = fm.get("status", "")
        if status not in VAULT_STATUSES:
            skips.append((key, f"unknown status {status!r}"))
            continue
        tier = fm.get("tier", "") or None
        if tier and tier not in TIERS:
            skips.append((key, f"unknown tier {tier!r}"))
            continue
        quarter = fm.get("quarter", "")
        if quarter and not QUARTER_RE.match(quarter):
            skips.append((key, f"bad quarter {quarter!r} (expected YYYY-Qn)"))
            continue
        if denylisted(key):
            skips.append((key, "title matches the customer-name denylist — rename the note"))
            continue

        link = fm.get("beakon", "") or None
        if link and link not in existing:
            skips.append((key, f"beakon: {link} does not exist in Beakon"))
            continue
        prior = existing.get(link) if link else by_key.get(key)
        rid = link or (prior["id"] if prior else "v-" + slug(key))
        if prior and prior.get("source") == "vault" and prior.get("source_key") not in (None, key):
            skips.append((key, f"{rid} is already linked to note {prior['source_key']!r}"))
            continue

        fields = ["title", "team_id", "status", "archived", "area", "tier"]
        owner_id = None
        if fm.get("owner"):
            owner_id = owners.get(fm["owner"].strip().lower())
            if owner_id:
                fields.append("owner_id")
            else:
                skips.append((key, f"owner {fm['owner']!r} not found — owner left to Beakon (note still synced)"))
        start = end = None
        if quarter:
            start, end = quarter_dates(quarter)
            fields += ["target_start", "target_end"]
        if not start:
            # Not vault-owned: only needed because NOT NULL is checked on the
            # proposed row even when the upsert ends in an update. Existing rows
            # keep their dates; new rows start on the current quarter.
            if prior:
                start, end = prior["target_start"], prior["target_end"]
            else:
                start, end = quarter_dates(f"{today.year}-Q{(today.month - 1) // 3 + 1}")

        parked = status == PARKED
        mapped = STATUS_MAP.get(status)
        rows.append({
            "id": rid,
            "title": key,
            "team_id": SQUAD_TEAM[squad],
            # parked keeps the last mapped status; a new parked note starts at Backlog
            "status": mapped or (prior["status"] if prior else "planned"),
            "status_kept": parked and bool(prior),
            "archived": parked,
            "area": fm.get("area") or None,
            "tier": tier,
            "owner_id": owner_id,
            "target_start": start,
            "target_end": end,
            "dates_owned": bool(quarter),
            "source": "vault",
            "source_key": key,
            "vault_fields": fields,
            "_prior": prior,
        })
    return rows, skips


def plan_okrs(okr, current):
    existing = {r["id"]: r for r in current.get("okrs", [])}
    by_key = {r["source_key"]: r for r in current.get("okrs", []) if r.get("source") == "vault"}
    m = QUARTER_RE.match(okr.get("quarter", ""))
    if not m:
        raise SystemExit(f"okr.json quarter {okr.get('quarter')!r} is not YYYY-Qn")
    year, quarter = int(m.group(1)), int(m.group(2))
    rows, skips = [], []
    for sq in okr.get("squads", []):
        name = sq.get("name", "")
        if name not in SQUAD_TEAM:
            if sq.get("commitments"):
                skips.append((name, "squad out of scope — its commitments are not synced"))
            continue
        for c in sq.get("commitments", []):
            key = c.get("key")
            if not key:
                skips.append((name, "commitment without key"))
                continue
            obj = c.get("strategic_objective")
            if obj and obj not in OBJECTIVE_MAP:
                skips.append((key, f"unknown strategic_objective {obj!r}"))
                continue
            tier = c.get("tier") or None
            if tier and tier not in TIERS:
                skips.append((key, f"unknown tier {tier!r}"))
                continue
            text = (c.get("text") or "").strip()
            if denylisted(text):
                skips.append((key, "text matches the customer-name denylist"))
                continue
            prior = by_key.get(key)
            rows.append({
                "id": prior["id"] if prior else "okr-v-" + slug(key),
                "title": text,
                "team_id": SQUAD_TEAM[name],
                "year": year,
                "quarter": quarter,
                "deliverable_detail": "\n".join(d.get("text", "") for d in c.get("deliverables") or []),
                "strategic_objective_id": OBJECTIVE_MAP.get(obj) if obj else OBJECTIVE_DEFAULT[name],
                "tier": tier,
                "archived": False,
                "source": "vault",
                "source_key": key,
                "vault_fields": ["title", "team_id", "year", "quarter", "deliverable_detail",
                                 "strategic_objective_id", "tier"],
                "_prior": prior,
            })
    return rows, skips


def initiative_sql(r):
    cols = ["id", "title", "team_id", "status", "archived", "area", "tier", "owner_id",
            "target_start", "target_end", "visibility", "source", "source_key", "vault_fields"]
    vals = [sql_str(r["id"]), sql_str(r["title"]), sql_str(r["team_id"]), sql_str(r["status"]) + "::initiative_status",
            str(r["archived"]).lower(), sql_str(r["area"]), sql_str(r["tier"]), sql_str(r["owner_id"]),
            sql_str(r["target_start"]) + "::date", sql_str(r["target_end"]) + "::date",
            "'internal'", "'vault'", sql_str(r["source_key"]), sql_arr(r["vault_fields"])]
    sets = ["title = excluded.title", "team_id = excluded.team_id",
            "status = initiatives.status" if r["status_kept"] else "status = excluded.status",
            "archived = excluded.archived", "area = excluded.area", "tier = excluded.tier",
            "source = excluded.source", "source_key = excluded.source_key", "vault_fields = excluded.vault_fields"]
    if "owner_id" in r["vault_fields"]:
        sets.append("owner_id = excluded.owner_id")
    if r["dates_owned"]:
        sets += ["target_start = excluded.target_start", "target_end = excluded.target_end"]
    # visibility is set on insert only (Beakon owns it afterwards)
    return (f"insert into initiatives ({', '.join(cols)})\n  values ({', '.join(vals)})\n"
            f"  on conflict (id) do update set {', '.join(sets)};")


def okr_sql(r):
    cols = ["id", "title", "team_id", "year", "quarter", "deliverable_detail", "strategic_objective_id",
            "tier", "archived", "source", "source_key", "vault_fields"]
    vals = [sql_str(r["id"]), sql_str(r["title"]), sql_str(r["team_id"]), str(r["year"]), str(r["quarter"]),
            sql_str(r["deliverable_detail"]), sql_str(r["strategic_objective_id"]), sql_str(r["tier"]),
            "false", "'vault'", sql_str(r["source_key"]), sql_arr(r["vault_fields"])]
    sets = [f"{c} = excluded.{c}" for c in cols[1:]]
    return (f"insert into okrs ({', '.join(cols)})\n  values ({', '.join(vals)})\n"
            f"  on conflict (id) do update set {', '.join(sets)};")


def diff(prior, row, fields):
    if not prior:
        return None
    out = []
    for f in fields:
        a, b = prior.get(f), row.get(f)
        if f == "status" and row.get("status_kept"):
            continue
        if f in ("target_start", "target_end") and not row.get("dates_owned", True):
            continue
        if f == "owner_id" and "owner_id" not in row.get("vault_fields", []):
            continue
        if f == "vault_fields":
            a, b = sorted(a or []), sorted(b or [])
        if a != b:
            out.append(f"{f}: {a!r} → {b!r}")
    return out


def build(args):
    current = json.load(open(args.current, encoding="utf-8")) if args.current else {}
    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()
    inits, skips_i = plan_initiatives(os.path.join(args.vault, "04 Features"), current, today)
    okr = json.load(open(args.okr, encoding="utf-8"))
    okrs, skips_o = plan_okrs(okr, current)

    keys_i = {r["source_key"] for r in inits}
    keys_o = {r["source_key"] for r in okrs}
    archive_i = [r for r in current.get("initiatives", [])
                 if r.get("source") == "vault" and r["source_key"] not in keys_i and not r.get("archived")]
    archive_o = [r for r in current.get("okrs", [])
                 if r.get("source") == "vault" and r["source_key"] not in keys_o and not r.get("archived")]

    stamp = today.isoformat()
    sql = [f"-- vault-sync {stamp} — generated by scripts/vault-sync/vault_sync.py build. Idempotent.",
           "begin;"]
    sql += [initiative_sql(r) for r in inits]
    sql += [okr_sql(r) for r in okrs]
    if keys_i:
        sql.append(f"update initiatives set archived = true where source = 'vault' and archived = false "
                   f"and source_key not in ({', '.join(sql_str(k) for k in sorted(keys_i))});")
    if keys_o:
        sql.append(f"update okrs set archived = true where source = 'vault' and archived = false "
                   f"and source_key not in ({', '.join(sql_str(k) for k in sorted(keys_o))});")
    sql.append("commit;")

    lines = [f"# vault-sync report — {stamp}", ""]
    def section(title, rows, fields, kind):
        created = [r for r in rows if not r["_prior"]]
        changed = [(r, diff(r["_prior"], r, fields)) for r in rows if r["_prior"]]
        changed = [(r, d) for r, d in changed if d]
        same = len(rows) - len(created) - len(changed)
        lines.append(f"## {title}: {len(created)} create · {len(changed)} update · {same} unchanged")
        for r in created:
            extra = " — archived (parked)" if kind == "i" and r["archived"] else ""
            lines.append(f"- **create** `{r['id']}` {r['title']!r} → {r['team_id']}"
                         f"{' · ' + r['status'] if kind == 'i' else ' · ' + r['strategic_objective_id']}"
                         f"{' · ' + r['tier'] if r['tier'] else ''}{extra}")
        for r, d in changed:
            lines.append(f"- **update** `{r['id']}` {r['title']!r}: " + "; ".join(d))
        lines.append("")
    section("Initiatives (04 Features)", inits, INIT_COMPARE, "i")
    section("OKRs (okr.json commitments)", okrs, OKR_COMPARE, "o")
    lines.append(f"## Archive (gone from the vault): {len(archive_i) + len(archive_o)}")
    lines += [f"- archive initiative `{r['id']}` {r.get('title')!r}" for r in archive_i]
    lines += [f"- archive OKR `{r['id']}` {r.get('title')!r}" for r in archive_o]
    lines.append("")
    lines.append(f"## Skipped / warnings: {len(skips_i) + len(skips_o)}")
    lines += [f"- {k}: {why}" for k, why in skips_i + skips_o]
    untouched = [r for r in current.get("initiatives", []) if r.get("source") != "vault"
                 and r["id"] not in {x["id"] for x in inits}]
    lines += ["", f"## Beakon-only initiatives left untouched: {len(untouched)}"]

    os.makedirs(args.out, exist_ok=True)
    sql_path = os.path.join(args.out, f"vault-sync-{stamp}.sql")
    rep_path = os.path.join(args.out, f"vault-sync-{stamp}.md")
    open(sql_path, "w", encoding="utf-8").write("\n".join(sql) + "\n")
    open(rep_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(rep_path)
    print(sql_path)
    return inits, okrs, skips_i + skips_o


# ── write-back ──

def commitment_status(achievement, governance):
    if governance == "rejected":
        return "dropped"
    if achievement is not None and achievement >= 1:
        return "done"
    if achievement is not None and achievement > 0:
        return "in_progress"
    return "not_started"


def latest_backup_mtime(backup_dir):
    times = [os.path.getmtime(os.path.join(backup_dir, f)) for f in os.listdir(backup_dir)
             if f.startswith("okr.json.") and f.endswith(".bak")]
    return max(times) if times else None


MARKER = ".vault-sync-writeback"


def write_back(args):
    marker = os.path.join(args.backup_dir, MARKER)
    if args.backup:
        os.makedirs(args.backup_dir, exist_ok=True)
        stamp = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
        shutil.copy2(args.okr, os.path.join(args.backup_dir, f"okr.json.{stamp}-before-vault-sync-writeback.bak"))
    last_backup = latest_backup_mtime(args.backup_dir) if os.path.isdir(args.backup_dir) else None
    last_write = os.path.getmtime(marker) if os.path.exists(marker) else None
    if last_backup is None or (last_write is not None and last_backup <= last_write):
        raise SystemExit("refusing to write: no okr.json backup newer than the last write-back "
                         f"in {args.backup_dir!r} — run again with --backup")

    raw = open(args.okr, encoding="utf-8").read()
    okr = json.loads(raw)
    live = {r["source_key"]: r for r in json.load(open(args.live, encoding="utf-8"))}
    changes = []
    for sq in okr.get("squads", []):
        for c in sq.get("commitments", []):
            r = live.get(c.get("key"))
            if not r:
                continue
            ach = None if r.get("achievement") is None else float(r["achievement"])
            new = {
                "status": commitment_status(ach, r.get("governance_status")),
                "progress": None if ach is None else round(ach * 100),
                "health": r.get("health"),
                "governance": r.get("governance_status"),
            }
            for k, v in new.items():
                if c.get(k) != v:
                    changes.append(f"{c['key']}.{k}: {c.get(k)!r} → {v!r}")
                    c[k] = v
    out = json.dumps(okr, indent=1, ensure_ascii=False) + "\n"
    if out != raw:
        open(args.okr, "w", encoding="utf-8").write(out)
    open(marker, "w").write(dt.datetime.now().isoformat())
    print("\n".join(changes) if changes else "no changes")
    return changes


def main(argv=None):
    here = os.path.dirname(os.path.abspath(__file__))
    vault_default = os.path.normpath(os.path.join(here, "..", "..", "..", ".."))  # Repos/beakon/scripts/vault-sync -> vault
    okr_default = os.path.join(vault_default, "Repos", "bu-dashboard", "data", "okr.json")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="vault -> SQL + report")
    b.add_argument("--vault", default=vault_default)
    b.add_argument("--okr", default=okr_default)
    b.add_argument("--current", help="JSON dump of current rows: {initiatives, okrs, owners}")
    b.add_argument("--out", default=os.path.join(here, "out"))
    b.add_argument("--today", help="YYYY-MM-DD (tests)")
    w = sub.add_parser("write-back", help="live OKR state -> okr.json")
    w.add_argument("--okr", default=okr_default)
    w.add_argument("--live", required=True, help="JSON list: {source_key, achievement, governance_status, health}")
    w.add_argument("--backup-dir", default=os.path.join(vault_default, "02 OKR", "backups"))
    w.add_argument("--backup", action="store_true", help="copy okr.json to the backup dir first")
    a = p.parse_args(argv)
    return build(a) if a.cmd == "build" else write_back(a)


if __name__ == "__main__":
    main()
