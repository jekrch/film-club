#!/usr/bin/env python3
"""Build the poster/title cache for films that appear in member-authored data.

Three files reference films the club never watched: `lists.json` (personal
rankings), `watched.json` (what members watched on their own), and `club.json`
(the handful of films a member may name for their profile banner). None of those
kinds has a record in films.json. This script fetches a thin summary for each
such film from OMDB and stores it in `src/assets/listFilms.json`, keyed by IMDb
id; every side of the frontend reads that one cache.

**Neither kind may become a club film.** films.json drives the films page, the
almanac, and every statistic on the site; a personal favorite or a solo watch
appearing in it would corrupt all of them. Hence the separate cache, and hence
the rule that ids already present in films.json are never fetched or stored
here.

Two sources fill one record. OMDB supplies the identity -- title, year, poster,
and a line of context -- at one call per id, once ever. TMDb supplies what OMDB
has none of: the trailer, the tagline, a summary, the top-billed cast, and wide
scene art for the row backgrounds. Ids no list references any more are pruned,
and keys are written sorted, so the diff stays readable.

The TMDb half is two calls per film (`find` to turn an IMDb id into a TMDb one,
then one details request with credits, videos, and images appended) and is
version-stamped rather than presence-checked: a summary carrying the current
TMDB_VERSION is never fetched again, and bumping that constant is how a new
field gets backfilled across films cached before it existed. A film TMDb answered
about but has no trailer for stores `trailerKey: null` -- "asked, there is none",
which is not the same as "not asked yet". A request that *failed* stamps nothing,
so an outage costs a retry on the next deploy rather than a permanently empty
record. Without TMDB_KEY the whole half is skipped: the posters still land, and
the next deploy that has the key fills the rest in.

**The cache stays deliberately thinner than a club film.** No keywords, no
financials, no `personProfiles` index -- a person's TMDb id rides on their own
cast or crew entry. The crew is the three credits a row shows rather than the
club films' seven. This file is bundled and shipped to every visitor, and unlike
films.json (one film per club meeting) it grows with whatever members add, so
each field here is a per-visitor cost paid on the whole cache.

Runs in deploy.yml before the build, so a list or a watch logged on the site has
its posters by the time the site is rebuilt. The worker makes no OMDB call of
its own on save, which is what keeps a save cheap regardless of how long the
list is.
"""

import json
import os
import re
import sys

import requests

DEFAULT_LISTS_PATH = "src/assets/lists.json"
DEFAULT_WATCHED_PATH = "src/assets/watched.json"
DEFAULT_CLUB_PATH = "src/assets/club.json"
DEFAULT_FILMS_PATH = "src/assets/films.json"
DEFAULT_LIST_FILMS_PATH = "src/assets/listFilms.json"

IMDB_ID_PATTERN = re.compile(r"^tt\d{7,9}$")

# Bump when the OMDB fields below change, so films cached under an older stamp
# are fetched again. The TMDb half has its own stamp for the same reason -- the
# two sources are asked at different times and drift apart otherwise.
# v1: title, year, poster, runtime, genre, director.
# v2: added writer and the external ratings.
OMDB_VERSION = 2
OMDB_VERSION_FIELD = "omdbVersion"

# OMDB response keys -> the summary fields we keep. Anything not listed here is
# dropped: see the "deliberately thin" note above. Named for the club films'
# own fields, so one panel component renders either shape.
SUMMARY_FIELDS = {
    "Title": "title",
    "Year": "year",
    "Poster": "poster",
    "Runtime": "runtime",
    "Genre": "genre",
    "Director": "director",
    "Writer": "writer",
    "imdbRating": "imdbRating",
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

    # IMDb, Rotten Tomatoes, Metacritic -- whichever OMDB has, lowercased to the
    # keys films.json uses. A score frozen at the moment the film was added: this
    # is fetched once per OMDB_VERSION, so bumping that constant is also how a
    # stale Rotten Tomatoes percentage gets refreshed.
    ratings = [
        {"source": r["Source"], "value": r["Value"]}
        for r in (data.get("Ratings") or [])
        if isinstance(r, dict) and r.get("Source") and r.get("Value")
    ]
    if ratings:
        summary["ratings"] = ratings

    summary[OMDB_VERSION_FIELD] = OMDB_VERSION

    if not summary.get("title"):
        # The frontend keys its rows on a title; a summary without one is worse
        # than no summary, which renders as a placeholder row instead.
        print(f"OMDB returned no title for {imdb_id}; not caching it.")
        return None

    return summary


# Bump this when the fields below change, so films cached under an older stamp
# are looked up again. Mirrors TMDB_FETCH_VERSION in sync_sheet_to_json.py, and
# for the same reason: a new field is worthless if only films added afterwards
# have it.
# v1: trailerKey.
# v2: added tagline, plot, cast, and backdropImages.
# v3: added cinematographer, and raised the backdrop count for the stills strip.
# v4: replaced the cinematographer string with a `crew` list carrying headshots
#     and TMDb ids, so the crew renders as person cards like the cast does.
TMDB_VERSION = 4
TMDB_VERSION_FIELD = "tmdbVersion"

# What one TMDb lookup contributes, and therefore what a re-stamp overwrites.
TMDB_FIELDS = ("trailerKey", "tagline", "plot", "cast", "backdropImages", "crew")

# Fields an older version wrote that the current one doesn't. Popped on re-stamp,
# so a retired field leaves the cache instead of lingering on whichever records
# happened to be written while it existed.
TMDB_RETIRED_FIELDS = ("cinematographer",)

# The crew jobs worth a card, in the order they should read. Taken from TMDb
# rather than OMDB even for the director, whose name OMDB also gives: only TMDb
# supplies the person id and the headshot that make a card a face and a link.
# Editor, composer and the rest are a film page's detail, not a row's.
TMDB_CREW_JOBS = ("Director", "Writer", "Screenplay", "Story", "Director of Photography")

# A film with eleven credited writers gets the first few. Bounded because every
# entry is ~120 bytes on a file the whole site downloads.
TMDB_CREW_LIMIT = 6

TMDB_PROFILE_IMAGE_BASE = "https://image.tmdb.org/t/p/w185"
TMDB_BACKDROP_IMAGE_BASE = "https://image.tmdb.org/t/p/w1280"

# Deliberately smaller than the club films' twelve. These render in a row's
# expanded panel rather than on a page of their own, and every one of them is
# bytes in the bundle for every visitor.
TMDB_CAST_LIMIT = 8

# The row wash takes the first; the panel's stills strip opens the lot in a
# lightbox. Matches the club films' limit -- a still is one short URL, and this
# is the only look at a film the site has for one the club never watched.
TMDB_BACKDROP_LIMIT = 6

# Distinguishes "TMDb answered and had nothing" from "the request failed", which
# is the difference between stamping a summary done and retrying it next deploy.
TMDB_FAILED = object()


def _tmdb_get(url, tmdb_bearer_token, what):
    """One TMDb request. Returns the parsed body, or TMDB_FAILED."""
    headers = {"Authorization": f"Bearer {tmdb_bearer_token}", "accept": "application/json"}
    try:
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()
        return response.json()
    except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
        print(f"Error fetching {what}: {e}")
        return TMDB_FAILED


def _pick_trailer(videos):
    """The primary YouTube trailer's key, official preferred, or None.

    The same rule get_tmdb_film_details applies to club films, so a film on a
    list and a film in the club end up pointing at the same video.
    """
    trailers = [
        v for v in videos
        if v.get("site") == "YouTube" and v.get("type") == "Trailer" and v.get("key")
    ]
    if not trailers:
        return None
    official = next((v for v in trailers if v.get("official")), None)
    return (official or trailers[0])["key"]


def _pick_cast(credits):
    """Top-billed cast, each with the TMDb id that makes the name a link.

    Club films resolve a name to an id through the per-film `personProfiles`
    map, because the club's person modal is keyed by name. Nothing here has a
    modal to open -- a cache film's cast member has no club filmography -- so the
    id rides on the entry itself and the name links straight out to TMDb.
    """
    members = sorted(credits.get("cast") or [], key=lambda c: c.get("order", 9999))
    cast = []
    for member in members[:TMDB_CAST_LIMIT]:
        name = member.get("name")
        if not name:
            continue
        profile_path = member.get("profile_path")
        cast.append({
            "name": name,
            "character": member.get("character") or None,
            "profileUrl": f"{TMDB_PROFILE_IMAGE_BASE}{profile_path}" if profile_path else None,
            "tmdbId": member.get("id"),
        })
    return cast


def _pick_backdrops(images):
    """Wide scene art for the row backgrounds, textless first.

    Same ordering as the club films' backdrops: an image with no language on it
    is a clean frame, one with a language is usually a title card.
    """
    backdrops = sorted(
        (images or {}).get("backdrops") or [],
        key=lambda b: (b.get("iso_639_1") is not None, -(b.get("vote_average") or 0)),
    )
    return [
        f"{TMDB_BACKDROP_IMAGE_BASE}{b['file_path']}"
        for b in backdrops[:TMDB_BACKDROP_LIMIT]
        if b.get("file_path")
    ]


def _pick_crew(credits):
    """The crew worth a card, each with the id and headshot that make it one.

    Ordered by job rather than by TMDb's own crew order, so every film's panel
    reads director-first. The raw job string is stored, not a display label: what
    a row calls "Cinematography" is a frontend decision, and changing it should
    not mean refetching every film.
    """
    people = []
    seen = set()
    for member in credits.get("crew") or []:
        job, name = member.get("job"), member.get("name")
        if job not in TMDB_CREW_JOBS or not name:
            continue
        # One card per person per job: TMDb credits some people twice.
        key = (name.strip().lower(), job)
        if key in seen:
            continue
        seen.add(key)
        profile_path = member.get("profile_path")
        people.append({
            "name": name,
            "job": job,
            "profileUrl": f"{TMDB_PROFILE_IMAGE_BASE}{profile_path}" if profile_path else None,
            "tmdbId": member.get("id"),
        })

    people.sort(key=lambda p: TMDB_CREW_JOBS.index(p["job"]))
    return people[:TMDB_CREW_LIMIT]


def get_tmdb_details(imdb_id, tmdb_bearer_token):
    """Everything TMDb contributes to one summary, or TMDB_FAILED.

    Two requests, because TMDb is keyed by its own ids: `find` turns the IMDb id
    into one, and a single details call appends credits, videos, and images to
    the record. Adding a field to TMDB_FIELDS costs nothing extra at request
    time -- it is already in this response.

    An id TMDb has no record of answers with empty fields rather than
    TMDB_FAILED: that is an answer, and re-asking it every deploy would be two
    requests a film forever.
    """
    found = _tmdb_get(
        f"https://api.themoviedb.org/3/find/{imdb_id}?external_source=imdb_id",
        tmdb_bearer_token,
        f"TMDb id for {imdb_id}",
    )
    if found is TMDB_FAILED:
        return TMDB_FAILED

    tmdb_id = None
    for media_type in ("movie", "tv"):
        results = found.get(f"{media_type}_results") or []
        if results:
            tmdb_id = results[0].get("id")
            break

    if not tmdb_id:
        print(f"TMDb has no record for {imdb_id}; storing an empty enrichment.")
        return {field: None for field in TMDB_FIELDS}

    data = _tmdb_get(
        f"https://api.themoviedb.org/3/{media_type}/{tmdb_id}"
        "?append_to_response=credits,videos,images"
        # Textless and English stills only, so a row's background is scene art
        # rather than a foreign title card.
        "&include_image_language=en,null",
        tmdb_bearer_token,
        f"TMDb details for {imdb_id}",
    )
    if data is TMDB_FAILED:
        return TMDB_FAILED

    credits = data.get("credits") or {}

    return {
        "trailerKey": _pick_trailer((data.get("videos") or {}).get("results") or []),
        "crew": _pick_crew(credits) or None,
        "tagline": _clean(data.get("tagline")),
        # TMDb calls it the overview; the field is named for the club films' own
        # `plot` so one panel component can render either shape.
        "plot": _clean(data.get("overview")),
        "cast": _pick_cast(credits) or None,
        "backdropImages": _pick_backdrops(data.get("images")) or None,
    }


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


def _collect_ids(entries, source):
    """The valid IMDb ids among a sequence of `{"imdbID": ...}` records."""
    found = set()
    for entry in entries or []:
        imdb_id = entry.get("imdbID") if isinstance(entry, dict) else None
        if not imdb_id:
            continue
        if not IMDB_ID_PATTERN.match(imdb_id):
            print(f"Skipping malformed IMDb id in {source}: {imdb_id!r}")
            continue
        found.add(imdb_id)
    return found


def _collect_bare_ids(ids, source):
    """The valid IMDb ids among a sequence of plain id strings.

    The banner selection stores ids rather than records — there is nothing else
    to say about a film that is only there to supply a picture — so it needs its
    own collector rather than `_collect_ids`.
    """
    found = set()
    for imdb_id in ids or []:
        if not isinstance(imdb_id, str):
            continue
        if not IMDB_ID_PATTERN.match(imdb_id):
            print(f"Skipping malformed IMDb id in {source}: {imdb_id!r}")
            continue
        found.add(imdb_id)
    return found


def collect_referenced_ids(lists_data, watched_data, club_data):
    """Every IMDb id referenced by a list, a watch log, or a profile banner.

    The union across *all* of them matters for pruning: dropping a film from one
    list must not evict a summary another list — or somebody's watch log, or the
    banner on their profile — still uses.
    """
    referenced = set()
    for film_list in lists_data:
        if not isinstance(film_list, dict):
            continue
        referenced |= _collect_ids(film_list.get("entries"), f"list {film_list.get('id')!r}")

    for owner, entries in watched_data.items():
        if not isinstance(entries, list):
            print(f"Skipping watch log for {owner!r}: expected a list of entries.")
            continue
        referenced |= _collect_ids(entries, f"{owner}'s watch log")

    for member in club_data:
        if not isinstance(member, dict):
            continue
        referenced |= _collect_bare_ids(
            member.get("backdropFilms"), f"{member.get('name')!r}'s banner"
        )

    return referenced


def add_tmdb_details(summaries, tmdb_bearer_token):
    """Fills the TMDb half of every summary not already stamped current.

    Runs over the whole cache rather than only the films fetched this time, so
    bumping TMDB_VERSION backfills films cached before a field existed instead of
    leaving the site with two generations of record. A summary already carrying
    the current stamp is skipped, which is what keeps this one lookup per film
    per version.

    Empty fields are dropped rather than stored as null, with one exception:
    `trailerKey` keeps its null, because the frontend reads absent as "the member
    may still be waiting on CI" and null as "there is none". Everything else
    reads the same either way, and an absent key is smaller.
    """
    stale = [
        imdb_id
        for imdb_id, summary in summaries.items()
        if summary.get(TMDB_VERSION_FIELD) != TMDB_VERSION
    ]
    if not stale:
        return

    if not tmdb_bearer_token:
        print(f"TMDB_KEY is not set; leaving {len(stale)} film(s) unenriched for now.")
        return

    for imdb_id in stale:
        summary = summaries[imdb_id]
        details = get_tmdb_details(imdb_id, tmdb_bearer_token)
        if details is TMDB_FAILED:
            # Left unstamped on purpose: the next deploy tries again rather than
            # recording an outage as "this film has nothing".
            print(f"Leaving {imdb_id} unenriched; TMDb did not answer.")
            continue

        for field in TMDB_FIELDS:
            value = details.get(field)
            if value is None and field != "trailerKey":
                summary.pop(field, None)
            else:
                summary[field] = value
        for field in TMDB_RETIRED_FIELDS:
            summary.pop(field, None)
        summary[TMDB_VERSION_FIELD] = TMDB_VERSION
        print(
            f"Enriched {imdb_id}: "
            + ", ".join(f for f in TMDB_FIELDS if summary.get(f) is not None)
        )


def enrich_list_films(
    lists_path, watched_path, films_path, list_films_path, api_key, tmdb_key=None, club_path=None
):
    """Refresh the summary cache. Returns True on success (no-op included)."""
    lists_data = _load_json(lists_path, list)
    watched_data = _load_json(watched_path, dict)
    films_data = _load_json(films_path, list)
    club_data = _load_json(club_path or DEFAULT_CLUB_PATH, list)
    cache = _load_json(list_films_path, dict)
    if LOAD_FAILED in (lists_data, watched_data, films_data, club_data, cache):
        return False

    club_film_ids = {f["imdbID"] for f in films_data if isinstance(f, dict) and "imdbID" in f}
    # A list, a watch log, or a banner may well name a film the club watched;
    # that one resolves against films.json in the frontend and needs no summary.
    wanted = collect_referenced_ids(lists_data, watched_data, club_data) - club_film_ids

    pruned = sorted(set(cache) - wanted)
    # Copied rather than aliased: the enrichment passes fill fields in place, and
    # a summary shared with `cache` would make the "already up to date"
    # comparison below compare the file against itself and skip the write.
    updated = {imdb_id: dict(cache[imdb_id]) for imdb_id in cache if imdb_id in wanted}
    for imdb_id in pruned:
        print(f"Pruning unreferenced summary: {imdb_id}")

    missing = sorted(wanted - set(updated))
    # Cached under an older OMDB_VERSION: the record is usable, it just predates
    # a field. Refetched like the TMDb half, and merged rather than replaced so a
    # film doesn't lose its TMDb enrichment to an OMDB refresh.
    stale = sorted(
        imdb_id
        for imdb_id, summary in updated.items()
        if summary.get(OMDB_VERSION_FIELD) != OMDB_VERSION
    )

    if not api_key:
        if missing:
            # A film with no summary at all has no title, and renders as a
            # placeholder row — worth failing the deploy over, unlike a refresh.
            print(f"Error: OMDB_API_KEY is not set; cannot fetch {len(missing)} new list film(s).")
            return False
        if stale:
            print(f"OMDB_API_KEY is not set; leaving {len(stale)} film(s) on an older record.")

    if api_key:
        for imdb_id in missing:
            print(f"Fetching OMDB summary for list film {imdb_id}...")
            summary = get_omdb_summary(imdb_id, api_key)
            if summary:
                updated[imdb_id] = summary

        for imdb_id in stale:
            print(f"Refreshing OMDB summary for {imdb_id}...")
            summary = get_omdb_summary(imdb_id, api_key)
            if summary:
                # A failed refresh leaves the old record unstamped, so the next
                # deploy tries again — the same rule the TMDb half follows.
                updated[imdb_id].update(summary)

    add_tmdb_details(updated, tmdb_key)

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
        os.environ.get("WATCHED_PATH", DEFAULT_WATCHED_PATH),
        os.environ.get("JSON_PATH", DEFAULT_FILMS_PATH),
        os.environ.get("LIST_FILMS_PATH", DEFAULT_LIST_FILMS_PATH),
        os.environ.get("OMDB_API_KEY"),
        os.environ.get("TMDB_KEY"),
        os.environ.get("CLUB_PATH", DEFAULT_CLUB_PATH),
    )


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
