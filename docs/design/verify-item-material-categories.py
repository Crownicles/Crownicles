#!/usr/bin/env python3
"""Verify the item-material categorization in `item-material-categories.md`.

Parses the document, resolves each `- ID — Name` entry to a (kind, id) by
looking the name up in `Lang/fr/models.json`, then checks:

  - every weapon (0..99) and armor (0..111) is assigned to at least one
    category (212 items total);
  - no (kind, id) is assigned twice;
  - the header count `## N  Title - COUNT` matches the parsed entry count;
  - every name resolves cleanly (no name typo).

Run from anywhere:
    python3 docs/design/verify-item-material-categories.py

Exits non-zero on any issue.
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "Lang" / "fr" / "models.json"
DOC = Path(__file__).with_name("item-material-categories.md")


def norm(s: str) -> str:
	s = unicodedata.normalize("NFKC", s).strip().lower()
	s = s.replace("\u2019", "'").replace("\u2018", "'")
	return re.sub(r"\s+", " ", s)


def hr() -> None:
	print("=" * 60)


def load_models() -> tuple[dict, dict]:
	"""Load weapon and armor name maps (id -> name) from models.json."""
	models = json.loads(LANG.read_text(encoding="utf-8"))
	weapons = {int(k): v for k, v in models["weapons"].items()}
	armors = {int(k): v for k, v in models["armors"].items()}
	return weapons, armors


def parse_categories(text: str) -> list:
	"""Parse the markdown doc into a list of category dicts with their items."""
	cats = []
	cur = None
	for line in text.splitlines():
		m = re.match(r"##\s+(\d+)[.\s]+(.*?)\s*-\s*(\d+)\s*$", line)
		if m:
			cur = {
				"id": int(m.group(1)),
				"name": m.group(2).strip(),
				"announced": int(m.group(3)),
				"items": []
			}
			cats.append(cur)
			continue
		if cur is None:
			continue
		m = re.match(r"-\s*(\d+)\s+[\u2014-]\s+(.+?)\s*$", line)
		if m:
			raw = m.group(2).strip()
			kind_hint = None
			km = re.match(r"^(.*?)\s*\((weapon|armor)\)\s*$", raw)
			if km:
				raw = km.group(1).strip()
				kind_hint = km.group(2)
			cur["items"].append((int(m.group(1)), raw, kind_hint))
	return cats


def _hinted_match(kind_hint, w, a) -> list:
	if kind_hint == "weapon":
		return ["weapon"] if w else []
	return ["armor"] if a else []


def _fallback_match(w, a) -> list:
	if w and not a:
		return ["weapon"]
	if a and not w:
		return ["armor"]
	return []


def _unhinted_match(n: str, w, a) -> list:
	matches = []
	if w and norm(w) == n:
		matches.append("weapon")
	if a and norm(a) == n:
		matches.append("armor")
	if matches:
		return matches
	return _fallback_match(w, a)


def match_kinds(raw_name: str, kind_hint, w, a) -> list:
	"""Return the list of kinds ('weapon'/'armor') the entry resolves to."""
	if kind_hint:
		return _hinted_match(kind_hint, w, a)
	return _unhinted_match(norm(raw_name), w, a)


def resolve_one_entry(cat_id, item_id, raw_name, kind_hint, weapons, armors):
	"""Resolve one entry to (kind, None) or (None, error message)."""
	w, a = weapons.get(item_id), armors.get(item_id)
	matches = match_kinds(raw_name, kind_hint, w, a)
	if not matches:
		return None, (
			f"Cat {cat_id:>2}: id {item_id} '{raw_name}' "
			f"hint={kind_hint} matches nothing (w='{w}' a='{a}')"
		)
	if len(matches) > 1:
		return None, (
			f"Cat {cat_id:>2}: id {item_id} '{raw_name}' "
			f"matches both kinds — name is ambiguous, add '(weapon)' or '(armor)'"
		)
	kind = matches[0]
	real = w if kind == "weapon" else a
	if real and norm(real) != norm(raw_name):
		return None, (
			f"Cat {cat_id:>2}: id {item_id} '{raw_name}' "
			f"name does not match {kind} #{item_id} '{real}'"
		)
	return kind, None


def resolve_entries(cats, weapons, armors):
	"""Resolve every entry, returning (resolved triples, error messages)."""
	errors = []
	resolved = []
	for cat in cats:
		for item_id, raw_name, kind_hint in cat["items"]:
			kind, error = resolve_one_entry(
				cat["id"], item_id, raw_name, kind_hint, weapons, armors
			)
			if error:
				errors.append(error)
			else:
				resolved.append((cat["id"], kind, item_id))
	return resolved, errors


def aggregate(resolved, cats, weapons, armors) -> dict:
	"""Compute per-category counts, duplicates, missing/unknown and mismatches."""
	per_cat = {}
	for cid, kind, iid in resolved:
		per_cat.setdefault(cid, []).append((kind, iid))

	mismatches = [
		(c["id"], c["announced"], len(per_cat.get(c["id"], [])))
		for c in cats if c["announced"] != len(per_cat.get(c["id"], []))
	]

	counter = Counter((kind, iid) for _, kind, iid in resolved)
	duplicates = [(k, n) for k, n in counter.items() if n > 1]

	all_items = {("weapon", i) for i in weapons} | {("armor", i) for i in armors}
	assigned = set(counter.keys())
	return {
		"per_cat": per_cat,
		"mismatches": mismatches,
		"duplicates": duplicates,
		"all_items": all_items,
		"missing": sorted(all_items - assigned),
		"unknown": sorted(assigned - all_items),
	}


def print_per_category(cats, per_cat) -> None:
	hr()
	print("Per-category counts")
	hr()
	for c in cats:
		got = len(per_cat.get(c["id"], []))
		flag = "  " if got == c["announced"] else "! "
		print(f"  {flag}Cat {c['id']:>2} '{c['name']}': "
			f"header={c['announced']} parsed={got}")


def print_summary(resolved, errors, weapons, armors, results) -> None:
	hr()
	print(f"Summary")
	hr()
	print(f"  Resolved entries:     {len(resolved)}")
	print(f"  Unique (kind,id):     {len(set((k, i) for _, k, i in resolved))}")
	print(f"  Total game items:     {len(results['all_items'])} "
		f"(weapons={len(weapons)}, armors={len(armors)})")
	print(f"  Parse errors:         {len(errors)}")
	print(f"  Duplicates:           {len(results['duplicates'])}")
	print(f"  Missing items:        {len(results['missing'])}")
	print(f"  Unknown items:        {len(results['unknown'])}")
	print(f"  Count mismatches:     {len(results['mismatches'])}")


def print_errors(errors) -> None:
	if not errors:
		return
	print()
	print("Parse errors:")
	for e in errors:
		print(" ", e)


def print_duplicates(duplicates, resolved, weapons, armors) -> None:
	if not duplicates:
		return
	print()
	print("Duplicates:")
	for (kind, iid), n in sorted(duplicates):
		cats_of = sorted({cid for cid, k, i in resolved if k == kind and i == iid})
		name = weapons.get(iid) if kind == "weapon" else armors.get(iid)
		print(f"  {kind:>6} id={iid:>3} '{name}' in cats {cats_of} ({n}x)")


def print_missing(missing, weapons, armors) -> None:
	if not missing:
		return
	print()
	print("Missing items:")
	for kind, iid in missing:
		name = weapons.get(iid) if kind == "weapon" else armors.get(iid)
		print(f"  {kind:>6} id={iid:>3} '{name}'")


def print_mismatches(mismatches) -> None:
	if not mismatches:
		return
	print()
	print("Count mismatches:")
	for cid, ann, got in mismatches:
		print(f"  Cat {cid}: header says {ann}, parsed {got}")


def print_report(cats, resolved, errors, weapons, armors, results) -> None:
	print_per_category(cats, results["per_cat"])
	print()
	print_summary(resolved, errors, weapons, armors, results)
	print_errors(errors)
	print_duplicates(results["duplicates"], resolved, weapons, armors)
	print_missing(results["missing"], weapons, armors)
	print_mismatches(results["mismatches"])


def main() -> int:
	weapons, armors = load_models()
	cats = parse_categories(DOC.read_text(encoding="utf-8"))
	resolved, errors = resolve_entries(cats, weapons, armors)
	results = aggregate(resolved, cats, weapons, armors)

	print_report(cats, resolved, errors, weapons, armors, results)

	ok = not (
		errors or results["duplicates"] or results["missing"]
		or results["unknown"] or results["mismatches"]
	)
	print()
	print("RESULT:", "OK" if ok else "ISSUES FOUND")
	return 0 if ok else 1


if __name__ == "__main__":
	sys.exit(main())
