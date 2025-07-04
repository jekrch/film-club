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

# --- Helper Functions ---
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

# --- TMDb Helper Function ---
EXPECTED_TMDB_CREW_FIELDS = [
    "cinematographer", "editor", "productionDesigner", 
    "musicComposer", "costumeDesigner"
]
TMDB_FETCH_FLAG = "tmdbCrewDataFetched"


def get_tmdb_film_details(imdb_id, tmdb_bearer_token):
    """Fetch film credits (including cinematographer) from TMDb API by IMDb ID using Bearer Token."""
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

    credits_url = f"https://api.themoviedb.org/3/{media_type}/{tmdb_movie_id}/credits"
    extracted_crew = {}
    try:
        response = requests.get(credits_url, headers=headers)
        response.raise_for_status()
        credits_data = response.json()
        
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
                    if field_name not in job_to_names:
                        job_to_names[field_name] = []
                    job_to_names[field_name].append(name)
            
            for field, names in job_to_names.items():
                extracted_crew[field] = ", ".join(sorted(list(set(names))))
        return extracted_crew
    
    except requests.exceptions.RequestException as e:
        print(f"Error during TMDb credits request for {imdb_id} (TMDb ID: {tmdb_movie_id}, Type: {media_type}): {e}. Response text: {e.response.text if e.response else 'No response'}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from TMDb credits for {imdb_id}: {e}")
        return None

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
                if current_trophy_notes != new_trophy_notes:
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

                new_score = None
                if not pd.isna(rating_val_sheet):
                    try:
                        float_val = float(rating_val_sheet)
                        new_score = int(float_val) if float_val.is_integer() else float_val
                    except (ValueError, TypeError): new_score = rating_val_sheet # Keep as string if not convertible
                new_blurb = None if pd.isna(blurb_val_sheet) else blurb_val_sheet

                user_rating_obj = current_ratings_dict.get(user.lower())

                if user_rating_obj: 
                    if user_rating_obj.get('score') != new_score or user_rating_obj.get('blurb') != new_blurb:
                        user_rating_obj['score'] = new_score
                        user_rating_obj['blurb'] = new_blurb
                else: # New rating for this user for this film
                    movie_to_update['movieClubInfo']['clubRatings'].append({
                        'user': user, 'score': new_score, 'blurb': new_blurb
                    })
            
            # Conditional TMDb data fetch
            if tmdb_bearer_token:
                if not movie_to_update.get(TMDB_FETCH_FLAG, False):
                    print(f"Existing film {imdb_id_sheet} needs TMDb crew data (flag is false or missing). Fetching from TMDb...")
                    tmdb_crew_data = get_tmdb_film_details(imdb_id_sheet, tmdb_bearer_token)
                    if tmdb_crew_data:
                        for key, value in tmdb_crew_data.items():
                            movie_to_update[key] = value 
                        print(f"Backfilled/Updated crew data for {imdb_id_sheet} from TMDb: {list(tmdb_crew_data.keys())}")
                    else:
                        print(f"Could not backfill crew data from TMDb for {imdb_id_sheet}. No new crew data added.")
                    movie_to_update[TMDB_FETCH_FLAG] = True 
                else:
                    print(f"Existing film {imdb_id_sheet} has TMDb crew data already fetched (flag is true). Skipping TMDb fetch.")
            
            final_movie_state_str = json.dumps(movie_to_update, sort_keys=True)
            if initial_movie_state_str != final_movie_state_str:
                changes_made = True
        
        else: # Film is new (not in existing films_dict)
            print(f"New film found in sheet: {imdb_id_sheet}. Fetching from OMDB...")
            new_film_data_omdb = get_omdb_film_details(imdb_id_sheet, omdb_api_key)
            
            if new_film_data_omdb:
                new_film_entry = new_film_data_omdb # Start with OMDB data
                new_film_entry[TMDB_FETCH_FLAG] = False 
                if tmdb_bearer_token:
                    print(f"Fetching additional crew data from TMDb for new film {imdb_id_sheet}...")
                    tmdb_crew_data = get_tmdb_film_details(imdb_id_sheet, tmdb_bearer_token)
                    if tmdb_crew_data:
                        for key, value in tmdb_crew_data.items():
                            new_film_entry[key] = value 
                        print(f"Successfully added crew data from TMDb for new film: {list(tmdb_crew_data.keys())}")
                    else:
                        print(f"Could not fetch or process crew data from TMDb for new film {imdb_id_sheet}.")
                    new_film_entry[TMDB_FETCH_FLAG] = True 
                else:
                    print("TMDb Bearer Token (TMDB_KEY) not provided. Skipping TMDb crew data fetch for new film.")

                new_film_entry['movieClubInfo'] = {
                    "selector": selector_sheet, "watchDate": watch_date_sheet,
                    "clubRatings": [], "trophyInfo": None, "trophyNotes": trophy_notes_sheet
                }
                
                for user in users:
                    rating_col, blurb_col = f'{user}_rating', f'{user}_blurb'
                    rating, blurb = row.get(rating_col), row.get(blurb_col)
                    if not pd.isna(rating) or not pd.isna(blurb):
                        try:
                            rating_val_typed = float(rating) if not pd.isna(rating) else None
                            if rating_val_typed is not None and rating_val_typed.is_integer(): rating_val_typed = int(rating_val_typed)
                        except (ValueError, TypeError): 
                            rating_val_typed = rating 
                        new_film_entry['movieClubInfo']['clubRatings'].append({
                            'user': user, 'score': rating_val_typed, 'blurb': None if pd.isna(blurb) else blurb
                        })
                
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
        return True

    success = update_json_from_sheet(sheet_df, json_path, omdb_api_key, tmdb_bearer_token_env)
    return success

if __name__ == "__main__":
    if main():
        exit(0)
    else:
        exit(1)

