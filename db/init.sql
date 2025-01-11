-- Vytvoření tabulky profiles
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    rank INTEGER DEFAULT 1000 NOT NULL,
    total_games INTEGER DEFAULT 0 NOT NULL,
    wins INTEGER DEFAULT 0 NOT NULL,
    losses INTEGER DEFAULT 0 NOT NULL,
    hero_id INTEGER REFERENCES heroes(id) DEFAULT 1
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


-- Přidání nových tabulek pro systém karet a výzev

-- Tabulka pro měnu hráče
CREATE TABLE player_currency (
    player_id UUID REFERENCES profiles(id) PRIMARY KEY,
    gold_amount INTEGER DEFAULT 100 NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tabulka pro vlastněné karty hráče
CREATE TABLE player_cards (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES profiles(id) NOT NULL,
    card_id INTEGER REFERENCES cards(id) NOT NULL,
    quantity INTEGER DEFAULT 0 NOT NULL,
    obtained_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(player_id, card_id)
);

-- Tabulka pro balíčky karet
CREATE TABLE card_packs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    rarity_distribution JSONB NOT NULL,
    image TEXT NOT NULL
);

-- Tabulka pro výzvy
CREATE TABLE challenges (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    reward_gold INTEGER NOT NULL,
    condition_type TEXT NOT NULL,
    condition_value INTEGER NOT NULL,
    reset_period TEXT CHECK (reset_period IN ('daily', 'weekly', NULL))
);

-- Tabulka pro progress hráčů ve výzvách
CREATE TABLE player_challenges (
    player_id UUID REFERENCES profiles(id),
    challenge_id INTEGER REFERENCES challenges(id),
    progress INTEGER DEFAULT 0 NOT NULL,
    completed BOOLEAN DEFAULT false,
    last_reset TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (player_id, challenge_id)
);

-- Přidání indexů
CREATE INDEX idx_player_cards_player_id ON player_cards(player_id);
CREATE INDEX idx_player_challenges_player_id ON player_challenges(player_id);

-- Přidání RLS policies
ALTER TABLE player_currency ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_challenges ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own currency"
    ON player_currency FOR SELECT
    USING (auth.uid() = player_id);

CREATE POLICY "Users can view own cards"
    ON player_cards FOR SELECT
    USING (auth.uid() = player_id);

CREATE POLICY "Everyone can view card packs"
    ON card_packs FOR SELECT
    USING (true);

CREATE POLICY "Everyone can view challenges"
    ON challenges FOR SELECT
    USING (true);

CREATE POLICY "Users can view own challenge progress"
    ON player_challenges FOR SELECT
    USING (auth.uid() = player_id);

-- Vložení základních balíčků karet
INSERT INTO card_packs (name, description, price, rarity_distribution, image) VALUES
    ('Basic Pack', 'Contains 3 cards with at least one rare', 100, 
    '{"common": 70, "rare": 20, "epic": 9, "legendary": 1}', 'basic_pack'),
    ('Premium Pack', 'Contains 3 cards with at least one epic', 300, 
    '{"common": 0, "rare": 70, "epic": 25, "legendary": 5}', 'premium_pack');

-- Vložení základních výzev
INSERT INTO challenges (name, description, reward_gold, condition_type, condition_value, reset_period) VALUES
    ('Win Streak', 'Win 3 games in a row', 300, 'win_streak', 3, NULL),
    ('Daily Player', 'Play 5 games today', 100, 'games_played', 5, 'daily'),
    ('Weekly Champion', 'Win 10 games this week', 500, 'games_won', 10, 'weekly');

-- Trigger pro vytvoření základního měšce při registraci
CREATE OR REPLACE FUNCTION create_player_currency()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO player_currency (player_id, gold_amount)
    VALUES (NEW.id, 100);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_player_currency_trigger
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_player_currency();

-- Trigger pro přidání základních karet novému hráči
CREATE OR REPLACE FUNCTION add_starter_cards()
RETURNS TRIGGER AS $$
BEGIN
    -- Přidání základních karet (každá karta 2x)
    INSERT INTO player_cards (player_id, card_id, quantity)
    VALUES 
        (NEW.id, 1, 2),
        (NEW.id, 2, 2),
        (NEW.id, 3, 2),
        (NEW.id, 4, 2),
        (NEW.id, 5, 2),
        (NEW.id, 7, 2),
        (NEW.id, 8, 2),
        (NEW.id, 9, 2),
        (NEW.id, 10, 2),
        (NEW.id, 11, 2),
        (NEW.id, 15, 2),
        (NEW.id, 18, 2),
        (NEW.id, 32, 2),
        (NEW.id, 38, 2),
        (NEW.id, 39, 2),
        (NEW.id, 45, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER add_starter_cards_trigger
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION add_starter_cards();

-- Upravíme distribuci vzácností v balíčcích
UPDATE card_packs 
SET rarity_distribution = '{"common": 60, "uncommon": 25, "rare": 7, "epic": 5, "legendary": 3}'
WHERE name = 'Basic Pack';

UPDATE card_packs 
SET rarity_distribution = '{"common": 0, "uncommon": 5, "rare": 60, "epic": 25, "legendary": 10}'
WHERE name = 'Premium Pack';

DROP FUNCTION IF EXISTS generate_pack_cards(INTEGER, UUID);

-- Funkce pro generování karet z balíčku
CREATE OR REPLACE FUNCTION generate_pack_cards(
    p_pack_id INTEGER,
    p_user_id UUID
)
RETURNS TABLE (
    card_id INTEGER,
    card_name TEXT,
    card_rarity TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pack_distribution JSONB;
    pack_name TEXT;
    selected_rarity TEXT;
    rarity_weight RECORD;
    total_weight FLOAT := 0;
    random_num FLOAT;
    cumulative_weight FLOAT;
    rarities TEXT[];
    weights FLOAT[];
BEGIN
    -- Získáme distribuci vzácností a jméno balíčku
    SELECT cp.rarity_distribution, cp.name INTO pack_distribution, pack_name
    FROM card_packs cp
    WHERE cp.id = p_pack_id;

    -- První karta je vždy garantovaná
    IF pack_name = 'Basic Pack' THEN
        -- Pro Basic Pack garantujeme rare kartu
        selected_rarity := 'rare';
    ELSE -- Premium Pack
        -- Pro Premium Pack garantujeme epic kartu
        selected_rarity := 'epic';
    END IF;

    -- Vrátíme garantovanou kartu
    RETURN QUERY
    SELECT 
        c.id AS card_id,
        c.name AS card_name,
        c.rarity AS card_rarity
    FROM cards c
    WHERE c.rarity = selected_rarity
    ORDER BY random()
    LIMIT 1;

    -- Připravíme pole vzácností a jejich váhy z rarity_distribution
    rarities := ARRAY[]::TEXT[];
    weights := ARRAY[]::FLOAT[];
    total_weight := 0;

    FOR rarity_weight IN SELECT key AS rarity, value::FLOAT AS weight FROM jsonb_each_text(pack_distribution)
    LOOP
        rarities := array_append(rarities, rarity_weight.rarity);
        weights := array_append(weights, rarity_weight.weight);
        total_weight := total_weight + rarity_weight.weight;
    END LOOP;

    -- Generujeme zbylé dvě karty podle procentuální distribuce
    FOR i IN 1..2 LOOP
        random_num := random() * total_weight;
        cumulative_weight := 0;
        selected_rarity := NULL;

        FOR j IN 1..array_length(rarities, 1) LOOP
            cumulative_weight := cumulative_weight + weights[j];
            IF random_num <= cumulative_weight THEN
                selected_rarity := rarities[j];
                EXIT;
            END IF;
        END LOOP;

        -- Vrátíme náhodnou kartu dané vzácnosti
        RETURN QUERY
        SELECT 
            c.id AS card_id,
            c.name AS card_name,
            c.rarity AS card_rarity
        FROM cards c
        WHERE c.rarity = selected_rarity
        ORDER BY random()
        LIMIT 1;
    END LOOP;
END;
$$;


-- Nejprve odstraníme existující funkci
DROP FUNCTION IF EXISTS purchase_card_pack(INTEGER, UUID);

--- Upravíme funkci purchase_card_pack
CREATE OR REPLACE FUNCTION purchase_card_pack(
    p_pack_id INTEGER,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pack_price INTEGER;
    user_gold INTEGER;
    card_record RECORD;
    result_cards JSONB := '[]'::JSONB;
BEGIN
    -- Získáme cenu balíčku a zlato hráče
    SELECT cp.price INTO pack_price 
    FROM card_packs cp 
    WHERE cp.id = p_pack_id;

    SELECT pc.gold_amount INTO user_gold 
    FROM player_currency pc 
    WHERE pc.player_id = p_user_id;

    -- Kontrola dostatku zlata
    IF user_gold < pack_price THEN
        RAISE EXCEPTION 'Nedostatek zlata pro nákup balíčku';
    END IF;

    -- Odečteme zlato
    UPDATE player_currency
    SET gold_amount = gold_amount - pack_price
    WHERE player_id = p_user_id;

    -- Získáme všechny tři karty najednou
    FOR card_record IN 
        SELECT c.* 
        FROM generate_pack_cards(p_pack_id, p_user_id) gc
        JOIN cards c ON c.id = gc.card_id
    LOOP
        -- Přidáme kartu do kolekce hráče
        INSERT INTO player_cards (player_id, card_id, quantity)
        VALUES (p_user_id, card_record.id, 1)
        ON CONFLICT (player_id, card_id)
        DO UPDATE SET quantity = player_cards.quantity + 1;

        -- Přidáme kartu do výsledku
        result_cards := result_cards || jsonb_build_object(
            'id', card_record.id,
            'name', card_record.name,
            'mana_cost', card_record.mana_cost,
            'attack', card_record.attack,
            'health', card_record.health,
            'effect', card_record.effect,
            'image', card_record.image,
            'rarity', card_record.rarity,
            'type', card_record.type
        );
    END LOOP;

    RETURN result_cards;
END;
$$;

-- Přidáme oprávnění pro volán funkce
GRANT EXECUTE ON FUNCTION purchase_card_pack(INTEGER, UUID) TO authenticated;

-- Přidáme RLS policy pro player_currency
DROP POLICY IF EXISTS "Users can update own currency" ON player_currency;
CREATE POLICY "Users can update own currency"
    ON player_currency
    FOR UPDATE
    USING (auth.uid() = player_id)
    WITH CHECK (auth.uid() = player_id);

-- Přidáme RLS policy pro player_cards
DROP POLICY IF EXISTS "Users can insert own cards" ON player_cards;
CREATE POLICY "Users can insert own cards"
    ON player_cards
    FOR INSERT
    WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can update own cards" ON player_cards;
CREATE POLICY "Users can update own cards"
    ON player_cards
    FOR UPDATE
    USING (auth.uid() = player_id)
    WITH CHECK (auth.uid() = player_id);


-- Funkce pro udělení odměny za splnění výzvy
CREATE OR REPLACE FUNCTION award_challenge_completion(
    p_player_id UUID,
    p_challenge_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_reward_gold INTEGER;
BEGIN
    -- Získáme odměnu za výzvu
    SELECT reward_gold INTO v_reward_gold
    FROM challenges
    WHERE id = p_challenge_id;

    -- Přidáme zlato hráči
    UPDATE player_currency
    SET gold_amount = gold_amount + v_reward_gold
    WHERE player_id = p_player_id;

    -- Označíme výzvu jako vyplacenou
    UPDATE player_challenges
    SET reward_claimed = true
    WHERE player_id = p_player_id
    AND challenge_id = p_challenge_id;
END;
$$;

-- Přidáme sloupec pro sledování vyplacených odměn
ALTER TABLE player_challenges
ADD COLUMN IF NOT EXISTS reward_claimed BOOLEAN DEFAULT false;

-- Přidáme oprávnění pro volání funkce
GRANT EXECUTE ON FUNCTION purchase_card_pack(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_pack_cards(INTEGER, UUID) TO authenticated;

-- Přidáme oprávnění pro přístup k potřebným tabulkám
GRANT SELECT ON card_packs TO authenticated;
GRANT SELECT, UPDATE ON player_currency TO authenticated;
GRANT SELECT, INSERT, UPDATE ON player_cards TO authenticated;
GRANT SELECT ON cards TO authenticated;

-- Přidáme všechna potřebná oprávnění
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION purchase_card_pack(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_pack_cards(INTEGER, UUID) TO authenticated;

-- Přidáme oprávnění pro všechny potřebné tabulky
GRANT SELECT ON card_packs TO authenticated;
GRANT SELECT, UPDATE ON player_currency TO authenticated;
GRANT SELECT, INSERT, UPDATE ON player_cards TO authenticated;
GRANT SELECT ON cards TO authenticated;

-- Přidáme RLS policies pro všechny tabulky
ALTER TABLE player_currency ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_packs ENABLE ROW LEVEL SECURITY;

-- RLS policies pro player_currency
CREATE POLICY "Users can view and update own currency"
    ON player_currency FOR ALL
    USING (auth.uid() = player_id)
    WITH CHECK (auth.uid() = player_id);

-- RLS policies pro player_cards
CREATE POLICY "Users can view and update own cards"
    ON player_cards FOR ALL
    USING (auth.uid() = player_id)
    WITH CHECK (auth.uid() = player_id);

-- Přidání RLS politik pro player_challenges
ALTER TABLE player_challenges ENABLE ROW LEVEL SECURITY;

-- Politika pro čtení vlastních výzev
CREATE POLICY "Users can view own challenges"
    ON player_challenges FOR SELECT
    USING (auth.uid() = player_id);

-- Politika pro přidání nových výzev
CREATE POLICY "Users can accept new challenges"
    ON player_challenges FOR INSERT
    WITH CHECK (auth.uid() = player_id);

-- Politika pro aktualizaci vlastních výzev
CREATE POLICY "Users can update own challenges"
    ON player_challenges FOR UPDATE
    USING (auth.uid() = player_id);

-- Politika pro smazání vlastních výzev
CREATE POLICY "Users can delete own challenges"
    ON player_challenges FOR DELETE
    USING (auth.uid() = player_id);

-- Politika pro čtení dostupných výzev
CREATE POLICY "Everyone can view challenges"
    ON challenges FOR SELECT
    USING (true);

-- Upravíme funkci pro reset výzev a získání aktuálních výzev
CREATE OR REPLACE FUNCTION get_player_challenges(p_player_id UUID)
RETURNS TABLE (
    challenge_id INTEGER,
    player_id UUID,
    progress INTEGER,
    completed BOOLEAN,
    last_reset TIMESTAMP WITH TIME ZONE,
    reward_claimed BOOLEAN,
    challenge_name TEXT,
    challenge_description TEXT,
    challenge_reward INTEGER,
    challenge_condition_type TEXT,
    challenge_condition_value INTEGER,
    challenge_reset_period TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Nejprve resetujeme prošlé výzvy
    UPDATE player_challenges pc
    SET progress = 0,
        completed = false,
        last_reset = NOW(),
        reward_claimed = false
    FROM challenges c
    WHERE pc.challenge_id = c.id
    AND pc.player_id = p_player_id
    AND (
        (c.reset_period = 'daily' AND pc.last_reset < NOW() - INTERVAL '1 day')
        OR 
        (c.reset_period = 'weekly' AND pc.last_reset < NOW() - INTERVAL '7 days')
    );

    -- Vrátíme aktuální výzvy
    RETURN QUERY
    SELECT 
        c.id AS challenge_id,
        pc.player_id,
        pc.progress,
        pc.completed,
        pc.last_reset,
        pc.reward_claimed,
        c.name AS challenge_name,
        c.description AS challenge_description,
        c.reward_gold AS challenge_reward,
        c.condition_type AS challenge_condition_type,
        c.condition_value AS challenge_condition_value,
        c.reset_period AS challenge_reset_period
    FROM player_challenges pc
    JOIN challenges c ON c.id = pc.challenge_id
    WHERE pc.player_id = p_player_id;
END;
$$;

-- Přidáme oprávnění pro volání funkce
GRANT EXECUTE ON FUNCTION get_player_challenges(UUID) TO authenticated;

-- Přidáme tabulku pro hrdiny
CREATE TABLE heroes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    ability_name TEXT NOT NULL,
    ability_description TEXT NOT NULL,
    ability_cost INTEGER DEFAULT 2,
    image TEXT NOT NULL
);

-- Přidáme sloupec hero_id do profiles
ALTER TABLE profiles ADD COLUMN hero_id INTEGER REFERENCES heroes(id) DEFAULT 1;

-- Vložíme základní hrdiny
INSERT INTO heroes (name, ability_name, ability_description, ability_cost, image) VALUES
    ('Mage', 'Fireblast', 'Deal 2 damage to enemy hero', 2, 'mage'),
    ('Priest', 'Lesser Heal', 'Restore 2 health to your hero', 2, 'priest');

-- Přidáme nové hrdiny do tabulky heroes
INSERT INTO heroes (name, ability_name, ability_description, ability_cost, image) VALUES
    ('Seer', 'Fortune Draw', 'Draw a random card from your deck', 2, 'seer'),
    ('Defender', 'Protect', 'Give a random friendly minion Taunt', 2, 'defender'),
    ('Warrior', 'Battle Command', 'Give a random friendly minion +1 Attack', 2, 'warrior'),
    ('Frost Mage', 'Frost Nova', 'Freeze a random enemy minion', 2, 'frostmage');

