-- PokerNow Reporter - Supabase Database Schema (FIXED)
-- Run this script in your Supabase SQL Editor to fix the "failed to choose public profile" error
-- This script drops and recreates all tables and policies to ensure clean setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE
-- =====================================================
-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  player_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts (now that table exists)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create policies for profiles (users can manage their own profile)
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
-- Create games table if it doesn't exist
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

-- Drop existing policies first (now that table exists)
DROP POLICY IF EXISTS "Authenticated users can view games" ON games;
DROP POLICY IF EXISTS "Authenticated users can insert games" ON games;
DROP POLICY IF EXISTS "Authenticated users can update games" ON games;

-- Create policies for games (allow all authenticated users to read/write)
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
-- Create settlements table if it doesn't exist
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

-- Drop existing policies first (now that table exists)
DROP POLICY IF EXISTS "Authenticated users can view settlements" ON settlements;
DROP POLICY IF EXISTS "Authenticated users can insert settlements" ON settlements;
DROP POLICY IF EXISTS "Authenticated users can update settlements" ON settlements;

-- Create policies for settlements (allow all authenticated users to read/write)
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
-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_games_game_id;
DROP INDEX IF EXISTS idx_games_date;
DROP INDEX IF EXISTS idx_games_uploaded_by;
DROP INDEX IF EXISTS idx_settlements_debtor;
DROP INDEX IF EXISTS idx_settlements_creditor;
DROP INDEX IF EXISTS idx_settlements_status;

-- Create indexes for better query performance
CREATE INDEX idx_games_game_id ON games(game_id);
CREATE INDEX idx_games_date ON games(date);
CREATE INDEX idx_games_uploaded_by ON games(uploaded_by);
CREATE INDEX idx_settlements_debtor ON settlements(debtor);
CREATE INDEX idx_settlements_creditor ON settlements(creditor);
CREATE INDEX idx_settlements_status ON settlements(status);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_settlements_updated_at ON settlements;

-- Create triggers to auto-update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at
  BEFORE UPDATE ON settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Verify tables were created
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'games', 'settlements')
ORDER BY tablename;

-- Verify RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'games', 'settlements')
ORDER BY tablename, cmd;

-- Display success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created/updated successfully!';
  RAISE NOTICE 'Tables: profiles, games, settlements';
  RAISE NOTICE 'Row Level Security: ENABLED on all tables';
  RAISE NOTICE 'Policies: Recreated to fix profile linking error';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Fix Applied: Profile linking should now work correctly';
  RAISE NOTICE 'Try linking your profile again in the app!';
END $$;
