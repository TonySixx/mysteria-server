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

-- Přidáme tabulku pro karty
CREATE TABLE cards (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    mana_cost INTEGER NOT NULL,
    attack INTEGER,
    health INTEGER,
    effect TEXT,
    image TEXT NOT NULL,
    rarity TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('unit', 'spell')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Přidáme tabulku pro balíčky karet
CREATE TABLE decks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_active BOOLEAN DEFAULT false
);

-- Přidáme tabulku pro karty v balíčku
CREATE TABLE deck_cards (
    deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
    card_id INTEGER REFERENCES cards(id),
    quantity INTEGER CHECK (quantity > 0 AND quantity <= 2),
    PRIMARY KEY (deck_id, card_id)
);

-- Přidáme trigger pro kontrolu počtu karet v balíčku
CREATE OR REPLACE FUNCTION check_deck_size()
RETURNS TRIGGER AS $$
DECLARE
    total_cards INTEGER;
BEGIN
    SELECT SUM(quantity) INTO total_cards
    FROM deck_cards
    WHERE deck_id = NEW.deck_id;

    IF total_cards > 30 THEN
        RAISE EXCEPTION 'Deck cannot contain more than 30 cards';
    END IF;

    -- Kontrola legendary karet
    IF EXISTS (
        SELECT 1 
        FROM cards c
        JOIN deck_cards dc ON c.id = dc.card_id
        WHERE dc.deck_id = NEW.deck_id 
        AND c.rarity = 'legendary' 
        AND dc.quantity > 1
    ) THEN
        RAISE EXCEPTION 'Legendary cards can only have one copy in deck';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_deck_size_trigger
AFTER INSERT OR UPDATE ON deck_cards
FOR EACH ROW
EXECUTE FUNCTION check_deck_size();

-- Přidáme indexy pro lepší výkon
CREATE INDEX idx_deck_cards_deck_id ON deck_cards(deck_id);
CREATE INDEX idx_deck_cards_card_id ON deck_cards(card_id);
CREATE INDEX idx_decks_user_id ON decks(user_id);

-- Přidáme RLS policies
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Policies pro karty
CREATE POLICY "Cards are viewable by everyone"
    ON cards FOR SELECT
    USING (true);

-- Policies pro balíčky
CREATE POLICY "Users can view own decks"
    ON decks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own decks"
    ON decks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own decks"
    ON decks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own decks"
    ON decks FOR DELETE
    USING (auth.uid() = user_id);

-- Policies pro karty v balíčku
CREATE POLICY "Users can view own deck cards"
    ON deck_cards FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM decks
        WHERE decks.id = deck_cards.deck_id
        AND decks.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert cards to own decks"
    ON deck_cards FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM decks
        WHERE decks.id = deck_cards.deck_id
        AND decks.user_id = auth.uid()
    ));

CREATE POLICY "Users can update cards in own decks"
    ON deck_cards FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM decks
        WHERE decks.id = deck_cards.deck_id
        AND decks.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete cards from own decks"
    ON deck_cards FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM decks
        WHERE decks.id = deck_cards.deck_id
        AND decks.user_id = auth.uid()
    ));

-- Vložení základních karet do databáze
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    ('Fire Elemental', 4, 5, 6, 'Deals 2 damage when played', 'fireElemental', 'rare', 'unit'),
    ('Shield Bearer', 2, 1, 7, 'Taunt', 'shieldBearer', 'common', 'unit'),
    ('Water Elemental', 3, 3, 5, 'Freeze enemy when played', 'waterElemental', 'rare', 'unit'),
    ('Earth Golem', 5, 4, 8, 'Taunt', 'earthGolem', 'uncommon', 'unit'),
    ('Nimble Sprite', 1, 1, 2, 'Draw a card when played', 'nimbleSprite', 'common', 'unit'),
    ('Arcane Familiar', 1, 1, 3, 'Gain +1 attack for each spell cast', 'arcaneFamiliar', 'epic', 'unit'),
    ('Fireball', 4, NULL, NULL, 'Deal 6 damage', 'fireball', 'uncommon', 'spell'),
    ('Lightning Bolt', 2, NULL, NULL, 'Deal 3 damage', 'lightningBolt', 'common', 'spell'),
    ('Healing Touch', 3, NULL, NULL, 'Restore 8 health', 'healingTouch', 'common', 'spell'),
    ('Arcane Intellect', 3, NULL, NULL, 'Draw 2 cards', 'arcaneIntellect', 'rare', 'spell'),
    ('Glacial Burst', 3, NULL, NULL, 'Freeze all enemy minions', 'glacialBurst', 'epic', 'spell'),
    ('Inferno Wave', 7, NULL, NULL, 'Deal 4 damage to all enemy minions', 'infernoWave', 'epic', 'spell');

-- Přidání nových karet do databáze (přidat za existující INSERT příkazy)
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    -- Legendární ochránce
    ('Radiant Protector', 6, 4, 5, 'Taunt, Divine Shield', 'radiantProtector', 'legendary', 'unit'),
    
    -- Nové jednotky
    ('Shadow Assassin', 3, 4, 2, 'Deal 2 damage to enemy hero when played', 'shadowAssassin', 'rare', 'unit'),
    ('Mana Wyrm', 2, 2, 3, 'Gain +1 attack when you cast a spell', 'manaWyrm', 'rare', 'unit'),
    ('Soul Collector', 5, 3, 4, 'Draw a card when this minion kills an enemy', 'soulCollector', 'epic', 'unit'),
    
    -- Nová kouzla
    ('Mind Control', 8, NULL, NULL, 'Take control of an enemy minion', 'mindControl', 'epic', 'spell'),
    ('Arcane Explosion', 2, NULL, NULL, 'Deal 1 damage to all enemy minions', 'arcaneExplosion', 'common', 'spell'),
    ('Holy Nova', 5, NULL, NULL, 'Deal 2 damage to all enemies and restore 2 health to all friendly characters', 'holyNova', 'rare', 'spell');

-- Přidání nových karet do databáze (přidat za existující INSERT příkazy)
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    -- Legendární jednotky
    ('Time Weaver', 8, 6, 8, 'At the end of your turn, restore 2 health to all friendly characters', 'timeWeaver', 'legendary', 'unit'),
    ('Mana Leech', 6, 5, 5, 'When this minion deals damage, restore that much mana to you', 'manaLeech', 'legendary', 'unit'),
    
    -- Epické jednotky
    ('Mirror Entity', 4, 3, 3, 'Copy a random enemy minion stats when played', 'mirrorEntity', 'epic', 'unit'),
    ('Mana Golem', 3, 0, 4, 'Attack equals your current mana crystals', 'manaGolem', 'epic', 'unit'),
    
    -- Vzácné jednotky
    ('Spirit Healer', 5, 4, 4, 'When you cast a spell, restore 2 health to your hero', 'spiritHealer', 'rare', 'unit'),
    ('Spell Seeker', 2, 2, 3, 'Draw a random spell from your deck when played', 'spellSeeker', 'rare', 'unit'),
    
    -- Kouzla
    ('Mana Surge', 3, NULL, NULL, 'Restore your mana crystals to maximum available this turn', 'manaSurge', 'epic', 'spell'),
    ('Soul Exchange', 5, NULL, NULL, 'Swap the health of your hero with the enemy hero', 'soulExchange', 'legendary', 'spell'),
    ('Arcane Storm', 7, NULL, NULL, 'Deal 1 damage to all characters for each spell cast by both players this game', 'arcaneStorm', 'epic', 'spell'),
    ('Mirror Image', 2, NULL, NULL, 'Create two 0/2 Mirror Images with Taunt', 'mirrorImage', 'rare', 'spell');

-- Přidáme indexy pro rychlejší vyhledávání
CREATE INDEX idx_cards_type ON cards(type);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_mana_cost ON cards(mana_cost);

-- Upravíme efekt Shadow Assassin
UPDATE cards 
SET effect = 'Deal 2 damage to enemy hero when played', attack = 4, health = 2 
WHERE name = 'Shadow Assassin';

-- Upravíme cenu many pro Mind Control
UPDATE cards 
SET mana_cost = 6, effect = 'Take control of a random enemy minion' 
WHERE name = 'Mind Control';

-- Odstraníme starý constraint
ALTER TABLE decks DROP CONSTRAINT IF EXISTS unique_active_deck_per_user;

-- Přidáme nový trigger pro kontrolu aktivních balíčků
CREATE OR REPLACE FUNCTION check_active_decks()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        -- Deaktivujeme všechny ostatní balíčky uživatele
        UPDATE decks 
        SET is_active = false 
        WHERE user_id = NEW.user_id 
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_active_deck
    BEFORE INSERT OR UPDATE ON decks
    FOR EACH ROW
    EXECUTE FUNCTION check_active_decks();

-- Přidání nových common jednotek
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    ('Mana Crystal', 1, 1, 3, 'When this minion dies, gain 1 mana crystal', 'manaCrystal', 'common', 'unit'),
    ('Healing Wisp', 2, 2, 2, 'When this minion attacks, restore 1 health to your hero', 'healingWisp', 'common', 'unit'),
    ('Arcane Guardian', 3, 2, 4, 'Has +1 health for each spell in your hand', 'arcaneGuardian', 'common', 'unit');

-- Upravíme popisek pro Mana Surge
UPDATE cards 
SET effect = 'Restore your mana crystals to maximum available this turn' 
WHERE name = 'Mana Surge';

-- Upravíme popisek pro Arcane Storm
UPDATE cards 
SET effect = 'Deal 1 damage to all characters for each spell cast by both players this game' 
WHERE name = 'Arcane Storm';

UPDATE cards 
SET effect = 'Gain +1 attack when you cast a spell' 
WHERE name = 'Arcane Familiar';

-- Přidání nových common a uncommon jednotek
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    -- Common jednotky
    ('Mana Siphon', 2, 2, 2, 'When this minion attacks, gain 1 mana crystal this turn only', 'manaSiphon', 'common', 'unit'),
    ('Defensive Scout', 3, 1, 5, 'When this minion is attacked, draw a card', 'defensiveScout', 'common', 'unit'),
    
    -- Uncommon jednotky
    ('Spell Breaker', 4, 3, 4, 'Enemy spells cost 1 more mana while this minion is alive', 'spellBreaker', 'uncommon', 'unit'),
    ('Twin Blade', 3, 2, 4, 'This minion can attack twice each turn', 'twinBlade', 'uncommon', 'unit'),
    ('Mana Collector', 5, 3, 6, 'At the start of your turn, gain mana equal to this minions attack', 'manaCollector', 'uncommon', 'unit');