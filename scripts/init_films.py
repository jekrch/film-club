import json

def update_film_json():
    try:
        # Read the existing JSON file
        with open('../src/assets/films.json', 'r') as file:
            films = json.load(file)
        
        updates_made = 0
        
        # Iterate through each film object
        for film in films:
            # Ensure movieClubInfo exists
            if 'movieClubInfo' not in film:
                film['movieClubInfo'] = {}
                updates_made += 1
            
            # Check for clubRatings
            if 'clubRatings' not in film['movieClubInfo']:
                film['movieClubInfo']['clubRatings'] = {
                    'andy': None,
                    'gabe': None,
                    'jacob': None,
                    'joey': None
                }
                updates_made += 1
            
            # Check for trophyInfo
            if 'trophyInfo' not in film['movieClubInfo']:
                film['movieClubInfo']['trophyInfo'] = None
                updates_made += 1
            
            # Check for trophyNotes
            if 'trophyNotes' not in film['movieClubInfo']:
                film['movieClubInfo']['trophyNotes'] = None
                updates_made += 1
        
        # Write the updated data back to the file
        with open('../src/assets/films.json', 'w') as file:
            json.dump(films, file, indent=2)
        
        print(f"Update complete: {updates_made} missing properties added across {len(films)} films")
        
    except FileNotFoundError:
        print("Error: film.json file not found")
    except json.JSONDecodeError:
        print("Error: film.json contains invalid JSON")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    update_film_json()