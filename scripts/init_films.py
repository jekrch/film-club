import json
import os # Import os module for path manipulation

def update_film_json():
    """
    Reads film data from a JSON file, restructures the 'clubRatings' field,
    removes fields with "N/A" values, ensures 'movieClubInfo' structure,
    and writes the updated data back to the file.
    """
    try:
        # Define the path relative to the script's location
        script_dir = os.path.dirname(__file__)  # Get the directory where the script is located
        file_path = os.path.join(script_dir, '../src/assets/films.json') # Construct the full path

        # Read the existing JSON file
        with open(file_path, 'r', encoding='utf-8') as file: # Specify encoding for broader compatibility
            films = json.load(file)

        updates_made_count = 0
        ratings_restructured_count = 0
        na_removed_count = 0
        fields_added_count = 0

        # Iterate through each film object
        for film in films:
            film_updated = False # Flag to track if this specific film was updated

            # --- Ensure movieClubInfo structure ---
            if 'movieClubInfo' not in film:
                film['movieClubInfo'] = {}
                fields_added_count += 1
                film_updated = True

            if 'clubRatings' not in film.get('movieClubInfo', {}): # Use .get for safer access
                # Initialize with the new list structure if missing
                film['movieClubInfo']['clubRatings'] = []
                # Add default entries for known users if needed (optional, depending on requirements)
                # Example:
                # default_users = ['andy', 'gabe', 'jacob', 'joey']
                # film['movieClubInfo']['clubRatings'] = [{'user': user, 'score': None, 'blurb': None} for user in default_users]
                fields_added_count += 1
                film_updated = True

            if 'trophyInfo' not in film.get('movieClubInfo', {}):
                film['movieClubInfo']['trophyInfo'] = None
                fields_added_count += 1
                film_updated = True

            if 'trophyNotes' not in film.get('movieClubInfo', {}):
                film['movieClubInfo']['trophyNotes'] = None
                fields_added_count += 1
                film_updated = True

            # --- Restructure clubRatings ---
            # Check if clubRatings exists and is still in the old dictionary format
            if 'movieClubInfo' in film and 'clubRatings' in film['movieClubInfo'] and isinstance(film['movieClubInfo']['clubRatings'], dict):
                old_ratings = film['movieClubInfo']['clubRatings']
                new_ratings = []
                for user, score in old_ratings.items():
                    new_ratings.append({
                        "user": user,
                        "score": score, # Keep existing score or None
                        "blurb": None   # Add new blurb field, initialized to None
                    })
                film['movieClubInfo']['clubRatings'] = new_ratings
                ratings_restructured_count += 1
                film_updated = True

            # --- Remove fields with "N/A" value ---
            # Iterate over a copy of keys since we might modify the dictionary
            keys_to_remove = [key for key, value in film.items() if value == "N/A"]
            if keys_to_remove:
                for key in keys_to_remove:
                    del film[key]
                    na_removed_count += len(keys_to_remove) # Count each removed key
                film_updated = True

            if film_updated:
                updates_made_count += 1

        # Write the updated data back to the file
        with open(file_path, 'w', encoding='utf-8') as file: # Specify encoding
            json.dump(films, file, indent=2) # Use indent=2 for readability as in the original

        print(f"Update complete. Processed {len(films)} films.")
        if updates_made_count > 0:
             print(f"- Changes made in {updates_made_count} film entries.")
             if fields_added_count > 0:
                 print(f"- Added {fields_added_count} missing 'movieClubInfo' properties.")
             if ratings_restructured_count > 0:
                 print(f"- Restructured 'clubRatings' in {ratings_restructured_count} entries.")
             if na_removed_count > 0:
                 print(f"- Removed {na_removed_count} fields with 'N/A' values.")
        else:
            print("- No updates were necessary.")

    except FileNotFoundError:
        # Use the constructed file_path in the error message
        print(f"Error: File not found at path: {file_path}")
        print("Please ensure the script is run from the correct directory or adjust the relative path.")
    except json.JSONDecodeError:
        print(f"Error: File at {file_path} contains invalid JSON.")
    except Exception as e:
        print(f"An unexpected error occurred: {str(e)}")

if __name__ == "__main__":
    update_film_json()