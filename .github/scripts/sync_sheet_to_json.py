#!/usr/bin/env python3
"""
Script to sync data from a Google Sheet to a JSON file for a film club website.
This script reads from a public Google Sheet:
- Updates existing film entries with ratings, blurbs, and other club-specific info.
- Fetches data from OMDB for new IMDb IDs found in the sheet.
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
    # Handle snake_case first by converting to pseudo-PascalCase
    text = re.sub(r"_([a-z])", lambda x: x.group(1).upper(), text)
    # Convert PascalCase to camelCase
    return text[0].lower() + text[1:]

def transform_omdb_keys_to_camel_case(omdb_data):
    """Converts keys in the OMDB API response from PascalCase to camelCase."""
    if isinstance(omdb_data, dict):
        return {to_camel_case(k): transform_omdb_keys_to_camel_case(v) for k, v in omdb_data.items()}
    elif isinstance(omdb_data, list):
        return [transform_omdb_keys_to_camel_case(elem) for elem in omdb_data]
    else:
        return omdb_data

def get_omdb_film_details(imdb_id, api_key):
    """Fetch film details from OMDB API by IMDb ID."""
    if not api_key:
        print("Error: OMDB_API_KEY is not set. Cannot fetch new film data.")
        return None
    
    url = f"https://www.omdbapi.com/?i={imdb_id}&apikey={api_key}&plot=full" # Ensure full plot
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for 4XX/5XX responses
        data = response.json()
        if data.get("Response") == "True":
            return transform_omdb_keys_to_camel_case(data)
        else:
            print(f"Error fetching OMDB data for {imdb_id}: {data.get('Error', 'Unknown error')}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during OMDB API request for {imdb_id}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from OMDB for {imdb_id}: {e}")
        return None

def get_sheet_data(sheet_id):
    """Fetch data from public Google Sheet using direct CSV export."""
    csv_export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    try:
        response = requests.get(csv_export_url)
        response.raise_for_status()
        df = pd.read_csv(pd.io.common.StringIO(response.text))
        df.columns = [col.strip().lower().replace(' ', '_') for col in df.columns] # Normalize column names
        # Ensure 'imdb_id' column exists
        if 'imdb_id' not in df.columns:
            print("Error: 'imdb_id' column not found in the Google Sheet.")
            return None
        # Fill NaN values with None for easier processing, but keep original types where possible
        df = df.astype(object).where(pd.notnull(df), None)
        return df
    except requests.exceptions.RequestException as e:
        print(f"Error fetching Google Sheet: {e}")
        return None
    except Exception as e: # Catch other pandas related errors
        print(f"Error processing Google Sheet data: {e}")
        return None

def update_json_from_sheet(sheet_df, json_path, omdb_api_key):
    """Update JSON file with data from Sheet dataframe and fetch new films from OMDB."""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            films_data = json.load(f)
    except FileNotFoundError:
        print(f"Warning: JSON file {json_path} not found. Will create a new one.")
        films_data = []
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {json_path}: {e}. Starting with an empty list.")
        films_data = []

    existing_imdb_ids = {film.get('imdbID') for film in films_data if film.get('imdbID')}
    users = ["andy", "gabe", "jacob", "joey", "greg"] # Define your club users
    changes_made = False

    # Prepare a dictionary for quick access to films by imdbID
    films_dict = {film['imdbID']: film for film in films_data if 'imdbID' in film}

    for _, row in sheet_df.iterrows():
        imdb_id_sheet = row.get('imdb_id')
        if not imdb_id_sheet or pd.isna(imdb_id_sheet):
            # print("Skipping row with missing imdb_id.")
            continue

        # Standardize sheet column names for easier access
        watch_date_sheet = row.get('watch_date')
        selector_sheet = row.get('selected_by') 
        trophy_notes_sheet = row.get('trophy_notes')
        #stream_url_sheet = row.get('stream_url') 

        if imdb_id_sheet not in existing_imdb_ids:
            print(f"New film found in sheet: {imdb_id_sheet}. Fetching from OMDB...")
            new_film_data = get_omdb_film_details(imdb_id_sheet, omdb_api_key)
            if new_film_data:
                # Initialize movieClubInfo for the new film
                new_film_data['movieClubInfo'] = {
                    "selector": selector_sheet,
                    "watchDate": watch_date_sheet,
                    "clubRatings": [], # Initialize with empty ratings
                    "trophyInfo": None, # As per your example
                    "trophyNotes": trophy_notes_sheet
                }
                # Add streamUrl if present in sheet
                # if stream_url_sheet:
                #     new_film_data['streamUrl'] = stream_url_sheet
                # else:
                #     new_film_data['streamUrl'] = None # Or omit if you prefer

                # Add club ratings for users if columns exist in the sheet
                # (This is typically for existing films, but can be pre-filled if sheet has data for new ones)
                for user in users:
                    rating_col = f'{user}_rating'
                    blurb_col = f'{user}_blurb'
                    rating = row.get(rating_col)
                    blurb = row.get(blurb_col)

                    # Only add if there's a rating or blurb
                    if not pd.isna(rating) or not pd.isna(blurb):
                        try:
                            if not pd.isna(rating):
                                float_rating = float(rating)
                                rating = int(float_rating) if float_rating.is_integer() else float_rating
                            else:
                                rating = None
                        except (ValueError, TypeError):
                             pass # Keep as string if not convertible or leave as None
                        
                        new_film_data['movieClubInfo']['clubRatings'].append({
                            'user': user,
                            'score': rating,
                            'blurb': None if pd.isna(blurb) else blurb
                        })
                
                films_data.append(new_film_data)
                films_dict[imdb_id_sheet] = new_film_data # Add to our tracking dict
                existing_imdb_ids.add(imdb_id_sheet) # Add to set of existing IDs
                changes_made = True
            else:
                print(f"Could not fetch OMDB data for new film {imdb_id_sheet}. Skipping.")
                continue # Skip to next row if OMDB fetch failed

        # Update existing film (or newly added film if data is in the same row)
        if imdb_id_sheet in films_dict:
            movie = films_dict[imdb_id_sheet]
            
            # Ensure movieClubInfo exists
            if 'movieClubInfo' not in movie:
                movie['movieClubInfo'] = {"clubRatings": [], "trophyInfo": None} # Basic init
                changes_made = True
            
            # Update watchDate
            if watch_date_sheet and movie['movieClubInfo'].get('watchDate') != watch_date_sheet:
                movie['movieClubInfo']['watchDate'] = watch_date_sheet
                changes_made = True
            
            # Update selector
            if selector_sheet and movie['movieClubInfo'].get('selector') != selector_sheet:
                movie['movieClubInfo']['selector'] = selector_sheet
                changes_made = True

            # Update trophyNotes
            # Check for pd.isna for trophy_notes_sheet to allow clearing the field
            if 'trophy_notes' in row: # Check if column exists
                current_trophy_notes = movie['movieClubInfo'].get('trophyNotes')
                new_trophy_notes = None if pd.isna(trophy_notes_sheet) else trophy_notes_sheet
                if current_trophy_notes != new_trophy_notes:
                    movie['movieClubInfo']['trophyNotes'] = new_trophy_notes
                    changes_made = True
            
            # Update streamUrl
            # if 'stream_url' in row: # Check if column exists
            #     current_stream_url = movie.get('streamUrl')
            #     new_stream_url = None if pd.isna(stream_url_sheet) else stream_url_sheet
            #     if current_stream_url != new_stream_url:
            #         movie['streamUrl'] = new_stream_url
            #         changes_made = True

            # Ensure clubRatings list exists
            if 'clubRatings' not in movie['movieClubInfo']:
                movie['movieClubInfo']['clubRatings'] = []
                changes_made = True
            
            # Process user ratings and blurbs for existing/newly added from sheet
            for user in users:
                rating_col = f'{user}_rating'
                blurb_col = f'{user}_blurb'

                # Check if rating/blurb columns are in the sheet for this row
                if rating_col not in row.keys() and blurb_col not in row.keys():
                    continue

                rating_val = row.get(rating_col)
                blurb_val = row.get(blurb_col)
                
                # Skip if both rating and blurb are NaN (no data in sheet for this user for this film)
                if pd.isna(rating_val) and pd.isna(blurb_val):
                    continue

                user_rating_obj = next((r for r in movie['movieClubInfo']['clubRatings'] if r.get('user', '').lower() == user.lower()), None)
                
                new_score = None
                if not pd.isna(rating_val):
                    try:
                        float_val = float(rating_val)
                        new_score = int(float_val) if float_val.is_integer() else float_val
                    except (ValueError, TypeError):
                        new_score = rating_val # Keep as string if not convertible

                new_blurb = None if pd.isna(blurb_val) else blurb_val

                if user_rating_obj: # User already has a rating object
                    if user_rating_obj.get('score') != new_score or user_rating_obj.get('blurb') != new_blurb:
                        user_rating_obj['score'] = new_score
                        user_rating_obj['blurb'] = new_blurb
                        changes_made = True
                else: # New rating for this user for this film
                    movie['movieClubInfo']['clubRatings'].append({
                        'user': user,
                        'score': new_score,
                        'blurb': new_blurb
                    })
                    changes_made = True
        else:
            # This case should ideally not be reached if logic is correct,
            # means imdb_id_sheet was in existing_imdb_ids but not in films_dict (e.g. if films_data had duplicates initially)
             print(f"Warning: IMDb ID {imdb_id_sheet} was marked as existing but not found in films_dict for update.")


    if changes_made:
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(films_data, f, indent=2, ensure_ascii=False)
            print(f"Successfully updated {json_path} with data from Google Sheet and OMDB.")
        except IOError as e:
            print(f"Error writing to JSON file {json_path}: {e}")
            return False
    else:
        print("No changes needed in JSON file.")
    
    return True


def main():
    sheet_id = os.environ.get('SHEET_ID')
    json_path = os.environ.get('JSON_PATH')
    omdb_api_key = os.environ.get('OMDB_API_KEY') # Get OMDB API key from env

    if not sheet_id or not json_path:
        print("Error: Missing required environment variables (SHEET_ID, JSON_PATH).")
        return False
    
    if not omdb_api_key:
        print("Warning: OMDB_API_KEY environment variable is not set. Cannot fetch new film details from OMDB.")
        # Continue without it if only updates are expected, but new films won't be added.

    sheet_df = get_sheet_data(sheet_id)
    if sheet_df is None:
        print("Failed to get data from Google Sheet. Aborting.")
        return False
    
    # Filter out rows where imdb_id is completely missing or NaN before processing
    sheet_df = sheet_df.dropna(subset=['imdb_id'])
    if sheet_df.empty:
        print("No valid IMDb IDs found in the Google Sheet after filtering. Nothing to process.")
        return True # No data to process is not a failure of the script itself

    success = update_json_from_sheet(sheet_df, json_path, omdb_api_key)
    return success

if __name__ == "__main__":
    if main():
        exit(0)
    else:
        exit(1)