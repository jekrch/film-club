# Criterion Club Website

https://criterionclub.org

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
http://localhost:5173

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


## 🎬 Hey, updating the site is EASY

YOU can update the website without writing any code. This guide will walk you through making changes to our film data and user profiles.

### Where to Find the Files

You can update two main JSON files:
* **Film Data**: [/src/assets/films.json](https://github.com/jekrch/film-club/blob/main/src/assets/films.json)
* **User Profiles**: [/src/assets/club.json](https://github.com/jekrch/film-club/blob/main/src/assets/club.json)

### How to Update a File (The Easy Way)

1. **Navigate to the file** you want to update by clicking one of the links above
2. **Click the pencil icon** (✏️) in the top-right corner of the file view
3. **Make your changes** directly in the editor
   * For films: update your scores, trophy notes, and more
   * For users: Update your profile info, bio, interview questions
4. **Scroll down** to the "Commit changes" section
5. Select "Commit directly to the main branch"
6. **Click the green "Commit changes" button**

### How to Update Your Film Score

Navigate to the Film Data file using the link above
Find the film you want to score in the list
Look for the "clubRatings" section that looks like this:
```
"clubRatings": {
  "andy": null,
  "gabe": null,
  "jacob": 6.5,
  "joey": null
}
```
Find your name and replace the null with your score (a number)
Commit your changes as described above

### What Happens Next?

Once you commit your changes, GitHub will automagically publish the updated website. Someone really made this easy! Within a few minutes, your changes will appear on [criterionclub.org](https://criterionclub.org)!

### Important Tips

* **JSON Formatting Matters**: Make sure you maintain the correct format with commas, brackets, and quotes
* **Preview Your Changes**: Use the "Preview" tab to make sure everything looks right before committing
* **Don't Worry About Breaking Things**: If something goes wrong, we can always restore a previous version

### Need Help?

If you run into any issues or have questions, you know where to find me
