# Criterion Club Website

https://criterionclub.org

A web application for tracking films watched and reviewed by the Criterion Club, a group of friends who watch Criterion Channel films and discuss them via Zoom.

Users can browse films we've watched, see reviews from each member, and explore our individual profiles.

## Tech Stack

- React
- Vite
- Bun
- Tailwind
- TypeScript

## Project Structure

Data for the website is managed through JSON files and a Google Sheet:
- `src/assets/club.json` - Club member information
- `src/assets/films.json` - Film data and reviews (automatically synced from Google Sheet)
- Google Sheet - [Film Club Ratings](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing)

Profile pictures are stored in `public/images/` and follow the naming convention: `[firstname].jpg` (e.g., `jacob.jpg`)

## Getting Started

### Prerequisites

- Bun (latest version)

### Installation

1. Clone the repository
```bash
gh repo clone jekrch/film-club
cd film-club
```

2. Install dependencies
```bash
bun install
```

### Development

Run the development server:
```bash
bun run dev
```
See:
http://localhost:3000

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

## Adding/Updating Content

### Film Data

The film data is now automatically synced from a Google Sheet to `src/assets/films.json`. This happens twice daily at 2pm CT and 10pm CT, or can be triggered manually.

**To update film data:**
1. Edit the [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing)
2. Add your ratings, blurbs, and other information
3. The changes will be automatically synced to the website at the next scheduled time

**To manually trigger the sync:**
1. Go to the Actions tab in GitHub
2. Select "Sync Google Sheet to JSON"
3. Click "Run workflow"

### Member Data

Edit `src/assets/club.json` to update member information.

### Profile Pictures

1. Name your image file as `[firstname].jpg` (lowercase)
2. Place it in the `public/images/` directory
3. The change will be reflected automatically

## Automated Workflows

### Google Sheet to JSON Sync

A GitHub Action automatically syncs data from our Google Sheet to the `films.json` file twice daily (2pm CT and 10pm CT).

- Data is matched between systems using the IMDB ID
- The action only updates score and blurb fields that have changed

### Deployment Process

The site is automatically deployed to GitHub Pages using GitHub Actions.

1. Commit and push changes to the `main` branch
2. Trigger the deployment workflow manually:
   - Go to the Actions tab
   - Select "Deploy to GitHub Pages"
   - Click "Run workflow"

### Deployed Site

The site is available at: https://jekrch.github.io/film-club

## Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run lint` - Run ESLint
- `bun run deploy` - Deploy to GitHub Pages (manual)

## Contributing

1. Push to the `main` branch 
2. Trigger deployment via GitHub Actions workflow


## 🎬 Hey, updating the site is EVEN EASIER NOW!

YOU can update the website without writing any code or manually editing JSON files. We've made it super simple with a Google Sheet!

### How to Update Film Ratings (The NEW Easiest Way)

1. Go to our [Film Club Google Sheet](https://docs.google.com/spreadsheets/d/1wGrX2xWrJlS6WFpNxzD73VrHW4ZnrfedjtK5C9EYeuw/edit?usp=sharing)
2. Find the film you want to rate
3. Enter your score in the appropriate column (e.g., `andy_rating`, `gabe_rating`, etc.)
4. Add optional comments in the blurb column next to your rating
5. That's it! Your changes will automatically appear on the website after the next sync (2pm CT or 10pm CT daily)

Want your changes to appear immediately? You can manually trigger a sync:
1. Go to the [GitHub Actions tab](https://github.com/jekrch/film-club/actions)
2. Select "Sync Google Sheet to JSON"
3. Click "Run workflow"

### For User Profiles

You can still update user profiles by editing the JSON file:

1. **Navigate to** [/src/assets/club.json](https://github.com/jekrch/film-club/blob/main/src/assets/club.json)
2. **Click the pencil icon** (✏️) in the top-right corner
3. **Make your changes** directly in the editor
4. **Commit changes** directly to the main branch

### What Happens Next?

Once you edit the Google Sheet, an automated process will update the website data. The site will automatically update twice daily, or you can trigger an immediate update through GitHub Actions.

### Tips

* The sync process preserves special characters and formatting
* Empty cells remain as `null` values in the JSON
* If you're familiar with the old JSON editing method, that still works too!

### Need Help?

If you run into any issues or have questions, you know where to find me
