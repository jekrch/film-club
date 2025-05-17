import os
import cairosvg

# start with pip install cairosvg
# --- Configuration ---
# Path to your source SVG file relative to where you run the script
SOURCE_SVG_PATH = "../public/film.svg"

# Directory where the generated PNG icons will be saved, relative to where you run the script
# Based on your vite.config.ts, icons are expected in the 'public' root
OUTPUT_DIR = "../public"

# List of icons to generate
# Each item is a dictionary with 'name' (output filename) and 'size' (width & height in pixels)
ICONS_TO_GENERATE = [
    {
        "name": "film-192x192.png",
        "size": 192
    },
    {
        "name": "film-512x512.png",
        "size": 512
    },
    {
        "name": "film-maskable-512x512.png", # Maskable icons often need specific design considerations in the SVG
                                         # This script will just resize the source SVG.
        "size": 512
    },
    # You can add more icon definitions here if needed
    # Example:
    # {
    #     "name": "film-72x72.png",
    #     "size": 72
    # },
]

# --- Script Logic ---
def generate_icons():
    """
    Generates PNG icons from the source SVG file.
    """
    # Ensure the output directory exists
    if not os.path.exists(OUTPUT_DIR):
        try:
            os.makedirs(OUTPUT_DIR)
            print(f"Created output directory: {OUTPUT_DIR}")
        except OSError as e:
            print(f"Error: Could not create output directory {OUTPUT_DIR}. {e}")
            return

    # Check if the source SVG file exists
    if not os.path.isfile(SOURCE_SVG_PATH):
        print(f"Error: Source SVG file not found at {SOURCE_SVG_PATH}")
        print("Please ensure the SOURCE_SVG_PATH is correct and the script is run from the correct directory.")
        return

    print(f"Source SVG: {SOURCE_SVG_PATH}")
    print(f"Output directory: {OUTPUT_DIR}")

    success_count = 0
    error_count = 0

    for icon_info in ICONS_TO_GENERATE:
        output_filename = icon_info["name"]
        size = icon_info["size"]
        output_path = os.path.join(OUTPUT_DIR, output_filename)

        print(f"\nGenerating {output_filename} (size: {size}x{size}px)...")

        try:
            # Convert SVG to PNG
            cairosvg.svg2png(
                url=SOURCE_SVG_PATH,
                write_to=output_path,
                output_width=size,
                output_height=size
            )
            print(f"Successfully generated: {output_path}")
            success_count += 1
        except Exception as e:
            print(f"Error generating {output_filename}: {e}")
            error_count += 1

    print("\n--- Generation Summary ---")
    print(f"Successfully generated: {success_count} icon(s)")
    if error_count > 0:
        print(f"Failed to generate: {error_count} icon(s)")
    if success_count == 0 and error_count == 0 and not ICONS_TO_GENERATE:
        print("No icons were configured to be generated.")
    elif success_count == 0 and error_count == 0 and ICONS_TO_GENERATE:
         print("It seems no icons were processed. Check configuration.")


if __name__ == "__main__":
    generate_icons()