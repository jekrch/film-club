#!/usr/bin/env python3
"""Build the poster/title cache for films that appear on member lists.

Member-curated lists are personal favorites, so most of the films on them are
ones the club never watched and which therefore have no record in films.json.
This script fetches a thin summary for each such film from OMDB and stores it in
`src/assets/listFilms.json`, keyed by IMDb id.

**List films must never become club films.** films.json drives the films page,
the almanac, and every statistic on the site; a personal favorite appearing in
it would corrupt all of them. Hence the separate cache, and hence the rule that
ids already present in films.json are never fetched or stored here.

The cache is deliberately thin -- title, year, poster, and a little context --
with no cast, keywords, or backdrops. One OMDB call per id, once ever: ids
already cached are left alone. Ids no list references any more are pruned, and
keys are written sorted, so the diff stays readable.

Runs in deploy.yml before the build, so a list saved on the site has its posters
by the time the site is rebuilt. The worker makes no OMDB call of its own on
save, which is what keeps a save cheap regardless of how long the list is.
"""

import json
import os
import re
import sys

import requests

DEFAULT_LISTS_PATH = "src/assets/lists.json"
DEFAULT_FILMS_PATH = "src/assets/films.json"
DEFAULT_LIST_FILMS_PATH = "src/assets/listFilms.json"

IMDB_ID_PATTERN = re.compile(r"^tt\d{7,9}$")

# OMDB response keys -> the summary fields we keep. Anything not listed here is
# dropped: see the "deliberately thin" note above.
SUMMARY_FIELDS = {
    "Title": "title",
    "Year": "year",
    "Poster": "poster",
    "Runtime": "runtime",
    "Genre": "genre",
    "Director": "director",
}


def _clean(value):
    """OMDB writes "N/A" for fields it has no value for; store null instead."""
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text == "N/A":
        return None
    return text


def get_omdb_summary(imdb_id, api_key):
    """Fetch the thin summary for one IMDb id, or None if OMDB can't supply it.

    A deliberately separate, `requests`-only copy of the fetch in
    sync_sheet_to_json.py rather than an import: that module pulls in pandas,
    which would then have to be installed on every deploy for the sake of
    fifteen lines. The normalization rules are kept identical on both sides, so
    either authoring path produces the same file.
    """
    url = f"https://www.omdbapi.com/?i={imdb_id}&apikey={api_key}"
    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching OMDB data for {imdb_id}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding OMDB response for {imdb_id}: {e}")
        return None

    if data.get("Response") != "True":
        print(f"OMDB has no record for {imdb_id}: {data.get('Error', 'unknown error')}")
        return None

    summary = {"imdbID": imdb_id}
    for source_key, field in SUMMARY_FIELDS.items():
        summary[field] = _clean(data.get(source_key))

    if not summary.get("title"):
        # The frontend keys its rows on a title; a summary without one is worse
        # than no summary, which renders as a placeholder row instead.
        print(f"OMDB returned no title for {imdb_id}; not caching it.")
        return None

    return summary


# Distinguishes "failed to load" from a file that legitimately holds null.
LOAD_FAILED = object()


def _load_json(path, expected_type):
    """Reads a JSON file, treating a missing one as empty.

    Returns LOAD_FAILED for anything the caller can't work with — unparseable,
    or the wrong shape — so a corrupt file stops the deploy rather than silently
    pruning the whole cache.
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"No file at {path}; treating it as empty.")
        return expected_type()
    except json.JSONDecodeError as e:
        print(f"Error: {path} is not valid JSON: {e}")
        return LOAD_FAILED

    if not isinstance(data, expected_type):
        print(f"Error: {path} should hold a JSON {expected_type.__name__}.")
        return LOAD_FAILED
    return data


def collect_referenced_ids(lists_data):
    """Every IMDb id referenced by any list, as a set.

    The union across *all* lists matters for pruning: dropping a film from one
    list must not evict a summary another list still uses.
    """
    referenced = set()
    for film_list in lists_data:
        if not isinstance(film_list, dict):
            continue
        for entry in film_list.get("entries") or []:
            imdb_id = entry.get("imdbID") if isinstance(entry, dict) else None
            if not imdb_id:
                continue
            if not IMDB_ID_PATTERN.match(imdb_id):
                print(f"Skipping malformed IMDb id in list {film_list.get('id')!r}: {imdb_id!r}")
                continue
            referenced.add(imdb_id)
    return referenced


def enrich_list_films(lists_path, films_path, list_films_path, api_key):
    """Refresh the summary cache. Returns True on success (no-op included)."""
    lists_data = _load_json(lists_path, list)
    films_data = _load_json(films_path, list)
    cache = _load_json(list_films_path, dict)
    if LOAD_FAILED in (lists_data, films_data, cache):
        return False

    club_ids = {f["imdbID"] for f in films_data if isinstance(f, dict) and "imdbID" in f}
    # A list may well contain a film the club watched; that entry resolves
    # against films.json in the frontend and needs no summary of its own.
    wanted = collect_referenced_ids(lists_data) - club_ids

    pruned = sorted(set(cache) - wanted)
    updated = {imdb_id: cache[imdb_id] for imdb_id in cache if imdb_id in wanted}
    for imdb_id in pruned:
        print(f"Pruning unreferenced summary: {imdb_id}")

    missing = sorted(wanted - set(updated))
    if missing and not api_key:
        print(f"Error: OMDB_API_KEY is not set; cannot fetch {len(missing)} new list film(s).")
        return False

    for imdb_id in missing:
        print(f"Fetching OMDB summary for list film {imdb_id}...")
        summary = get_omdb_summary(imdb_id, api_key)
        if summary:
            updated[imdb_id] = summary

    # Sorted keys so the diff of a generated file stays readable.
    ordered = {imdb_id: updated[imdb_id] for imdb_id in sorted(updated)}
    if ordered == cache:
        print(f"{list_films_path} is already up to date.")
        return True

    try:
        with open(list_films_path, "w", encoding="utf-8") as f:
            json.dump(ordered, f, indent=2, ensure_ascii=False)
            f.write("\n")
    except IOError as e:
        print(f"Error writing {list_films_path}: {e}")
        return False

    print(f"Wrote {list_films_path}: {len(ordered)} summaries ({len(missing)} fetched, {len(pruned)} pruned).")
    return True


def main():
    return enrich_list_films(
        os.environ.get("LISTS_PATH", DEFAULT_LISTS_PATH),
        os.environ.get("JSON_PATH", DEFAULT_FILMS_PATH),
        os.environ.get("LIST_FILMS_PATH", DEFAULT_LIST_FILMS_PATH),
        os.environ.get("OMDB_API_KEY"),
    )


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
