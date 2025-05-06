import json
import csv
import sys

def convert_json_to_csv(json_file, csv_file):
    try:
        # Read the JSON data
        with open(json_file, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                print(f"Error: Invalid JSON format in {json_file}: {e}")
                return False
    except FileNotFoundError:
        print(f"Error: File {json_file} not found.")
        return False
    
    # Make sure data is a list (array of objects)
    if not isinstance(data, list):
        # If data is not a list, it might be a dictionary with a key
        # or a single object, so we'll handle that
        for key, value in data.items() if isinstance(data, dict) else []:
            if isinstance(value, list):
                data = value
                break
        else:
            # If no list found, wrap the data in a list
            data = [data]
    
    # Define the list of users to extract ratings from
    users = ["andy", "gabe", "jacob", "joey", "greg"]
    
    # Define the CSV header
    header = ["imdb_id", "name", "watch_date", "selected_by"]
    for user in users:
        header.append(f"{user}_rating")
        header.append(f"{user}_blurb")
    header.append("trophy_notes")
    
    try:
        # Open a CSV file for writing, using QUOTE_ALL to handle potential line breaks
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f, quoting=csv.QUOTE_ALL)
            writer.writerow(header)
            
            # Process each movie object
            for movie in data:
                row = []
                
                # Add the imdb_id and name (using the "title" field)
                row.append(movie.get("imdbID", ""))
                row.append(movie.get("title", ""))
                
                # Get the watch date from movieClubInfo if available
                watch_date = ""
                if "movieClubInfo" in movie and movie["movieClubInfo"].get("watchDate"):
                    watch_date = movie["movieClubInfo"]["watchDate"]
                row.append(watch_date)
                
                # Get the selector (who selected the movie) - new addition
                selected_by = ""
                if "movieClubInfo" in movie and movie["movieClubInfo"].get("selector"):
                    selected_by = movie["movieClubInfo"]["selector"]
                row.append(selected_by)
                
                # Process each user's rating and blurb
                club_ratings = {}
                if "movieClubInfo" in movie and "clubRatings" in movie["movieClubInfo"]:
                    for rating in movie["movieClubInfo"]["clubRatings"]:
                        user = rating.get("user", "").lower()
                        score = rating.get("score", "")
                        blurb = rating.get("blurb", "")
                        club_ratings[user] = (score, blurb)
                
                # Add each user's rating and blurb to the row
                for user in users:
                    rating, blurb = club_ratings.get(user, ("", ""))
                    row.append(rating)
                    row.append(blurb if blurb is not None else "")
                
                # Add trophy notes
                trophy_notes = ""
                if "movieClubInfo" in movie and movie["movieClubInfo"].get("trophyNotes") is not None:
                    trophy_notes = movie["movieClubInfo"]["trophyNotes"]
                row.append(trophy_notes)
                
                # Write the row to the CSV file
                writer.writerow(row)
                
        print(f"Successfully converted {json_file} to {csv_file}")
        return True
    except Exception as e:
        print(f"Error writing to {csv_file}: {e}")
        return False

# Example usage with command-line arguments
if __name__ == "__main__":
    
    json_file = "../src/assets/films.json"
    csv_file = "../src/assets/films.csv"
    
    success = convert_json_to_csv(json_file, csv_file)
    sys.exit(0 if success else 1)