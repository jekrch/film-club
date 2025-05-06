#!/usr/bin/env python3
"""
Script to sync data from a Google Sheet to a JSON file for a film club website.
This script reads from a public Google Sheet, identifies matching records in a JSON file
using the imdb_id as the key, and updates the JSON with ratings and blurbs.
"""

import os
import json
import pandas as pd
import requests

def get_sheet_data(sheet_id):
    """Fetch data from public Google Sheet using direct CSV export"""
    # URL for direct CSV export from public Google Sheets
    csv_export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    
    try:
        # Get the CSV data
        response = requests.get(csv_export_url)
        response.raise_for_status()  # Raise an exception for 4XX/5XX responses
        
        # Read CSV data into pandas DataFrame
        df = pd.read_csv(pd.io.common.StringIO(response.text))
        
        # Clean up column names - strip whitespace, convert to lowercase
        df.columns = [col.strip().lower() for col in df.columns]
        
        return df
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching Google Sheet: {e}")
        return None

def update_json_from_sheet(sheet_df, json_path):
    """Update JSON file with data from Sheet dataframe"""
    # Read the JSON file
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: JSON file {json_path} not found.")
        return False
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {json_path}: {e}")
        return False
    
    # List of users (as defined in the original script)
    users = ["andy", "gabe", "jacob", "joey", "greg"]
    
    # Map from sheet to json - this tracks if we've made any changes
    changes_made = False
    
    # Loop through each row in the sheet
    for _, row in sheet_df.iterrows():
        # Get the imdb_id from the sheet
        imdb_id = row.get('imdb_id')
        if not imdb_id:
            continue
            
        # Find the corresponding movie in the JSON
        movie_found = False
        for movie in json_data:
            if movie.get('imdbID') == imdb_id:
                movie_found = True
                
                # Ensure movieClubInfo exists
                if 'movieClubInfo' not in movie:
                    movie['movieClubInfo'] = {}
                
                # Update watch_date if provided
                if 'watch_date' in row and row['watch_date']:
                    if movie['movieClubInfo'].get('watchDate') != row['watch_date']:
                        movie['movieClubInfo']['watchDate'] = row['watch_date']
                        changes_made = True
                
                # Update selected_by if provided
                if 'selected_by' in row and row['selected_by']:
                    if movie['movieClubInfo'].get('selector') != row['selected_by']:
                        movie['movieClubInfo']['selector'] = row['selected_by']
                        changes_made = True
                
                # Update trophy_notes if provided
                if 'trophy_notes' in row and row['trophy_notes']:
                    if movie['movieClubInfo'].get('trophyNotes') != row['trophy_notes']:
                        movie['movieClubInfo']['trophyNotes'] = row['trophy_notes']
                        changes_made = True
                
                # Ensure clubRatings exists
                if 'clubRatings' not in movie['movieClubInfo']:
                    movie['movieClubInfo']['clubRatings'] = []
                
                # Process user ratings and blurbs
                for user in users:
                    rating_col = f'{user}_rating'
                    blurb_col = f'{user}_blurb'
                    
                    # Only process if both columns exist in the dataframe
                    if rating_col in row and blurb_col in row:
                        rating = row[rating_col]
                        blurb = row[blurb_col]
                        
                        # Skip if no rating (empty cell)
                        if pd.isna(rating) or rating == '':
                            continue
                            
                        # Convert rating to number if possible
                        try:
                            rating = float(rating)
                        except (ValueError, TypeError):
                            # Keep as string if not convertible
                            pass
                        
                        # Handle empty blurb
                        if pd.isna(blurb):
                            blurb = ""
                        
                        # Check if this user already has a rating
                        user_found = False
                        for club_rating in movie['movieClubInfo']['clubRatings']:
                            if club_rating.get('user', '').lower() == user.lower():
                                user_found = True
                                # Update rating if changed
                                if club_rating.get('score') != rating or club_rating.get('blurb') != blurb:
                                    club_rating['score'] = rating
                                    club_rating['blurb'] = blurb
                                    changes_made = True
                                break
                        
                        # Add new rating if user not found
                        if not user_found and (rating or blurb):
                            movie['movieClubInfo']['clubRatings'].append({
                                'user': user,
                                'score': rating,
                                'blurb': blurb
                            })
                            changes_made = True
                
                break
        
        # If movie not found in JSON but has ratings, we might want to add it
        # This would require additional logic to create a new movie entry
    
    # Only write to file if changes were made
    if changes_made:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2)
        print(f"Updated {json_path} with data from Google Sheet")
        return True
    else:
        print("No changes needed in JSON file")
        return True

def main():
    # Get environment variables
    sheet_id = os.environ.get('SHEET_ID')
    json_path = os.environ.get('JSON_PATH')
    
    if not sheet_id or not json_path:
        print("Error: Missing required environment variables (SHEET_ID, JSON_PATH)")
        return False
    
    # Get the data from Google Sheet
    sheet_df = get_sheet_data(sheet_id)
    if sheet_df is None:
        return False
    
    # Update the JSON file
    success = update_json_from_sheet(sheet_df, json_path)
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)