#!/usr/bin/env python3
"""
Script to sync data from a Google Sheet to a JSON file for a film club website.
This script reads from a public Google Sheet:
- Updates existing film entries with ratings, blurbs, and other club-specific info, maintaining original order.
- Fetches data from OMDB for new IMDb IDs found in the sheet and appends them.
- Fetches additional crew data (like cinematographer) from TMDb using Bearer Token authentication.
  It uses a flag 'tmdbCrewDataFetched' to ensure TMDb data is fetched only once per film.
- Adds these new films to the JSON file.
"""

import os
import json
import pandas as pd
import requests
import re

# Sibling script (both live in .github/scripts, which is sys.path[0] when this
# runs). Member edits made on the site are overlaid onto the sheet's output as
# the last step of main() -- see that call site and apply_overrides.py's module
# docstring for why the sync needs it even though deploy.yml runs it too.
from apply_overrides import DEFAULT_OVERRIDES_PATH, apply_overrides_to_file

# Sibling module, pandas-free, shared with `create_submitted_films.py`: fetching a
# film from OMDB and TMDb is the same job whether the film came from the sheet or
# from a member adding it on the site, and both paths must produce the identical
# record. See that module's docstring.
from film_fetch import (
    TMDB_FETCH_FLAG,
    TMDB_FETCH_VERSION,
    TMDB_VERSION_FIELD,
    PERSONS_FILENAME,
    build_film_entry,
    get_tmdb_film_details,
    sync_persons_file,
)

# --- Helper Functions ---

def parse_score_and_qualifier(raw_value):
    """Parses a sheet rating cell into a (score, qualifier) pair.

    Ratings are normally numeric (e.g. "7.5"), but a member may append a single
    trailing letter as a qualifier (e.g. "7.5d" -- Joey's marker for a score he
    considers only comprehensible within the documentary medium). The numeric
    part is returned as an int/float and the letter as a lowercase string so the
    stored `score` stays numeric for averaging while the qualifier is preserved.

    Returns (None, None) for blank cells and (raw_value, None) for values that
    are neither numeric nor numeric-plus-letter (preserving prior behavior of
    keeping unparseable values as-is).
    """
    if pd.isna(raw_value):
        return None, None
    text = str(raw_value).strip()
    if text == "":
        return None, None
    match = re.fullmatch(r"(-?\d+(?:\.\d+)?)\s*([A-Za-z])?", text)
    if not match:
        return raw_value, None
    number = float(match.group(1))
    score = int(number) if number.is_integer() else number
    qualifier = match.group(2).lower() if match.group(2) else None
    return score, qualifier


def get_sheet_data(sheet_id):
    """Fetch data from public Google Sheet using direct CSV export."""
    csv_export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    try:
        response = requests.get(csv_export_url)
        response.raise_for_status()
        df = pd.read_csv(pd.io.common.StringIO(response.text))
        df.columns = [col.strip().lower().replace(' ', '_') for col in df.columns]
        if 'imdb_id' not in df.columns:
            print("Error: 'imdb_id' column not found in the Google Sheet.")
            return None
        df = df.astype(object).where(pd.notnull(df), None)
        return df
    except requests.exceptions.RequestException as e:
        print(f"Error fetching Google Sheet: {e}")
        return None
    except Exception as e:
        print(f"Error processing Google Sheet data: {e}")
        return None

def update_json_from_sheet(sheet_df, json_path, omdb_api_key, tmdb_bearer_token):
    """Update JSON file with data from Sheet dataframe and fetch new films from OMDB and TMDb."""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            films_data = json.load(f)
    except FileNotFoundError:
        print(f"Warning: JSON file {json_path} not found. Will create a new one.")
        films_data = []
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {json_path}: {e}. Starting with an empty list.")
        films_data = []

    # Create a dictionary for quick lookup of existing films by IMDb ID
    # This helps in updating existing films in-place without changing their order in films_data list.
    films_dict = {film['imdbID']: film for film in films_data if 'imdbID' in film}
    
    # Keep track of IMDb IDs already processed from the sheet to avoid duplicate appends if sheet has duplicates
    processed_sheet_ids = set() 
    new_films_to_append = [] # Store new films temporarily before appending

    users = ["andy", "gabe", "jacob", "joey", "greg"]
    changes_made = False

    for _, row in sheet_df.iterrows():
        imdb_id_sheet = row.get('imdb_id')
        if not imdb_id_sheet or pd.isna(imdb_id_sheet) or imdb_id_sheet in processed_sheet_ids:
            if imdb_id_sheet in processed_sheet_ids:
                print(f"Skipping duplicate IMDb ID from sheet: {imdb_id_sheet}")
            continue
        
        processed_sheet_ids.add(imdb_id_sheet)

        watch_date_sheet = row.get('watch_date')
        selector_sheet = row.get('selected_by') 
        trophy_notes_sheet = row.get('trophy_notes')
        
        # Check if the film already exists in our JSON data (loaded into films_dict)
        if imdb_id_sheet in films_dict: 
            movie_to_update = films_dict[imdb_id_sheet] # Get reference to the film object in films_data
            initial_movie_state_str = json.dumps(movie_to_update, sort_keys=True) 

            # Update club-specific info
            if 'movieClubInfo' not in movie_to_update:
                movie_to_update['movieClubInfo'] = {"clubRatings": [], "trophyInfo": None}
            
            if watch_date_sheet and movie_to_update['movieClubInfo'].get('watchDate') != watch_date_sheet:
                movie_to_update['movieClubInfo']['watchDate'] = watch_date_sheet
            
            if selector_sheet and movie_to_update['movieClubInfo'].get('selector') != selector_sheet:
                movie_to_update['movieClubInfo']['selector'] = selector_sheet

            if 'trophy_notes' in row: 
                current_trophy_notes = movie_to_update['movieClubInfo'].get('trophyNotes')
                new_trophy_notes = None if pd.isna(trophy_notes_sheet) else trophy_notes_sheet
                # Only update if current value is null/None and sheet has a non-null value
                if current_trophy_notes is None and new_trophy_notes is not None:
                    movie_to_update['movieClubInfo']['trophyNotes'] = new_trophy_notes
            
            if 'clubRatings' not in movie_to_update['movieClubInfo']:
                movie_to_update['movieClubInfo']['clubRatings'] = []
            
            # Update user ratings and blurbs
            current_ratings_dict = {r['user'].lower(): r for r in movie_to_update['movieClubInfo']['clubRatings']}
            
            for user in users:
                rating_col, blurb_col = f'{user}_rating', f'{user}_blurb'
                # Only process if the columns exist in the sheet for this row
                if rating_col not in row.keys() and blurb_col not in row.keys(): continue

                rating_val_sheet = row.get(rating_col)
                blurb_val_sheet = row.get(blurb_col)
                
                # Skip if both rating and blurb are NaN (no data in sheet for this user for this film)
                if pd.isna(rating_val_sheet) and pd.isna(blurb_val_sheet): continue

                new_score, new_qualifier = parse_score_and_qualifier(rating_val_sheet)
                new_blurb = None if pd.isna(blurb_val_sheet) else blurb_val_sheet

                user_rating_obj = current_ratings_dict.get(user.lower())

                if user_rating_obj:
                    if (user_rating_obj.get('score') != new_score
                            or user_rating_obj.get('blurb') != new_blurb
                            or user_rating_obj.get('scoreQualifier') != new_qualifier):
                        user_rating_obj['score'] = new_score
                        user_rating_obj['blurb'] = new_blurb
                        # Only store the qualifier when present, so ratings without
                        # one stay clean (no `scoreQualifier: null` noise in the diff).
                        if new_qualifier:
                            user_rating_obj['scoreQualifier'] = new_qualifier
                        else:
                            user_rating_obj.pop('scoreQualifier', None)
                else: # New rating for this user for this film
                    new_rating = {'user': user, 'score': new_score, 'blurb': new_blurb}
                    if new_qualifier:
                        new_rating['scoreQualifier'] = new_qualifier
                    movie_to_update['movieClubInfo']['clubRatings'].append(new_rating)
            
            # Conditional TMDb data fetch. Re-fetch when the stored data version is
            # behind TMDB_FETCH_VERSION so new fields are backfilled exactly once.
            if tmdb_bearer_token:
                if movie_to_update.get(TMDB_VERSION_FIELD, 0) < TMDB_FETCH_VERSION:
                    print(f"Existing film {imdb_id_sheet} needs TMDb data (version behind). Fetching from TMDb...")
                    tmdb_data = get_tmdb_film_details(imdb_id_sheet, tmdb_bearer_token)
                    if tmdb_data:
                        for key, value in tmdb_data.items():
                            movie_to_update[key] = value
                        print(f"Backfilled/Updated TMDb data for {imdb_id_sheet}: {list(tmdb_data.keys())}")
                    else:
                        print(f"Could not backfill TMDb data for {imdb_id_sheet}. No new data added.")
                    movie_to_update[TMDB_FETCH_FLAG] = True
                    movie_to_update[TMDB_VERSION_FIELD] = TMDB_FETCH_VERSION
                else:
                    print(f"Existing film {imdb_id_sheet} is at TMDb data version {TMDB_FETCH_VERSION}. Skipping TMDb fetch.")
            
            final_movie_state_str = json.dumps(movie_to_update, sort_keys=True)
            if initial_movie_state_str != final_movie_state_str:
                changes_made = True
        
        else: # Film is new (not in existing films_dict)
            print(f"New film found in sheet: {imdb_id_sheet}. Fetching from OMDB...")
            # Shared with the site's add-a-film path (`create_submitted_films.py`),
            # so a film's record is identical whichever way it arrived.
            new_film_entry = build_film_entry(imdb_id_sheet, omdb_api_key, tmdb_bearer_token)

            if new_film_entry:
                new_film_entry['movieClubInfo'] = {
                    "selector": selector_sheet, "watchDate": watch_date_sheet,
                    "clubRatings": [], "trophyInfo": None, "trophyNotes": trophy_notes_sheet
                }
                
                for user in users:
                    rating_col, blurb_col = f'{user}_rating', f'{user}_blurb'
                    rating, blurb = row.get(rating_col), row.get(blurb_col)
                    if not pd.isna(rating) or not pd.isna(blurb):
                        rating_val_typed, qualifier = parse_score_and_qualifier(rating)
                        new_rating = {
                            'user': user, 'score': rating_val_typed, 'blurb': None if pd.isna(blurb) else blurb
                        }
                        if qualifier:
                            new_rating['scoreQualifier'] = qualifier
                        new_film_entry['movieClubInfo']['clubRatings'].append(new_rating)
                
                new_films_to_append.append(new_film_entry) # Add to temporary list
                changes_made = True
            else:
                print(f"Could not fetch OMDB data for new film {imdb_id_sheet}. Skipping.")
                continue

    # Append all new films at the end of the original films_data list
    if new_films_to_append:
        films_data.extend(new_films_to_append)
        # No need to update films_dict here as it's only used for initial lookup

    if changes_made:
        try:
            # REMOVED SORTING LOGIC TO PRESERVE ORIGINAL ORDER
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(films_data, f, indent=2, ensure_ascii=False)
            print(f"Successfully updated {json_path} with data from Google Sheet, OMDB, and TMDb. Order preserved.")
        except IOError as e:
            print(f"Error writing to JSON file {json_path}: {e}")
            return False
        except Exception as e: # Catch other potential errors during JSON processing
            print(f"Error during final processing or writing JSON: {e}")
            # As a fallback, if something unexpected happens, you might still want to try writing
            # but this is less likely now that sorting is removed.
            try:
                with open(json_path, 'w', encoding='utf-8') as f_err:
                    json.dump(films_data, f_err, indent=2, ensure_ascii=False)
                print(f"Successfully wrote {json_path} (potentially with issues) after a processing error.")
            except Exception as e_write:
                 print(f"Failed to write {json_path} even after processing error: {e_write}")
            return False
    else:
        print("No changes needed in JSON file.")

    # Backfill the normalized person records for any TMDb ids the films now
    # reference. Independent of `changes_made` so a missing/incomplete
    # persons.json gets filled even when films.json itself is unchanged.
    persons_path = os.path.join(os.path.dirname(json_path), PERSONS_FILENAME)
    sync_persons_file(films_data, persons_path, tmdb_bearer_token)

    return True

def main():
    sheet_id = os.environ.get('SHEET_ID')
    json_path = os.environ.get('JSON_PATH')
    omdb_api_key = os.environ.get('OMDB_API_KEY')
    tmdb_bearer_token_env = os.environ.get('TMDB_KEY') 

    if not sheet_id or not json_path:
        print("Error: Missing required environment variables (SHEET_ID, JSON_PATH).")
        return False
    
    if not omdb_api_key:
        print("Warning: OMDB_API_KEY environment variable is not set. New film details from OMDB may be limited or fail.")
    
    if not tmdb_bearer_token_env: 
        print("Warning: TMDB_KEY (Bearer Token) environment variable is not set. Cannot fetch additional crew details from TMDb.")

    sheet_df = get_sheet_data(sheet_id)
    if sheet_df is None:
        print("Failed to get data from Google Sheet. Aborting.")
        return False
    
    sheet_df = sheet_df.dropna(subset=['imdb_id'])
    if sheet_df.empty:
        print("No valid IMDb IDs found in the Google Sheet after filtering. Nothing to process.")
    elif not update_json_from_sheet(sheet_df, json_path, omdb_api_key, tmdb_bearer_token_env):
        return False

    # Last mutation, always: fields a member edited on the site win over the
    # sheet. Running this here (as well as at deploy time) is what stops
    # films.json flip-flopping between sheet and override values twice a day.
    overrides_path = os.environ.get('OVERRIDES_PATH', DEFAULT_OVERRIDES_PATH)
    return apply_overrides_to_file(json_path, overrides_path)

if __name__ == "__main__":
    if main():
        exit(0)
    else:
        exit(1)