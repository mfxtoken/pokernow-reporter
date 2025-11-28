-- PokerNow Reporter - Supabase Database Schema
-- Run this script in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE
-- =====================================================
-- Links authenticated users to their player names
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  player_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- GAMES TABLE
-- =====================================================
-- Stores poker game data
CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  game_id TEXT UNIQUE NOT NULL,
  date TEXT,
  total_pot NUMERIC,
  winner TEXT,
  winner_profit NUMERIC,
  player_count INTEGER,
  players JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policies for games (allow all authenticated users to read/write)
CREATE POLICY "Authenticated users can view games"
  ON games FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert games"
  ON games FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update games"
  ON games FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- SETTLEMENTS TABLE
-- =====================================================
-- Tracks settlement verification status
CREATE TABLE IF NOT EXISTS settlements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  debtor TEXT NOT NULL,
  creditor TEXT NOT NULL,
  amount NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pending_approval', 'paid', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(debtor, creditor)
);

-- Enable Row Level Security
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Policies for settlements (allow all authenticated users to read/write)
CREATE POLICY "Authenticated users can view settlements"
  ON settlements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert settlements"
  ON settlements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update settlements"
  ON settlements FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- INDEXES
-- =====================================================
-- Improve query performance
CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(date);
CREATE INDEX IF NOT EXISTS idx_games_uploaded_by ON games(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_settlements_debtor ON settlements(debtor);
CREATE INDEX IF NOT EXISTS idx_settlements_creditor ON settlements(creditor);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

-- =====================================================
-- FUNCTIONS
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settlements_updated_at ON settlements;
CREATE TRIGGER update_settlements_updated_at
  BEFORE UPDATE ON settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check if tables were created successfully
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'games', 'settlements')
ORDER BY tablename;

-- Display message
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE 'Tables created: profiles, games, settlements';
  RAISE NOTICE 'Row Level Security enabled on all tables';
  RAISE NOTICE 'Indexes and triggers configured';
END $$;
