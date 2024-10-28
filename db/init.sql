-- Vytvoření tabulky profiles
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    rank INTEGER DEFAULT 1000 NOT NULL,
    total_games INTEGER DEFAULT 0 NOT NULL,
    wins INTEGER DEFAULT 0 NOT NULL,
    losses INTEGER DEFAULT 0 NOT NULL
);

-- Vytvoření tabulky game_history
CREATE TABLE game_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES profiles(id) NOT NULL,
    opponent_id UUID REFERENCES profiles(id) NOT NULL,
    winner_id UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    game_duration INTERVAL NOT NULL,
    player_deck JSONB NOT NULL,
    opponent_deck JSONB NOT NULL
);

-- Vytvoření indexů pro lepší výkon
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_game_history_player_id ON game_history(player_id);
CREATE INDEX idx_game_history_opponent_id ON game_history(opponent_id);
CREATE INDEX idx_game_history_created_at ON game_history(created_at);

-- Nastavení Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

-- Policies pro profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Přidáme novou policy pro INSERT
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Přidáme novou policy pro registraci
CREATE POLICY "Enable insert for authentication users only"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policies pro game_history
CREATE POLICY "Game history viewable by participants"
    ON game_history FOR SELECT
    USING (
        auth.uid() = player_id OR 
        auth.uid() = opponent_id
    );

CREATE POLICY "Game history insertable by server only"
    ON game_history FOR INSERT
    WITH CHECK (true);  -- Bude omezeno na server-side pomocí service role

-- Trigger pro aktualizaci updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Přidáme novou funkci pro vytvoření profilu
CREATE OR REPLACE FUNCTION create_profile(
    user_id UUID,
    user_username TEXT,
    initial_rank INTEGER
)
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO profiles (
        id,
        username,
        rank,
        total_games,
        wins,
        losses
    )
    VALUES (
        user_id,
        user_username,
        initial_rank,
        0,
        0,
        0
    )
    RETURNING *;
END;
$$;

-- Přidáme oprávnění pro anonymní uživatele k volání funkce
GRANT EXECUTE ON FUNCTION create_profile(UUID, TEXT, INTEGER) TO anon;

-- Přidáme UNIQUE constraint pro username, pokud již neexistuje
ALTER TABLE profiles 
ADD CONSTRAINT unique_username UNIQUE (username);
