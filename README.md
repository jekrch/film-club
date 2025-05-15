# Criterion Club Website

[https://criterionclub.org](https://criterionclub.org)

A web application for tracking films watched and reviewed by the Criterion Club, a group of friends who watch Criterion Channel films and discuss them via Zoom.

Users can browse films we've watched, see reviews from each member, explore our individual profiles and club statistics.

## Tech Stack

-   React
-   Vite
-   Bun
-   Tailwind
-   TypeScript

## Project Structure

Data for the website is managed through JSON files, a Google Sheet, and external APIs:
-   `src/assets/club.json` - Club member information.
-   `src/assets/films.json` - Contains detailed film data (plot, cast, poster, etc. fetched from OMDB for new films), extended crew information (cinematographer, editor, etc. from TMDb), and club-specific information like member reviews, watch dates, and selectors (primarily synced from the Google Sheet).
-   Google Sheet - [Film Club Ratings & New Film Pipeline](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing) - The primary source for member ratings, blurbs, watch metadata, and for initiating the addition of new films via their IMDb ID.
-   An `OMDB_API_KEY` (stored as a GitHub repository secret) is used by our automated workflow to fetch comprehensive film details when a new IMDb ID is added to the Google Sheet.
-   A `TMDB_KEY` (bearer token, stored as a GitHub repository secret) is used to fetch additional crew information like cinematographer, editor, production designer, music composer, and costume designer from The Movie Database (TMDb).

Profile pictures are stored in `public/images/` and follow the naming convention: `[firstname].jpg` (e.g., `jacob.jpg`).

## Getting Started

### Prerequisites

-   Bun (latest version)
-   Node.js (compatible version for Bun, usually LTS)

### Installation

1.  Clone the repository
    ```bash
    gh repo clone jekrch/film-club
    cd film-club
    ```

2.  Install dependencies
    ```bash
    bun install
    ```

### Development

Run the development server:
```bash
bun run dev
````

The site will be available at: `http://localhost:5173`.

### Building

Build the project for production:

```bash
bun run build
```

### Preview Production Build

Test the production build locally:

```bash
bun run preview
```

### Deploy through GitHub Pages

Deploy the site:

```bash
bun run deploy
```

## Adding/Updating Content

### Film Data

Film data management is now largely automated through our Google Sheet and a backend sync process that uses the OMDB API for film details and TMDb for extended crew information.

**To Add a Brand New Film:**

1.  Open the [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing).
2.  Add a new row for the film.
3.  **Crucially, enter the film's IMDb ID** (e.g., `tt0036342`) into the `imdb_id` column. This is how the system identifies the film.
4.  The automated sync process will:
      * Detect this new IMDb ID.
      * Fetch comprehensive film details (title, year, director, actors, **full plot**, poster, official ratings, etc.) directly from the OMDB API.
      * Fetch extended crew information (cinematographer, editor, production designer, music composer, costume designer) from The Movie Database (TMDb).
5.  You can (and should\!) also pre-fill other information in the sheet for the new film:
      * `watch_date`
      * `selected_by` (who chose the film)
      * `trophy_notes`
      * Your personal rating and blurb in your respective columns (e.g., `andy_rating`, `jacob_blurb`).
        This information will be added to the film's entry in `films.json` alongside the OMDB and TMDb data.

**To Update an Existing Film's Ratings, Blurbs, or Club-Specific Info:**

1.  Open the [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing).
2.  Find the row for the film you want to update (use the `imdb_id` or title to locate it).
3.  Update any of the following fields:
      * Your (or any member's) rating in the respective `[name]_rating` column.
      * Your (or any member's) blurb in the respective `[name]_blurb` column.
      * `watch_date`
      * `selected_by`
      * `trophy_notes`
      * `stream_url`
4.  The changes will be automatically synced to the `src/assets/films.json` file and deployed to the website during the next scheduled sync.

Changes are typically synced and deployed twice daily (see "Automated Workflows" below). For immediate updates, you can manually trigger the workflow.

**Manually Triggering Sync and Deployment:**

1.  Go to the [Actions tab](https://github.com/jekrch/film-club/actions) in the GitHub repository.
2.  Under "Workflows", select **"Sync and Deploy"**.
3.  Click the "Run workflow" button (usually on the right side), choose the `main` branch, and run it.

### Member Data

Edit `src/assets/club.json` to update member information. You can do this directly on GitHub or by cloning the repository locally.

### Profile Pictures

1.  Name your image file as `[firstname].jpg` (lowercase, e.g., `andy.jpg`).
2.  Place it in the `public/images/` directory.
3.  Commit and push the change. The image will be included in the next deployment.

## Automated Workflows

### Sync and Deploy (Google Sheet 🔄 OMDB 🔄 TMDb 🔄 JSON 🚀 Website)

A comprehensive GitHub Action named **"Sync and Deploy"** handles the data flow and site deployment:

1.  **Scheduled Runs:** The workflow runs automatically twice daily (approximately 2 PM and 10 PM US Central Time). It can also be manually triggered.
2.  **Sheet Processing:**
      * It reads the [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing).
      * **New Films:** If a new IMDb ID is found in the sheet:
          * It fetches detailed film data (including the full plot) from the OMDB API using a secure `OMDB_API_KEY` repository secret.
          * It fetches extended crew data (cinematographer, editor, production designer, music composer, costume designer) from TMDb using a secure `TMDB_KEY` (bearer token) repository secret.
          * This data is transformed (field names to camelCase) and used to create a new film entry in `src/assets/films.json`.
          * Club-specific data from the sheet for this new film (like `watch_date`, `selected_by`, initial ratings/blurbs) is also added.
      * **Existing Films:** For IMDb IDs already present in `films.json`:
          * It updates club-specific information (member ratings, blurbs, `watch_date`, `selected_by`, `trophy_notes`) based on any changes found in the sheet.
          * For films that don't have TMDb crew data yet (using a flag `tmdbCrewDataFetched`), it fetches and adds that information to the existing entries.
3.  **Committing Changes:** If any data in `films.json` was added or changed, the workflow automatically commits these updates back to the `main` branch.
4.  **Automatic Deployment:** If changes were committed in the previous step (or if the workflow was manually triggered for a force deploy), it then proceeds to:
      * Build the React application.
      * Deploy the latest version of the website to GitHub Pages.

This single workflow ensures that data is kept up-to-date and the live site reflects these changes efficiently.

### Deployed Site

The site is available at:

  - Custom Domain: [https://criterionclub.org](https://criterionclub.org)
  - GitHub Pages URL: [https://jekrch.github.io/film-club/](https://jekrch.github.io/film-club/)

## Scripts

  - `bun run dev` - Start development server.
  - `bun run build` - Build for production.
  - `bun run preview` - Preview production build locally.
  - `bun run lint` - Run ESLint for code quality checks.
  - `bun run deploy` - (Note: Deployment is primarily handled by the automated "Sync and Deploy" workflow, but this can be used to deploy manually.)

## Contributing

1.  For content updates (films, ratings), please use the [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing) as described above.
2.  Club member profile info can be updated directly in `club.json`. A deployment will be triggered on committing changes to this file in the main branch.
2.  For more substantive code changes:
      * Create a new branch for your feature or bug fix.
      * Make your changes.
      * Push your branch and open a Pull Request to the `main` branch.
      * Once merged, changes will be deployed automatically by the "Sync and Deploy" workflow if they affect buildable content, or on its next scheduled run if `films.json` was updated.

## 🎬 Hey, updating the site is EVEN EASIER NOW\!

YOU can update film ratings, add new films, and more, mostly without writing any code or manually editing JSON files. We've streamlined it with our Google Sheet and automated magic\!

### How to Add a Brand New Film (The Easiest Way)

1.  Go to our [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing).
2.  Scroll to the bottom and add a new row.
3.  The **most important** piece of info: type the film's **IMDb ID** (e.g., `tt0036342`) into the `imdb_id` column.
      * *Our system will use this ID to automatically look up all the core movie details (title, director, actors, full plot, poster image, etc.) from OMDB, and extended crew information (cinematographer, editor, production designer, etc.) from TMDb\!*
4.  In the same row, you can also fill in:
      * The `watch_date`
      * Who `selected_by` the film
      * Any `trophy_notes`
      * A `stream_url` (like a link to JustWatch or where it's streaming)
      * Your score in your `_rating` column (e.g., `andy_rating`)
      * Optional comments in your `_blurb` column.
5.  That's it\! The new film, enriched with OMDB data, TMDb crew information, and your initial input, will appear on the website after the next automated sync.

### How to Update Existing Film Ratings/Info

1.  Go to our [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing).
2.  Find the film you want to update.
3.  Enter or change your score in your `_rating` column.
4.  Add or edit comments in your `_blurb` column.
5.  You can also update the `watch_date`, `selected_by`, `trophy_notes` if needed.
6.  Done\! Your changes will automatically appear on the website after the next sync.

**Want your changes to appear immediately?** You can manually trigger the process:

1.  Go to the [GitHub Actions tab](https://github.com/jekrch/film-club/actions).
2.  Under "Workflows", select **"Sync and Deploy"**.
3.  Click "Run workflow", choose the `main` branch, and run it. This will sync the data and redeploy the site.

### For User Profiles (Member Info)

This part still involves a quick edit on GitHub:

1.  Navigate to the club members file: [/src/assets/club.json](https://github.com/jekrch/film-club/blob/main/src/assets/club.json).
2.  Click the pencil icon (✏️) in the top-right corner to edit the file.
3.  Make your changes to member names, bios, etc.
4.  Scroll down and commit your changes directly to the `main` branch. These will be picked up in the next deployment.

### What Happens Next?

Once you edit the Google Sheet, our automated "Sync and Deploy" workflow takes care of the rest. It runs twice daily or when you trigger it manually.

### Tips

  * The IMDb ID is key for adding new films and for the system to match records.
  * The sync process now fetches extended crew data (cinematographer, editor, etc.) from TMDb for all films.
  * For existing films without TMDb data, it will automatically backfill this information during the next sync.
  * The sync process preserves special characters and formatting from the sheet.
  * Empty cells in the sheet for ratings/blurbs correctly result in `null` values in the JSON, keeping things clean.

### Need Help?

If you run into any issues, have questions, or a film isn't showing up as expected, you know where to find me\!