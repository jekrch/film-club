# Criterion Club Website

https://jekrch.github.io/film-club

A web application for tracking films watched and reviewed by the Criterion Club, a group of four friends who watch Criterion Channel films and discuss them via Zoom.

Users can browse films we've watched, see reviews from each member, and explore our individual profiles.

## Tech Stack

- React
- Vite
- Bun
- Tailwind
- TypeScript

## Project Structure

Data for the website is managed through JSON files:
- `src/assets/club.json` - Club member information
- `src/assets/films.json` - Film data and reviews

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
http://localhost:5173/film-club/

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

### Member Data

Edit `src/assets/club.json` to update member information.

### Film Data

Edit `src/assets/films.json` to add new films or reviews.

### Profile Pictures

1. Name your image file as `[firstname].jpg` (lowercase)
2. Place it in the `public/images/` directory
3. The change will be reflected automatically

## Deployment

The site is automatically deployed to GitHub Pages using GitHub Actions.

### Deployment Process

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
