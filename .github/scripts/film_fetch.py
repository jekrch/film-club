#!/usr/bin/env python3
"""Fetching one film from OMDB and TMDb, shared by the two scripts that add films.

Films used to arrive one way — a row in the Google Sheet, materialized by
`sync_sheet_to_json.py` — so the fetching lived there. They now arrive two ways:
members add them on the site, and `create_submitted_films.py` materializes those
at deploy time. Both need the same OMDB record, the same TMDb crew, cast,
keywords, and stills, and the same `tmdbDataVersion` bookkeeping, and a film has
to come out identical whichever door it came in by.

So this module holds that logic, and both scripts import it. It is the same code
those functions have always been, moved rather than rewritten.

**It imports nothing outside the standard library except `requests`**, which is
the constraint that makes sharing possible at all: `sync_sheet_to_json.py` needs
pandas to read the sheet, `deploy.yml` installs only `requests`, and a module
that reached for pandas here would put it on every deploy.
"""

import json
import re

import requests


# --- OMDB -----------------------------------------------------------------

def to_camel_case(text):
    """Converts PascalCase or snake_case text to camelCase."""
    if not text:
        return ""
    text = re.sub(r"_([a-z])", lambda x: x.group(1).upper(), text)
    return text[0].lower() + text[1:]

def transform_keys_to_camel_case(data):
    """Converts keys in API responses from PascalCase/snake_case to camelCase."""
    if isinstance(data, dict):
        return {to_camel_case(k): transform_keys_to_camel_case(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [transform_keys_to_camel_case(elem) for elem in data]
    else:
        return data

def get_omdb_film_details(imdb_id, api_key):
    """Fetch film details from OMDB API by IMDb ID."""
    if not api_key:
        print("Error: OMDB_API_KEY is not set. Cannot fetch new film data.")
        return None
    
    url = f"https://www.omdbapi.com/?i={imdb_id}&apikey={api_key}&plot=full"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        if data.get("Response") == "True":
            return transform_keys_to_camel_case(data)
        else:
            print(f"Error fetching OMDB data for {imdb_id}: {data.get('Error', 'Unknown error')}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during OMDB API request for {imdb_id}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from OMDB for {imdb_id}: {e}")
        return None

# --- TMDb -----------------------------------------------------------------

EXPECTED_TMDB_CREW_FIELDS = [
    "cinematographer", "editor", "productionDesigner",
    "musicComposer", "costumeDesigner"
]
TMDB_FETCH_FLAG = "tmdbCrewDataFetched"
# Bump this whenever get_tmdb_film_details starts collecting new fields, so that
# already-synced films are re-fetched once to backfill the additions.
# v3: added the per-film `personProfiles` map (name -> {tmdbId, profileUrl}).
# v4: added `backdropImages` (TMDb scene stills used as faded backgrounds).
TMDB_FETCH_VERSION = 4
TMDB_VERSION_FIELD = "tmdbDataVersion"

# Base URL for TMDb cast profile images. w185 is a good balance of size/quality
# for the headshot strip rendered on the film detail page.
TMDB_PROFILE_IMAGE_BASE = "https://image.tmdb.org/t/p/w185"
# Base URL for wide backdrop/scene stills rendered as faded page backgrounds.
TMDB_BACKDROP_IMAGE_BASE = "https://image.tmdb.org/t/p/w1280"
# Number of top-billed cast members to retain per film.
TMDB_CAST_LIMIT = 12
# Number of TMDb backdrop stills to retain per film for the faded-background pool.
TMDB_BACKDROP_LIMIT = 6

# Crew jobs we resolve a TMDb person id for, so their names become clickable in
# the UI and link to a normalized person record. Director/Writer/Story are
# included even though their display names come from OMDB, so we can map those
# OMDB-sourced names back to a TMDb id (best-effort, by normalized name).
TMDB_PERSON_CREW_JOBS = {
    "Director", "Writer", "Screenplay", "Story",
    "Director of Photography", "Editor", "Production Design",
    "Original Music Composer", "Costume Design",
}

# Normalized-name file shared across films, keyed by TMDb person id. Holds the
# biographical data fetched once per person from the /person endpoint.
PERSONS_FILENAME = "persons.json"


def normalize_person_name(name):
    """Key used to match a displayed name to its TMDb person record."""
    return (name or "").strip().lower()


def get_tmdb_film_details(imdb_id, tmdb_bearer_token):
    """Fetch extended film data from TMDb by IMDb ID using Bearer Token.

    Returns a flat dict that is merged onto the film entry, containing crew
    fields (cinematographer, editor, ...) plus tagline, budget, revenue,
    keywords, the primary trailer key, a top-billed cast list, and a
    `personProfiles` map (normalized name -> {tmdbId, profileUrl}) used by the
    UI to link credited people to their person modal/record. A single details
    request with append_to_response pulls credits/keywords/videos at once.
    """
    if not tmdb_bearer_token:
        print("Warning: TMDB_KEY (Bearer Token) is not set. Cannot fetch additional crew data.")
        return None

    headers = {
        "Authorization": f"Bearer {tmdb_bearer_token}",
        "accept": "application/json"
    }

    find_url = f"https://api.themoviedb.org/3/find/{imdb_id}?external_source=imdb_id"
    tmdb_movie_id = None
    media_type = None
    try:
        response = requests.get(find_url, headers=headers)
        response.raise_for_status()
        find_data = response.json()
        if find_data.get("movie_results") and len(find_data["movie_results"]) > 0:
            tmdb_movie_id = find_data["movie_results"][0]["id"]
            media_type = "movie"
        elif find_data.get("tv_results") and len(find_data["tv_results"]) > 0:
            tmdb_movie_id = find_data["tv_results"][0]["id"]
            media_type = "tv"
            print(f"Note: IMDb ID {imdb_id} found as a TV result on TMDb. Fetching TV credits.")
        else:
            print(f"Error: Could not find TMDb ID for IMDb ID {imdb_id} in movie or TV results. Response: {find_data}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during TMDb find request for {imdb_id}: {e}. Response text: {e.response.text if e.response else 'No response'}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from TMDb find for {imdb_id}: {e}")
        return None

    if not tmdb_movie_id or not media_type:
        return None

    details_url = (
        f"https://api.themoviedb.org/3/{media_type}/{tmdb_movie_id}"
        "?append_to_response=credits,keywords,videos,images"
        # Restrict backdrops to textless (no language) and English stills so the
        # faded backgrounds are clean scene imagery, not foreign title cards.
        "&include_image_language=en,null"
    )
    extracted = {}
    try:
        response = requests.get(details_url, headers=headers)
        response.raise_for_status()
        data = response.json()

        # Per-film index mapping a normalized person name to their TMDb id and
        # profile image. Powers the clickable-name -> person-modal lookup in the
        # UI. First non-null profile for a given name wins.
        person_profiles = {}

        def register_person(name, person_id, profile_path):
            if not name or not person_id:
                return
            key = normalize_person_name(name)
            if not key:
                return
            existing = person_profiles.get(key)
            profile_url = f"{TMDB_PROFILE_IMAGE_BASE}{profile_path}" if profile_path else None
            if existing is None:
                person_profiles[key] = {"tmdbId": person_id, "profileUrl": profile_url}
            elif existing.get("profileUrl") is None and profile_url is not None:
                existing["profileUrl"] = profile_url

        # --- Crew (preserves original field set/format) ---
        credits_data = data.get("credits", {})
        if "crew" in credits_data:
            job_to_names = {}
            target_jobs = {
                "Director of Photography": "cinematographer",
                "Editor": "editor",
                "Production Design": "productionDesigner",
                "Original Music Composer": "musicComposer",
                "Costume Design": "costumeDesigner",
            }

            for crew_member in credits_data["crew"]:
                job = crew_member.get("job")
                name = crew_member.get("name")
                if not job or not name:
                    continue
                if job in target_jobs:
                    field_name = target_jobs[job]
                    job_to_names.setdefault(field_name, []).append(name)
                if job in TMDB_PERSON_CREW_JOBS:
                    register_person(name, crew_member.get("id"), crew_member.get("profile_path"))

            for field, names in job_to_names.items():
                extracted[field] = ", ".join(sorted(list(set(names))))

        # --- Cast (top-billed, with characters and profile images) ---
        cast_members = credits_data.get("cast", [])
        cast = []
        for member in sorted(cast_members, key=lambda c: c.get("order", 9999))[:TMDB_CAST_LIMIT]:
            name = member.get("name")
            if not name:
                continue
            profile_path = member.get("profile_path")
            cast.append({
                "name": name,
                "character": member.get("character") or None,
                "profileUrl": f"{TMDB_PROFILE_IMAGE_BASE}{profile_path}" if profile_path else None,
            })
            register_person(name, member.get("id"), profile_path)
        if cast:
            extracted["cast"] = cast

        if person_profiles:
            extracted["personProfiles"] = person_profiles

        # --- Tagline / financials (movies only; TV omits budget/revenue) ---
        tagline = data.get("tagline")
        if tagline:
            extracted["tagline"] = tagline
        budget = data.get("budget")
        if isinstance(budget, int) and budget > 0:
            extracted["budget"] = budget
        revenue = data.get("revenue")
        if isinstance(revenue, int) and revenue > 0:
            extracted["revenue"] = revenue

        # --- Keywords (movies use "keywords", TV uses "results") ---
        keywords_block = data.get("keywords", {})
        raw_keywords = keywords_block.get("keywords") or keywords_block.get("results") or []
        keywords = [kw["name"] for kw in raw_keywords if kw.get("name")]
        if keywords:
            extracted["keywords"] = keywords

        # --- Trailer (prefer an official YouTube trailer) ---
        videos = data.get("videos", {}).get("results", [])
        youtube_trailers = [
            v for v in videos
            if v.get("site") == "YouTube" and v.get("type") == "Trailer" and v.get("key")
        ]
        if youtube_trailers:
            official = next((v for v in youtube_trailers if v.get("official")), None)
            extracted["trailerKey"] = (official or youtube_trailers[0])["key"]

        # --- Backdrops (wide scene stills used as faded page backgrounds) ---
        # Prefer textless stills (iso_639_1 is null), then highest community
        # rating. These supplement the hand-curated `backdropImage` for the many
        # films that have none.
        backdrops = (data.get("images") or {}).get("backdrops") or []
        backdrops.sort(
            key=lambda b: (b.get("iso_639_1") is not None, -(b.get("vote_average") or 0))
        )
        backdrop_urls = [
            f"{TMDB_BACKDROP_IMAGE_BASE}{b['file_path']}"
            for b in backdrops[:TMDB_BACKDROP_LIMIT]
            if b.get("file_path")
        ]
        if backdrop_urls:
            extracted["backdropImages"] = backdrop_urls

        return extracted

    except requests.exceptions.RequestException as e:
        print(f"Error during TMDb details request for {imdb_id} (TMDb ID: {tmdb_movie_id}, Type: {media_type}): {e}. Response text: {e.response.text if e.response else 'No response'}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from TMDb details for {imdb_id}: {e}")
        return None

def get_tmdb_person_details(person_id, tmdb_bearer_token):
    """Fetch normalized biographical data for a single TMDb person id.

    Returns the record stored (per id) in persons.json, or None on failure.
    """
    if not tmdb_bearer_token or not person_id:
        return None

    headers = {
        "Authorization": f"Bearer {tmdb_bearer_token}",
        "accept": "application/json",
    }
    url = f"https://api.themoviedb.org/3/person/{person_id}"
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error during TMDb person request for {person_id}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding TMDb person response for {person_id}: {e}")
        return None

    profile_path = data.get("profile_path")
    return {
        "tmdbId": person_id,
        "name": data.get("name"),
        "biography": data.get("biography") or None,
        "birthday": data.get("birthday") or None,
        "deathday": data.get("deathday") or None,
        "placeOfBirth": data.get("place_of_birth") or None,
        "knownForDepartment": data.get("known_for_department") or None,
        "profileUrl": f"{TMDB_PROFILE_IMAGE_BASE}{profile_path}" if profile_path else None,
    }


def sync_persons_file(films_data, persons_path, tmdb_bearer_token):
    """Fetch and cache biographical data for every TMDb person referenced by any
    film's `personProfiles`. Only ids not already cached are fetched, so reruns
    are cheap. Writes the (id -> PersonInfo) map back to persons_path.

    Returns True if persons.json was modified.
    """
    if not tmdb_bearer_token:
        print("TMDB_KEY not set. Skipping persons.json sync.")
        return False

    try:
        with open(persons_path, "r", encoding="utf-8") as f:
            persons = json.load(f)
        if not isinstance(persons, dict):
            persons = {}
    except (FileNotFoundError, json.JSONDecodeError):
        persons = {}

    referenced_ids = set()
    for film in films_data:
        for profile in (film.get("personProfiles") or {}).values():
            person_id = profile.get("tmdbId")
            if person_id:
                referenced_ids.add(person_id)

    missing_ids = [pid for pid in referenced_ids if str(pid) not in persons]
    if not missing_ids:
        print(f"persons.json is up to date ({len(persons)} people, no new ids).")
        return False

    print(f"Fetching {len(missing_ids)} new person record(s) from TMDb...")
    fetched = 0
    for person_id in sorted(missing_ids):
        info = get_tmdb_person_details(person_id, tmdb_bearer_token)
        if info:
            persons[str(person_id)] = info
            fetched += 1

    if fetched == 0:
        return False

    try:
        with open(persons_path, "w", encoding="utf-8") as f:
            json.dump(persons, f, indent=2, ensure_ascii=False, sort_keys=True)
        print(f"Wrote {persons_path} with {fetched} new person record(s) ({len(persons)} total).")
        return True
    except IOError as e:
        print(f"Error writing persons file {persons_path}: {e}")
        return False


# --- Whole films ----------------------------------------------------------

def build_film_entry(imdb_id, omdb_api_key, tmdb_bearer_token):
    """Fetches one film from OMDB and TMDb and returns the entry films.json stores.

    The whole of what it takes to turn an IMDb id into a film record, including
    the two flags that stop a later sync from re-fetching it. Returns None when
    OMDB has nothing, which is the one failure that makes a film impossible —
    TMDb going missing only costs the crew, and the version flag left behind lets
    a later run backfill it.
    """
    entry = get_omdb_film_details(imdb_id, omdb_api_key)
    if not entry:
        return None

    entry[TMDB_FETCH_FLAG] = False
    entry[TMDB_VERSION_FIELD] = 0

    if not tmdb_bearer_token:
        print("TMDB_KEY (Bearer Token) not provided. Skipping TMDb data for {}.".format(imdb_id))
        return entry

    tmdb_data = get_tmdb_film_details(imdb_id, tmdb_bearer_token)
    if tmdb_data:
        for key, value in tmdb_data.items():
            entry[key] = value
        print(f"Added TMDb data for {imdb_id}: {list(tmdb_data.keys())}")
    else:
        print(f"Could not fetch or process TMDb data for {imdb_id}.")

    # Set even when the fetch failed, matching the sheet path: the flag records
    # that the attempt was made at this version, and a later bump re-tries it.
    entry[TMDB_FETCH_FLAG] = True
    entry[TMDB_VERSION_FIELD] = TMDB_FETCH_VERSION
    return entry
