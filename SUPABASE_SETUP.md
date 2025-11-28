# How to Get Your Supabase Anon Key

## Steps:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on the **Settings** icon (⚙️) in the left sidebar
4. Click on **API** in the settings menu
5. Under "Project API keys", find the **anon** **public** key
6. Copy the long token (starts with "eyJ...")
7. Paste it in your .env file after VITE_SUPABASE_ANON_KEY=

## Your .env file should look like:
```
VITE_SUPABASE_URL=https://gbrzevagokgwsbaasvax.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicnpldmFnb2tnd3NiYWFzdmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg1NzY4MDAsImV4cCI6MjAxNDE1MjgwMH0.YOUR_ACTUAL_KEY_HERE
```

## Note:
- The database connection string (postgresql://...) is for direct database access
- The web app needs the HTTP API URL and anon key
- These are different credentials for different purposes
