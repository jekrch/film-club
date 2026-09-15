#!/usr/bin/env python3
"""Overlay member-authored edits onto the sheet-derived films.json.

The editing worker commits member edits to `src/assets/overrides.json` and never
writes `films.json`; this script merges the former into the latter.

Two kinds of edit are applied:

- **Per-member**, under `films.<id>.ratings.<user>` — score, qualifier, review.
- **Per-film**, under `films.<id>.film` — selector, watch date, poster, and
  backdrop image.

**The override always wins**; there is no timestamp comparison. Once a member
sets a value on the site, the sheet's cell for that field is ignored.
`sync_sheet_to_json.py` logs every field where the two disagree.

Runs in two places:

- At the end of `sync_sheet_to_json.py`'s `main()`, so a sync never restores
  overridden fields to sheet values.
- As a step in `deploy.yml`, so an edit goes live on the next deploy rather
  than the next scheduled sync.

films.json is always `sheet + overrides`, and re-running is a no-op. Uses only
the standard library, so the deploy workflow doesn't need pandas.
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

# The club-record fields a member may set on the film itself, mapped to where
# they live in a film entry. `selector` and `watchDate` sit inside
# `movieClubInfo`; the two images are top-level, beside OMDb's own `poster`.
# A whitelist for the same reason as the tuple above: `updatedBy`/`updatedAt` are
# provenance for humans reading overrides.json and must never reach films.json.
OVERRIDABLE_FILM_FIELDS = {
    "selector": ("movieClubInfo", "selector"),
    "watchDate": ("movieClubInfo", "watchDate"),
    "poster": (None, "poster"),
    "backdropImage": (None, "backdropImage"),
}


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


def _apply_film_fields(film, film_fields, imdb_id, divergences):
    """Overlays the per-film club record — selector, watch date, cover, backdrop.

    Same presence rule as a rating: only keys the override actually carries are
    touched, so setting a backdrop leaves the sheet's selector alone. `None` is
    an explicit "deliberately blank" and is written as `null` rather than
    dropping the key, because every reader of `movieClubInfo` already handles a
    null `watchDate` (a film the club has scheduled but not yet watched) and a
    missing key would be a third state nothing expects.

    The two image fields are the exception: they are *optional* on a film entry
    and most films have neither, so a cleared one is removed rather than left as
    `poster: null`, which the site would render as a broken image.
    """
    for field, (container, key) in OVERRIDABLE_FILM_FIELDS.items():
        if field not in film_fields:
            continue

        value = film_fields[field]
        target = film.setdefault("movieClubInfo", {}) if container == "movieClubInfo" else film
        sheet_value = target.get(key)

        if value is None and container is None:
            # An absent image is how a film without curated art is already
            # stored; a null one would reach an <img src>.
            target.pop(key, None)
        else:
            target[key] = value

        if sheet_value is not None and sheet_value != value:
            divergences.append(
                f"{imdb_id} film.{field}: sheet={sheet_value!r} override={value!r}"
            )


def apply_overrides(films_data, overrides):
    """Overlay member-authored fields onto sheet-derived film records.

    Mutates `films_data` in place and returns a list of human-readable lines
    describing every field where the sheet and the override disagreed, for the
    caller to log.

    Only keys that are *present* in an override are applied. An absent `blurb`
    means "no opinion — whatever the sheet says stands"; an explicit `null`
    means "deliberately blank, ignore the sheet". That distinction is what lets
    a member fix their score without wiping a blurb the sheet supplied, and it
    holds for the per-film block as much as for a rating.
    """
    films_by_id = {f["imdbID"]: f for f in films_data if isinstance(f, dict) and "imdbID" in f}
    divergences = []

    for imdb_id, film_override in (overrides.get("films") or {}).items():
        film = films_by_id.get(imdb_id)
        if film is None:
            # Normally impossible: the worker refuses an override for a film it
            # doesn't know, and `create_submitted_films.py` runs before this to
            # build the ones members added. Reaching here means that step could
            # not fetch the film (OMDB down) and it is still pending, or the
            # sheet dropped a film out from under an override.
            if isinstance(film_override.get("added"), dict):
                print(f"Film {imdb_id} was added on the site but isn't built yet; skipping.")
            else:
                print(f"Warning: override references unknown film {imdb_id}; skipping.")
            continue

        film_fields = film_override.get("film") or {}
        if film_fields:
            _apply_film_fields(film, film_fields, imdb_id, divergences)

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
