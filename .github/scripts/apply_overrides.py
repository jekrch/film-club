#!/usr/bin/env python3
"""Overlay member-authored score/review edits onto the sheet-derived films.json.

Members edit their own scores and reviews on the site; a Cloudflare Worker
commits those edits to `src/assets/overrides.json` and never touches
`films.json`. This script folds one file into the other, which is what keeps the
two writers — the Google Sheet sync and the worker — off the same file.

The precedence rule is deliberately unconditional: **the override wins**. There
is no timestamp comparison and no "most recent writer", because reasoning about
clocks across a spreadsheet and a browser is how edits get silently discarded.
Once a member sets a value on the site, the sheet's cell for that field is
inert. `sync_sheet_to_json.py` logs every field where the two disagree so that
staleness is visible in the workflow log rather than silent.

Runs at two points, and needs both:

- Last in `sync_sheet_to_json.py`'s `main()`, so a sync never leaves overridden
  fields holding sheet values. Without it the next deploy would put them back
  and films.json would flip-flop twice a day, forever.
- As a standalone step in `deploy.yml`, so an edit goes live in about a minute
  rather than at the next scheduled sync.

With both, films.json is always exactly `sheet + overrides` and re-running is a
no-op. Depends on nothing outside the standard library — in particular not
pandas — so the deploy workflow doesn't have to install it.
"""

import json
import os
import sys

DEFAULT_FILMS_PATH = "src/assets/films.json"
DEFAULT_OVERRIDES_PATH = "src/assets/overrides.json"

# The only rating fields a member may set on the site. Everything else in an
# override record (`updatedBy`, `updatedAt`) is provenance metadata that must
# never reach films.json, so this list is a whitelist rather than a skip-list.
OVERRIDABLE_RATING_FIELDS = ("score", "scoreQualifier", "blurb")


def _find_or_create_rating(film, user):
    """Returns the film's clubRatings entry for `user`, creating it if absent.

    A member can review a film the sheet has no row for them on, so the entry
    may genuinely not exist yet. New entries match the shape the sync writes.
    """
    club_info = film.setdefault("movieClubInfo", {})
    ratings = club_info.setdefault("clubRatings", [])

    for rating in ratings:
        if str(rating.get("user", "")).lower() == user:
            return rating

    rating = {"user": user, "score": None, "blurb": None}
    ratings.append(rating)
    return rating


def apply_overrides(films_data, overrides):
    """Overlay member-authored fields onto sheet-derived film records.

    Mutates `films_data` in place and returns a list of human-readable lines
    describing every field where the sheet and the override disagreed, for the
    caller to log.

    Only keys that are *present* in an override are applied. An absent `blurb`
    means "no opinion — whatever the sheet says stands"; an explicit `null`
    means "deliberately blank, ignore the sheet". That distinction is what lets
    a member fix their score without wiping a blurb the sheet supplied.
    """
    films_by_id = {f["imdbID"]: f for f in films_data if isinstance(f, dict) and "imdbID" in f}
    divergences = []

    for imdb_id, film_override in (overrides.get("films") or {}).items():
        film = films_by_id.get(imdb_id)
        if film is None:
            # The worker refuses to write an override for an unknown film, so
            # this means the sheet dropped a film out from under one.
            print(f"Warning: override references unknown film {imdb_id}; skipping.")
            continue

        for raw_user, fields in (film_override.get("ratings") or {}).items():
            user = str(raw_user).lower()
            rating = _find_or_create_rating(film, user)

            for field in OVERRIDABLE_RATING_FIELDS:
                if field not in fields:
                    continue

                value = fields[field]
                sheet_value = rating.get(field)

                if field == "scoreQualifier" and value is None:
                    # Matches the sync's habit of omitting the key entirely
                    # rather than storing `scoreQualifier: null`.
                    rating.pop("scoreQualifier", None)
                else:
                    rating[field] = value

                # Only a cell the sheet actually filled in can go inert. A blank
                # one the member filled in on the site isn't a divergence, and
                # logging it would bury the real ones.
                if sheet_value is not None and sheet_value != value:
                    divergences.append(
                        f"{imdb_id} {user}.{field}: sheet={sheet_value!r} override={value!r}"
                    )

    return divergences


def load_overrides(overrides_path):
    """Reads overrides.json, treating a missing or malformed file as empty.

    Missing is the normal state before anyone has edited anything, and a
    malformed file should not take the whole deploy down — the site simply
    shows sheet values until it is fixed.
    """
    try:
        with open(overrides_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"No overrides file at {overrides_path}; nothing to apply.")
        return {}
    except json.JSONDecodeError as e:
        print(f"Warning: {overrides_path} is not valid JSON ({e}); ignoring it.")
        return {}

    if not isinstance(data, dict):
        print(f"Warning: {overrides_path} is not an object; ignoring it.")
        return {}
    return data


def apply_overrides_to_file(films_path, overrides_path):
    """Applies overrides to films.json on disk, writing only if it changed.

    Returns True on success (including the no-op case), False if films.json
    could not be read or written.
    """
    overrides = load_overrides(overrides_path)
    if not (overrides.get("films") or {}):
        print(f"No member overrides in {overrides_path}; {films_path} left as the sheet wrote it.")
        return True

    try:
        with open(films_path, "r", encoding="utf-8") as f:
            films_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error: could not read {films_path}: {e}")
        return False

    before = json.dumps(films_data, sort_keys=True, ensure_ascii=False)
    divergences = apply_overrides(films_data, overrides)

    for line in divergences:
        # The sheet cell is now inert for this field. Logging it is what keeps
        # the divergence noticeable to whoever later edits that cell.
        print(f"Override wins over sheet: {line}")

    if json.dumps(films_data, sort_keys=True, ensure_ascii=False) == before:
        print(f"{films_path} already matches sheet + overrides; nothing to write.")
        return True

    try:
        with open(films_path, "w", encoding="utf-8") as f:
            json.dump(films_data, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"Error writing {films_path}: {e}")
        return False

    print(f"Applied member overrides to {films_path}.")
    return True


def main():
    films_path = os.environ.get("JSON_PATH", DEFAULT_FILMS_PATH)
    overrides_path = os.environ.get("OVERRIDES_PATH", DEFAULT_OVERRIDES_PATH)
    return apply_overrides_to_file(films_path, overrides_path)


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
