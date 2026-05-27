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


def main() -> int:
	models = json.loads(LANG.read_text(encoding="utf-8"))
	weapons = {int(k): v for k, v in models["weapons"].items()}
	armors = {int(k): v for k, v in models["armors"].items()}

	text = DOC.read_text(encoding="utf-8")
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

	errors = []
	resolved = []
	for cat in cats:
		for item_id, raw_name, kind_hint in cat["items"]:
			w, a = weapons.get(item_id), armors.get(item_id)
			n = norm(raw_name)
			matches = []
			if kind_hint == "weapon":
				if w:
					matches.append("weapon")
			elif kind_hint == "armor":
				if a:
					matches.append("armor")
			else:
				if w and norm(w) == n:
					matches.append("weapon")
				if a and norm(a) == n:
					matches.append("armor")
				if not matches:
					if w and not a:
						matches = ["weapon"]
					elif a and not w:
						matches = ["armor"]
			if not matches:
				errors.append(
					f"Cat {cat['id']:>2}: id {item_id} '{raw_name}' "
					f"hint={kind_hint} matches nothing (w='{w}' a='{a}')"
				)
				continue
			if len(matches) > 1:
				errors.append(
					f"Cat {cat['id']:>2}: id {item_id} '{raw_name}' "
					f"matches both kinds — name is ambiguous, add '(weapon)' or '(armor)'"
				)
				continue
			# Sanity-check the displayed name when a hint was given
			kind = matches[0]
			real = w if kind == "weapon" else a
			if real and norm(real) != n:
				errors.append(
					f"Cat {cat['id']:>2}: id {item_id} '{raw_name}' "
					f"name does not match {kind} #{item_id} '{real}'"
				)
				continue
			resolved.append((cat["id"], kind, item_id))

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
	missing = sorted(all_items - assigned)
	unknown = sorted(assigned - all_items)

	def hr():
		print("=" * 60)

	hr()
	print("Per-category counts")
	hr()
	for c in cats:
		got = len(per_cat.get(c["id"], []))
		flag = "  " if got == c["announced"] else "! "
		print(f"  {flag}Cat {c['id']:>2} '{c['name']}': "
			f"header={c['announced']} parsed={got}")

	print()
	hr()
	print(f"Summary")
	hr()
	print(f"  Resolved entries:     {len(resolved)}")
	print(f"  Unique (kind,id):     {len(set((k, i) for _, k, i in resolved))}")
	print(f"  Total game items:     {len(all_items)} "
		f"(weapons={len(weapons)}, armors={len(armors)})")
	print(f"  Parse errors:         {len(errors)}")
	print(f"  Duplicates:           {len(duplicates)}")
	print(f"  Missing items:        {len(missing)}")
	print(f"  Unknown items:        {len(unknown)}")
	print(f"  Count mismatches:     {len(mismatches)}")

	if errors:
		print()
		print("Parse errors:")
		for e in errors:
			print(" ", e)
	if duplicates:
		print()
		print("Duplicates:")
		for (kind, iid), n in sorted(duplicates):
			cats_of = sorted({cid for cid, k, i in resolved if k == kind and i == iid})
			name = weapons.get(iid) if kind == "weapon" else armors.get(iid)
			print(f"  {kind:>6} id={iid:>3} '{name}' in cats {cats_of} ({n}x)")
	if missing:
		print()
		print("Missing items:")
		for kind, iid in missing:
			name = weapons.get(iid) if kind == "weapon" else armors.get(iid)
			print(f"  {kind:>6} id={iid:>3} '{name}'")
	if mismatches:
		print()
		print("Count mismatches:")
		for cid, ann, got in mismatches:
			print(f"  Cat {cid}: header says {ann}, parsed {got}")

	ok = not (errors or duplicates or missing or unknown or mismatches)
	print()
	print("RESULT:", "OK" if ok else "ISSUES FOUND")
	return 0 if ok else 1


if __name__ == "__main__":
	sys.exit(main())
