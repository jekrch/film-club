#!/usr/bin/env python3
"""Turn films members added on the site into real entries in films.json.

A member adding a film commits an intent, not a film. The editing worker owns
`overrides.json` and may never write `films.json` (§8.1), and a film record is
OMDb's response plus TMDb's — several kilobytes of crew, cast, keywords, and
stills that no browser should be trusted to assemble. So the worker writes a
small `added` marker and this script, running in CI where the API keys live,
builds the record from it.

```
overrides.json          films.json
  films.tt123.added  ──► full OMDb + TMDb entry, movieClubInfo seeded blank
                          │
                          └─► apply_overrides.py fills selector, watch date,
                              cover, backdrop, and everyone's scores
```

Runs *before* `apply_overrides.py` in `deploy.yml`, and the order is the whole
design: this script creates the entry, that one populates it. Between them a new
film gets its club fields by exactly the same path an old film's edits do, and
neither script needs to know the other's job.

Idempotent, like the rest of the derived-data steps: an id already in
`films.json` is skipped, so re-running costs one file read and nothing else.
Fetching is the same shared code the sheet sync uses (`film_fetch.py`), so a
film added here is indistinguishable from one added through the sheet.

A film OMDb can't resolve is logged and left pending rather than failing the
deploy — the worker checks the id against OMDb before accepting a submission, so
reaching that branch means OMDb was down, and the next deploy will pick it up.
"""

import json
import os
import sys

from film_fetch import PERSONS_FILENAME, build_film_entry, sync_persons_file

DEFAULT_FILMS_PATH = "src/assets/films.json"
DEFAULT_OVERRIDES_PATH = "src/assets/overrides.json"


def load_json(path, empty):
    """Reads a JSON file, treating missing or malformed as `empty`.

    Missing is the normal state for `overrides.json` before anyone has edited
    anything, and a malformed file should not take a deploy down — the site
    simply builds without the additions until it is fixed.
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"No file at {path}; treating it as empty.")
        return empty
    except json.JSONDecodeError as e:
        print(f"Warning: {path} is not valid JSON ({e}); ignoring it.")
        return empty
    return data


def submitted_ids(overrides):
    """IMDb ids carrying an `added` marker, in the order the file lists them.

    The marker is what separates a film someone added from a film someone merely
    edited: an id appears in `overrides.json` for either reason, and only the
    first is this script's business.
    """
    films = overrides.get("films") if isinstance(overrides, dict) else None
    if not isinstance(films, dict):
        return []

    ids = []
    for imdb_id, record in films.items():
        if isinstance(record, dict) and isinstance(record.get("added"), dict):
            ids.append(imdb_id)
    return ids


def create_films(films_data, overrides, omdb_api_key, tmdb_bearer_token):
    """Appends an entry for every submitted film not already in `films_data`.

    Mutates `films_data` in place and returns the number of films added. New
    entries land at the end, which is where the sheet sync puts its own and what
    the site's "most recently added" ordering expects.
    """
    known = {film.get("imdbID") for film in films_data if isinstance(film, dict)}
    added_count = 0

    for imdb_id in submitted_ids(overrides):
        if imdb_id in known:
            continue

        marker = overrides["films"][imdb_id]["added"]
        title = marker.get("title") or imdb_id
        print(f"New film submitted on the site: {title} ({imdb_id}), added by "
              f"{marker.get('addedBy', 'someone')}. Fetching...")

        entry = build_film_entry(imdb_id, omdb_api_key, tmdb_bearer_token)
        if not entry:
            # Left pending deliberately: the marker stays, so the next deploy
            # tries again rather than the film being silently dropped.
            print(f"Could not fetch {imdb_id} from OMDB. Leaving it pending.")
            continue

        # Seeded blank rather than from the override. `apply_overrides.py` runs
        # next and fills the selector, the watch date, and every score from the
        # same file, by the same code path an existing film's edits take — so
        # there is exactly one place that knows how an override becomes club data.
        entry["movieClubInfo"] = {
            "selector": None,
            "watchDate": None,
            "clubRatings": [],
            "trophyInfo": None,
            "trophyNotes": None,
        }

        films_data.append(entry)
        known.add(imdb_id)
        added_count += 1
        print(f"Added {entry.get('title', imdb_id)} to films.json.")

    return added_count


def main():
    films_path = os.environ.get("JSON_PATH", DEFAULT_FILMS_PATH)
    overrides_path = os.environ.get("OVERRIDES_PATH", DEFAULT_OVERRIDES_PATH)
    omdb_api_key = os.environ.get("OMDB_API_KEY")
    tmdb_bearer_token = os.environ.get("TMDB_KEY")

    overrides = load_json(overrides_path, {})
    pending = submitted_ids(overrides)
    if not pending:
        print(f"No films submitted on the site in {overrides_path}; nothing to create.")
        return True

    films_data = load_json(films_path, None)
    if not isinstance(films_data, list):
        print(f"Error: could not read {films_path} as a list of films.")
        return False

    if not omdb_api_key:
        print("Error: OMDB_API_KEY is not set; cannot build a film record.")
        return False

    if not tmdb_bearer_token:
        # Not fatal: the film lands with OMDB data and a version flag of 4 minus
        # nothing — see build_film_entry, which leaves the flag unset so a later
        # run backfills the crew.
        print("Warning: TMDB_KEY is not set. New films land without crew or stills.")

    added = create_films(films_data, overrides, omdb_api_key, tmdb_bearer_token)
    if added == 0:
        print("Every submitted film is already in films.json; nothing to write.")
        return True

    try:
        with open(films_path, "w", encoding="utf-8") as f:
            json.dump(films_data, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"Error writing {films_path}: {e}")
        return False

    print(f"Added {added} film(s) to {films_path}.")

    # The new films reference TMDb people nobody has a record for yet. Same call
    # the sheet sync makes, and equally independent of whether anything changed.
    persons_path = os.path.join(os.path.dirname(films_path), PERSONS_FILENAME)
    sync_persons_file(films_data, persons_path, tmdb_bearer_token)
    return True


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
