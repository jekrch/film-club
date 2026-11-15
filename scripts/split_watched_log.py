#!/usr/bin/env python3
"""Split `src/assets/watched.json` into one file per member.

The watch log used to be one file keyed by member name. It is now
`src/assets/watched/<slug>.json` per member, each a bare array of entries,
newest watch first (see `watchedPath` in `worker/src/github.ts`).

Safe to run more than once. If `watched.json` exists, its entries are merged
into the per-member files, where the copy with the later `updatedAt` wins, and
`watched.json` is then deleted. That covers the switchover: a save that reaches
an old worker after the split lands in a fresh `watched.json`, and running this
again folds it in.

Usage: python scripts/split_watched_log.py [assets_dir]
"""

import json
import os
import re
import sys
import unicodedata


def slugify(value):
    """The worker's `slugify` in `worker/src/validate.ts`, line for line."""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9]+", "-", value.lower())
    return value.strip("-")


def sort_key(entry):
    """Newest watch first, ties on imdbID: `sortWatched` in the worker.

    Two passes because the date sorts descending and the id ascending.
    """
    return entry.get("imdbID", "")


def sorted_entries(entries):
    by_id = sorted(entries, key=sort_key)
    return sorted(by_id, key=lambda entry: entry.get("watchDate", ""), reverse=True)


def write_json(path, data):
    # The worker's format: two-space indent, trailing newline, UTF-8 as is.
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main():
    assets = sys.argv[1] if len(sys.argv) > 1 else "src/assets"
    legacy_path = os.path.join(assets, "watched.json")
    out_dir = os.path.join(assets, "watched")

    if not os.path.exists(legacy_path):
        print(f"No {legacy_path}; nothing to split.")
        return 0

    with open(legacy_path, encoding="utf-8") as f:
        legacy = json.load(f)
    if not isinstance(legacy, dict):
        print(f"Error: {legacy_path} is not an object keyed by member name.")
        return 1

    os.makedirs(out_dir, exist_ok=True)

    for owner, entries in legacy.items():
        slug = slugify(owner)
        if not slug or not isinstance(entries, list):
            print(f"Error: can't place the log for {owner!r}.")
            return 1

        path = os.path.join(out_dir, f"{slug}.json")
        existing = []
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                existing = json.load(f)

        merged = {entry["imdbID"]: entry for entry in existing}
        for entry in entries:
            current = merged.get(entry["imdbID"])
            if current is None or entry.get("updatedAt", "") >= current.get("updatedAt", ""):
                merged[entry["imdbID"]] = entry

        write_json(path, sorted_entries(merged.values()))
        print(f"{path}: {len(merged)} entries ({len(existing)} already there).")

    os.remove(legacy_path)
    print(f"Removed {legacy_path}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
