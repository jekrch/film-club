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

| Command           | Description                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| `bun run dev`     | Start the development server at `http://localhost:5173`                            |
| `bun run build`   | Build for production                                                               |
| `bun run preview` | Preview the production build locally                                               |
| `bun run lint`    | Run ESLint                                                                         |
| `bun run test`    | Run the test suite                                                                 |
| `bun run deploy`  | Deploy manually to GitHub Pages (normally handled by the Sync and Deploy workflow) |

## Data Sources

Film and club data lives in JSON files under `src/assets/`. Some of it is written by members on the site, the rest by CI from external APIs:

- `src/assets/films.json`: Film data, including details fetched from OMDb (plot, poster, ratings, awards, box office), extended data from TMDb (crew, meaning cinematographer, editor, production designer, composer, and costume designer, plus tagline, budget, revenue, keywords, trailer, and top-billed cast with headshots), and club-specific fields such as member reviews, watch dates, and selectors.
- `src/assets/club.json`: Club member information.
- `src/assets/trophies.json`: Club awards, recording who won what on which film. These are added by members on the film page rather than in the sheet, so the recipient is a structured field rather than free text. See [Awarding a trophy](#awarding-a-trophy).
- `src/assets/overrides.json`: Edits made by members on the site. This covers their own ratings and reviews, along with the film's shared fields (selector, watch date, alternate cover, hero background). CI merges it into `films.json` at build time. A film added on the site starts out as an entry here.
- [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing): The club's historical data, still read by the sync. New content doesn't need to be added here (see [Adding a new film](#adding-a-new-film)), but existing rows still work, and any field that hasn't been set on the site is still taken from the sheet.
- Profile pictures live in `public/images/` and follow the `[firstname].jpg` convention (e.g., `jacob.jpg`).

Two repository secrets support the automated sync: `OMDB_API_KEY` for film details and `TMDB_KEY` (a bearer token) for extended crew data.

## Managing Content

Content is managed on the site after signing in with Google. The Google Sheet still works and still feeds the sync, and nothing was migrated out of it, but new content doesn't need to go there.

### Adding a new film

1. Sign in and open [Films](https://criterionclub.org/#/films).
2. **Add a club film**, then search for it by title and pick it.
3. Enter whose pick it was and, if the club has already watched it, the watch date. Optionally paste an alternate cover and a wide image for the selection committee card.
4. **Add the film.**

The film shows up on the site a minute or two later. The site only records which film was added; the rest of the entry (plot, poster, crew, cast, keywords, stills) is fetched from OMDb and TMDb by the next deploy. Until then the picker lists it as already in the club, so it can't be added twice.

Ratings, reviews, and trophies are added on the film's own page once it appears.

### Updating an existing film

Open the film's page and use **Edit film details** to change the selector, watch date, cover, or hero background. Any member can edit these, since they describe the film itself rather than one person's rating.

**Edit my rating** covers your own score and review. Admins also get a member picker there, which is useful for entering everyone's scores during a call. Either way, the rating is recorded under that member's name.

Fields that nobody has set on the site are still read from the sheet, field by field, and editing a sheet row still works for films that came from it. Where the two disagree, the site's value wins and the sync logs the difference.

### Awarding a trophy

Trophies are awarded on the film's page rather than in the sheet. Sign in, open **Award a trophy** under the trophy gallery, pick the recipient, name the award, and add a note if there's a reason worth recording. It appears on the site about a minute later.

Any member can award a trophy to any member. Removing one is more restricted: the member who gave it, or an admin, can edit or withdraw it, but the recipient can't.

The sheet's `trophy_notes` column still works and still renders. Awards from both sources appear together on the film page and on the recipient's profile.

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

The **Deploy to GitHub Pages** workflow runs on every push to `main`, including the commit created by an edit made on the site. Before building, it:

1. Creates a `films.json` entry for each film added on the site, using OMDb and TMDb (`create_submitted_films.py`). This is why a new film takes a minute to show up.
2. Merges `overrides.json` into `films.json` (`apply_overrides.py`), which is where a new film picks up its selector, watch date, artwork, and ratings.
3. Fills the poster/title cache for films the club never watched (`enrich_list_films.py`).

All three steps are no-ops unless something changed. Step 1 uses the same fetching code as the sheet sync (`film_fetch.py`), so a film's record ends up the same either way.

Empty cells in the sheet are written as `null`, and special characters and formatting from the sheet are preserved.

## Contributing

For code changes, branch from `main`, make your changes, and open a pull request. Merged changes are deployed by the Sync and Deploy workflow.

Content changes (films, ratings, member info) should go through the site as described in [Managing Content](#managing-content) rather than through code.
