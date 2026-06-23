# Criterion Club Website

[![Tests](https://github.com/jekrch/film-club/actions/workflows/run-tests-on-commit.yml/badge.svg)](https://github.com/jekrch/film-club/actions/workflows/run-tests-on-commit.yml)

[criterionclub.org](https://criterionclub.org)

A web application for tracking films watched and reviewed by the Criterion Club, a group of friends who watch Criterion Channel films and discuss them over Zoom. The site lets you browse the films we've watched, read each member's reviews, and explore member profiles and club statistics.

## Tech Stack

- React
- Vite
- Bun
- Tailwind
- TypeScript

## Getting Started

### Prerequisites

- Bun (latest version). Used as both the runtime and package manager; a separate Node.js install isn't required.

### Setup

```bash
gh repo clone jekrch/film-club
cd film-club
bun install
```

### Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server at `http://localhost:5173` |
| `bun run build` | Build for production |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run ESLint |
| `bun run test` | Run the test suite |
| `bun run deploy` | Deploy manually to GitHub Pages (normally handled by the Sync and Deploy workflow) |

## Data Sources

Film and club data is managed through a combination of JSON files, a Google Sheet, and external APIs:

- `src/assets/films.json`: Film data, including details fetched from OMDb (plot, poster, ratings, awards, box office), extended data from TMDb (crew — cinematographer, editor, production designer, composer, costume designer; plus tagline, budget, revenue, keywords, trailer, and top-billed cast with headshots), and club-specific fields such as member reviews, watch dates, and selectors.
- `src/assets/club.json`: Club member information.
- [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing): The source of truth for member ratings, blurbs, watch metadata, and new film entries (added by IMDb ID).
- Profile pictures live in `public/images/` and follow the `[firstname].jpg` convention (e.g., `jacob.jpg`).

Two repository secrets support the automated sync: `OMDB_API_KEY` for film details and `TMDB_KEY` (a bearer token) for extended crew data.

## Managing Content

Most content is managed through the Google Sheet and synced automatically. See [Automated Workflows](#automated-workflows) for how the sync runs.

### Adding a new film

1. Open the [Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing) and add a row for the film.
2. Enter the film's IMDb ID (e.g., `tt0036342`) in the `imdb_id` column. This is how the sync identifies the film and fetches its data from OMDb and TMDb.

The IMDb ID is all that's needed to add the film. Club-specific fields (`watch_date`, `selected_by`, `trophy_notes`, and per-member ratings and blurbs such as `andy_rating` and `jacob_blurb`) are filled in after we meet to discuss the film.

### Updating an existing film

Edit the relevant row in the Google Sheet. The sync picks up changes to any `[name]_rating`, `[name]_blurb`, `watch_date`, `selected_by`, `trophy_notes`, and `stream_url` field and writes them back to `films.json`.

### Member data

Edit `src/assets/club.json` to update member names, bios, and other profile details. You can edit it [directly on GitHub](https://github.com/jekrch/film-club/blob/main/src/assets/club.json) or commit changes locally. Pushing to `main` triggers a deployment.

### Profile pictures

Add a `[firstname].jpg` image (lowercase) to `public/images/` and push to `main`. The image is included in the next deployment.

## Automated Workflows

The **Sync and Deploy** GitHub Action handles data syncing and deployment. It runs twice daily (roughly 2 PM and 10 PM US Central) and can be triggered manually from the [Actions tab](https://github.com/jekrch/film-club/actions).

On each run, the workflow:

1. Reads the Google Sheet.
2. For new IMDb IDs, fetches film details from OMDb and extended crew data from TMDb, transforms the fields to camelCase, and adds a new entry to `films.json` along with any club-specific data from the sheet.
3. For existing films, updates club-specific fields from the sheet and backfills TMDb crew data where it's missing (tracked by the `tmdbCrewDataFetched` flag).
4. Commits any changes to `films.json` back to `main`.
5. Builds the app and deploys to GitHub Pages if changes were committed or the run was triggered manually.

Empty cells in the sheet are written as `null`, and special characters and formatting from the sheet are preserved.

## Contributing

For code changes, branch from `main`, make your changes, and open a pull request. Merged changes are deployed by the Sync and Deploy workflow.

Content changes (films, ratings, member info) should go through the Google Sheet or `club.json` as described in [Managing Content](#managing-content) rather than through code.
