-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  avatar TEXT,
  streak INTEGER DEFAULT 0,
  analyzed_count INTEGER DEFAULT 0,
  last_active_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid()::text);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid()::text);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid()::text);

CREATE TABLE IF NOT EXISTS user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id),
  settings_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON user_settings FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE TABLE IF NOT EXISTS analyzed_games (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  pgn TEXT NOT NULL,
  result TEXT,
  white TEXT,
  black TEXT,
  date TEXT,
  accuracy_white REAL,
  accuracy_black REAL,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analyzed_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own games"
  ON analyzed_games FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own games"
  ON analyzed_games FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
