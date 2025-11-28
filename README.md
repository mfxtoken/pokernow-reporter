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

# Configure Supabase (optional - for cloud sync and auth)
cp .env.example .env
# Edit .env and add your Supabase credentials

# Run development server
npm run dev

# Build for production
npm run build
```

## Supabase Configuration (Optional)

For cloud sync, authentication, and settlement verification features, you need to set up Supabase:

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Note your project URL and anon key

### 2. Run Database Schema
Execute this SQL in your Supabase SQL Editor:

```sql
-- Profiles table
create table profiles (
  id uuid references auth.users primary key,
  player_name text,
  updated_at timestamp with time zone default now()
);

-- Settlements table
create table settlements (
  id uuid default gen_random_uuid() primary key,
  debtor text not null,
  creditor text not null,
  amount numeric,
  status text default 'pending',
  updated_at timestamp with time zone default now(),
  unique(debtor, creditor)
);

-- Games table
create table games (
  id uuid default gen_random_uuid() primary key,
  game_id text unique not null,
  date text,
  total_pot numeric,
  winner text,
  winner_profit numeric,
  player_count integer,
  players jsonb,
  created_at timestamp with time zone default now()
);
```

### 3. Configure Environment Variables

**Option A: Environment Variables (Recommended for deployment)**
```bash
# Edit .env file
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Option B: UI Setup (Alternative)**
- Click "Setup Cloud" button in the app
- Enter your Supabase URL and Anon Key
- Credentials will be saved in browser localStorage

> **Note:** Environment variables take priority over localStorage credentials.

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
5. **IMPORTANT: Configure Environment Variables**
   - Expand the "Environment Variables" section
   - Add `VITE_SUPABASE_URL` with your value
   - Add `VITE_SUPABASE_ANON_KEY` with your value
6. Click "Deploy"

### Troubleshooting Deployment
If you see "Supabase not configured" in your deployed app:
1. Go to your Vercel Project Settings
2. Click on **Environment Variables**
3. Check if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are added
4. If missing, add them and redeploy (Go to Deployments -> Redeploy)

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

---
*Last updated: 2025-11-28*
