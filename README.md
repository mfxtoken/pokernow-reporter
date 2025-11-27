# PokerNow Reporter

A comprehensive poker game tracking and analytics application built with React, Vite, and Tailwind CSS.

## Features

- 📊 **Consolidated Player Statistics** - Track player performance across multiple games with detailed rankings
- 💾 **Persistent Storage** - IndexedDB for reliable data storage that survives browser restarts
- 💰 **Settlement Calculator** - Optimized "who pays whom" calculations for easy money transfers
- 📤 **Multiple CSV Upload** - Import multiple game ledgers at once
- 🔄 **Backup & Restore** - Export/import database backups in JSON format
- 👥 **Player Aliases** - Map usernames to full names for better readability
- 📈 **Win Rate Analytics** - Color-coded performance indicators
- 📥 **CSV Export** - Generate comprehensive reports
- 🎯 **Rank Badges** - Gold, Silver, Bronze medals for top performers

## Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/pokernow-reporter.git
cd pokernow-reporter

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Usage

### 1. Upload CSV Files
- Click the upload area and select PokerNow ledger CSV files
- Multiple files can be uploaded at once
- Files are automatically parsed and saved to the database

### 2. View Statistics
- **Consolidated Player Statistics**: See all players ranked by total net P/L
- **Individual Games**: View detailed breakdown of each game
- **Win Rates**: Color-coded percentages (Green ≥50%, Yellow 25-49%, Red <25%)

### 3. Check Settlements
- Optimized payment calculations
- Shows "who pays whom" with minimum transactions
- Displays actual money values

### 4. Backup & Restore
- **Backup**: Export entire database to JSON file
- **Restore**: Import previously saved backup
- **Copy to Clipboard**: Alternative backup method

### 5. Generate Reports
- Export detailed CSV reports with all statistics
- Includes player stats, game summaries, and settlements

## CSV Format

Your PokerNow CSV should have these columns:
```
player_nickname, buy_in, buy_out, net, session_start_at
cs, 1000, 1500, 500, 2024-01-01T10:00:00Z
sas, 1000, 500, -500, 2024-01-01T10:00:00Z
```

## Player Aliases

The app supports mapping short usernames to full names. Edit the `playerAliases` object in `App.jsx`:

```javascript
const playerAliases = {
  'cs': 'Chintan Shah',
  'sas': 'Simal Shah',
  // Add more aliases here
};
```

## Technologies

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **IndexedDB** - Client-side database
- **Lucide React** - Icons

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel auto-detects Vite settings
6. Click "Deploy"

### Deploy to Netlify

1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "Add new site"
4. Import from GitHub
5. Build command: `npm run build`
6. Publish directory: `dist`

## Local Development

```bash
# Start dev server
npm run dev

# Open browser
http://localhost:5173
```

## Project Structure

```
pokernow-reporter/
├── public/           # Static assets
├── src/
│   ├── App.jsx      # Main application component
│   ├── database.js  # IndexedDB wrapper
│   ├── main.jsx     # Entry point
│   └── index.css    # Global styles
├── index.html       # HTML template
├── package.json     # Dependencies
├── vite.config.js   # Vite configuration
├── tailwind.config.js
└── vercel.json      # Vercel deployment config
```

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with IndexedDB support

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

## Support

If you encounter any issues, please open a GitHub issue with:
- Browser version
- Steps to reproduce
- Console error messages (F12 → Console)
