--
-- PostgreSQL database dump
--


--
-- TOC entry 599 (class 1255 OID 46914)
-- Name: add_starter_cards(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_starter_cards() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.add_starter_cards() OWNER TO postgres;

--
-- TOC entry 600 (class 1255 OID 46919)
-- Name: award_challenge_completion(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.award_challenge_completion(p_player_id uuid, p_challenge_id integer) RETURNS void
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


ALTER FUNCTION public.award_challenge_completion(p_player_id uuid, p_challenge_id integer) OWNER TO postgres;

--
-- TOC entry 602 (class 1255 OID 32732)
-- Name: check_active_decks(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_active_decks() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.check_active_decks() OWNER TO postgres;

--
-- TOC entry 601 (class 1255 OID 32017)
-- Name: check_deck_size(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_deck_size() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.check_deck_size() OWNER TO postgres;

--
-- TOC entry 597 (class 1255 OID 46912)
-- Name: create_player_currency(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_player_currency() RETURNS trigger
    LANGUAGE plpgsql
    AS $$BEGIN
    INSERT INTO player_currency (player_id, gold_amount)
    VALUES (NEW.id, 500);
    RETURN NEW;
END;$$;


ALTER FUNCTION public.create_player_currency() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 331 (class 1259 OID 30264)
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    rank integer DEFAULT 1000 NOT NULL,
    total_games integer DEFAULT 0 NOT NULL,
    wins integer DEFAULT 0 NOT NULL,
    losses integer DEFAULT 0 NOT NULL,
    hero_id integer DEFAULT 1
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- TOC entry 596 (class 1255 OID 31016)
-- Name: create_profile(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_profile(user_id uuid, user_username text, initial_rank integer) RETURNS SETOF public.profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.create_profile(user_id uuid, user_username text, initial_rank integer) OWNER TO postgres;

--
-- TOC entry 393 (class 1255 OID 55754)
-- Name: delete_player_account(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_player_account(player_uuid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Smažeme všechny výzvy hráče
    DELETE FROM player_challenges
    WHERE player_id = player_uuid;

    -- Smažeme měnu hráče
    DELETE FROM player_currency
    WHERE player_id = player_uuid;

    -- Smažeme karty v balíčcích
    DELETE FROM deck_cards
    WHERE deck_id IN (
        SELECT id FROM decks WHERE user_id = player_uuid
    );

    -- Smažeme balíčky
    DELETE FROM decks
    WHERE user_id = player_uuid;

    -- Smažeme karty hráče
    DELETE FROM player_cards
    WHERE player_id = player_uuid;

    -- Smažeme historii her
    DELETE FROM game_history
    WHERE player_id = player_uuid OR opponent_id = player_uuid;

    -- Smažeme profil
    DELETE FROM profiles
    WHERE id = player_uuid;

    -- Smažeme auth.users záznam
    DELETE FROM auth.users
    WHERE id = player_uuid;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Chyba při mazání účtu: %', SQLERRM;
END;
$$;


ALTER FUNCTION public.delete_player_account(player_uuid uuid) OWNER TO postgres;

--
-- TOC entry 427 (class 1255 OID 49360)
-- Name: generate_pack_cards(integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_pack_cards(p_pack_id integer, p_user_id uuid) RETURNS TABLE(card_id integer, card_name text, card_rarity text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.generate_pack_cards(p_pack_id integer, p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 573 (class 1255 OID 51494)
-- Name: get_player_challenges(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_player_challenges(p_player_id uuid) RETURNS TABLE(challenge_id integer, player_id uuid, progress integer, completed boolean, last_reset timestamp with time zone, reward_claimed boolean, challenge_name text, challenge_description text, challenge_reward integer, challenge_condition_type text, challenge_condition_value integer, challenge_reset_period text)
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.get_player_challenges(p_player_id uuid) OWNER TO postgres;

--
-- TOC entry 412 (class 1255 OID 49562)
-- Name: purchase_card_pack(integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.purchase_card_pack(p_pack_id integer, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.purchase_card_pack(p_pack_id integer, p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 598 (class 1255 OID 46917)
-- Name: purchase_card_pack(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.purchase_card_pack(user_id uuid, pack_id integer) RETURNS TABLE(card_id integer, card_name text, card_rarity text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    pack_price INTEGER;
    user_gold INTEGER;
BEGIN
    -- Získáme cenu balíčku a zlato hráče
    SELECT price INTO pack_price FROM card_packs WHERE id = pack_id;
    SELECT gold_amount INTO user_gold FROM player_currency WHERE player_id = user_id;

    -- Kontrola dostatku zlata
    IF user_gold < pack_price THEN
        RAISE EXCEPTION 'Nedostatek zlata pro nákup balíčku';
    END IF;

    -- Odečteme zlato
    UPDATE player_currency
    SET gold_amount = gold_amount - pack_price
    WHERE player_id = user_id;

    -- Vygenerujeme a přidáme karty
    RETURN QUERY
    WITH generated_cards AS (
        SELECT * FROM generate_pack_cards(pack_id, user_id)
    )
    SELECT 
        gc.card_id,
        gc.card_name,
        gc.card_rarity
    FROM generated_cards gc;

    -- Přidáme karty do kolekce hráče
    INSERT INTO player_cards (player_id, card_id, quantity)
    SELECT user_id, gc.card_id, 1
    FROM generated_cards gc
    ON CONFLICT (player_id, card_id)
    DO UPDATE SET quantity = player_cards.quantity + 1;
END;
$$;


ALTER FUNCTION public.purchase_card_pack(user_id uuid, pack_id integer) OWNER TO postgres;

--
-- TOC entry 595 (class 1255 OID 30532)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- TOC entry 340 (class 1259 OID 46869)
-- Name: card_packs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.card_packs (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    price integer NOT NULL,
    rarity_distribution jsonb NOT NULL,
    image text NOT NULL
);


ALTER TABLE public.card_packs OWNER TO postgres;

--
-- TOC entry 339 (class 1259 OID 46868)
-- Name: card_packs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.card_packs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.card_packs_id_seq OWNER TO postgres;

--
-- TOC entry 4062 (class 0 OID 0)
-- Dependencies: 339
-- Name: card_packs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.card_packs_id_seq OWNED BY public.card_packs.id;


--
-- TOC entry 334 (class 1259 OID 31973)
-- Name: cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cards (
    id integer NOT NULL,
    name text NOT NULL,
    mana_cost integer NOT NULL,
    attack integer,
    health integer,
    effect text,
    image text NOT NULL,
    rarity text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT cards_type_check CHECK ((type = ANY (ARRAY['unit'::text, 'spell'::text, 'secret'::text])))
);


ALTER TABLE public.cards OWNER TO postgres;

--
-- TOC entry 333 (class 1259 OID 31972)
-- Name: cards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cards_id_seq OWNER TO postgres;

--
-- TOC entry 4065 (class 0 OID 0)
-- Dependencies: 333
-- Name: cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cards_id_seq OWNED BY public.cards.id;


--
-- TOC entry 342 (class 1259 OID 46878)
-- Name: challenges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.challenges (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    reward_gold integer NOT NULL,
    condition_type text NOT NULL,
    condition_value integer NOT NULL,
    reset_period text,
    CONSTRAINT challenges_reset_period_check CHECK ((reset_period = ANY (ARRAY['daily'::text, 'weekly'::text, NULL::text])))
);


ALTER TABLE public.challenges OWNER TO postgres;

--
-- TOC entry 341 (class 1259 OID 46877)
-- Name: challenges_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.challenges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.challenges_id_seq OWNER TO postgres;

--
-- TOC entry 4068 (class 0 OID 0)
-- Dependencies: 341
-- Name: challenges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.challenges_id_seq OWNED BY public.challenges.id;


--
-- TOC entry 336 (class 1259 OID 32001)
-- Name: deck_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deck_cards (
    deck_id uuid NOT NULL,
    card_id integer NOT NULL,
    quantity integer,
    CONSTRAINT deck_cards_quantity_check CHECK (((quantity > 0) AND (quantity <= 2)))
);


ALTER TABLE public.deck_cards OWNER TO postgres;

--
-- TOC entry 335 (class 1259 OID 31983)
-- Name: decks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.decks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_active boolean DEFAULT false
);


ALTER TABLE public.decks OWNER TO postgres;

--
-- TOC entry 332 (class 1259 OID 30328)
-- Name: game_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.game_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    player_id uuid NOT NULL,
    opponent_id uuid NOT NULL,
    winner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    game_duration interval NOT NULL,
    player_deck jsonb NOT NULL,
    opponent_deck jsonb NOT NULL
);


ALTER TABLE public.game_history OWNER TO postgres;

--
-- TOC entry 345 (class 1259 OID 72959)
-- Name: heroes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.heroes (
    id integer NOT NULL,
    name text NOT NULL,
    ability_name text NOT NULL,
    ability_description text NOT NULL,
    ability_cost integer DEFAULT 2,
    image text NOT NULL
);


ALTER TABLE public.heroes OWNER TO postgres;

--
-- TOC entry 344 (class 1259 OID 72958)
-- Name: heroes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.heroes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.heroes_id_seq OWNER TO postgres;

--
-- TOC entry 4074 (class 0 OID 0)
-- Dependencies: 344
-- Name: heroes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.heroes_id_seq OWNED BY public.heroes.id;


--
-- TOC entry 338 (class 1259 OID 46848)
-- Name: player_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_cards (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    player_id uuid NOT NULL,
    card_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    obtained_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.player_cards OWNER TO postgres;

--
-- TOC entry 343 (class 1259 OID 46887)
-- Name: player_challenges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_challenges (
    player_id uuid NOT NULL,
    challenge_id integer NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false,
    last_reset timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    reward_claimed boolean DEFAULT false
);


ALTER TABLE public.player_challenges OWNER TO postgres;

--
-- TOC entry 337 (class 1259 OID 46836)
-- Name: player_currency; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_currency (
    player_id uuid NOT NULL,
    gold_amount integer DEFAULT 100 NOT NULL,
    last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.player_currency OWNER TO postgres;

--
-- TOC entry 3768 (class 2604 OID 46872)
-- Name: card_packs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_packs ALTER COLUMN id SET DEFAULT nextval('public.card_packs_id_seq'::regclass);


--
-- TOC entry 3757 (class 2604 OID 31976)
-- Name: cards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cards ALTER COLUMN id SET DEFAULT nextval('public.cards_id_seq'::regclass);


--
-- TOC entry 3769 (class 2604 OID 46881)
-- Name: challenges id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.challenges ALTER COLUMN id SET DEFAULT nextval('public.challenges_id_seq'::regclass);


--
-- TOC entry 3774 (class 2604 OID 72962)
-- Name: heroes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.heroes ALTER COLUMN id SET DEFAULT nextval('public.heroes_id_seq'::regclass);


--
-- TOC entry 4035 (class 0 OID 46869)
-- Dependencies: 340
-- Data for Name: card_packs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.card_packs VALUES (1, 'Basic Pack', 'Contains 3 cards with at least one rare', 100, '{"epic": 5, "rare": 7, "common": 60, "uncommon": 25, "legendary": 3}', 'basic_pack');
INSERT INTO public.card_packs VALUES (2, 'Premium Pack', 'Contains 3 cards with at least one epic', 300, '{"epic": 25, "rare": 60, "common": 0, "uncommon": 5, "legendary": 10}', 'premium_pack');


--
-- TOC entry 4029 (class 0 OID 31973)
-- Dependencies: 334
-- Data for Name: cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.cards VALUES (2, 'Shield Bearer', 2, 1, 7, 'Taunt', 'shieldBearer', 'common', 'unit', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (4, 'Earth Golem', 5, 4, 8, 'Taunt', 'earthGolem', 'uncommon', 'unit', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (5, 'Nimble Sprite', 1, 1, 2, 'Draw a card when played', 'nimbleSprite', 'common', 'unit', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (10, 'Arcane Intellect', 3, NULL, NULL, 'Draw 2 cards', 'arcaneIntellect', 'rare', 'spell', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (11, 'Glacial Burst', 3, NULL, NULL, 'Freeze all enemy minions', 'glacialBurst', 'epic', 'spell', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (12, 'Inferno Wave', 7, NULL, NULL, 'Deal 4 damage to all enemy minions', 'infernoWave', 'epic', 'spell', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (13, 'Radiant Protector', 6, 4, 5, 'Taunt, Divine Shield', 'radiantProtector', 'legendary', 'unit', '2024-10-28 18:09:21.214613+00');
INSERT INTO public.cards VALUES (15, 'Mana Wyrm', 2, 2, 3, 'Gain +1 attack when you cast a spell', 'manaWyrm', 'rare', 'unit', '2024-10-28 18:09:21.214613+00');
INSERT INTO public.cards VALUES (18, 'Arcane Explosion', 2, NULL, NULL, 'Deal 1 damage to all enemy minions', 'arcaneExplosion', 'common', 'spell', '2024-10-28 18:09:21.214613+00');
INSERT INTO public.cards VALUES (19, 'Holy Nova', 5, NULL, NULL, 'Deal 2 damage to all enemies and restore 2 health to all friendly characters', 'holyNova', 'rare', 'spell', '2024-10-28 18:09:21.214613+00');
INSERT INTO public.cards VALUES (14, 'Shadow Assassin', 3, 4, 2, 'Deal 2 damage to enemy hero when played', 'shadowAssassin', 'rare', 'unit', '2024-10-28 18:09:21.214613+00');
INSERT INTO public.cards VALUES (17, 'Mind Control', 6, NULL, NULL, 'Take control of a random enemy minion', 'mindControl', 'epic', 'spell', '2024-10-28 18:09:21.214613+00');
INSERT INTO public.cards VALUES (20, 'Time Weaver', 8, 6, 8, 'At the end of your turn, restore 2 health to all friendly characters', 'timeWeaver', 'legendary', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (23, 'Mana Golem', 3, 0, 4, 'Attack equals your current mana crystals', 'manaGolem', 'epic', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (24, 'Spirit Healer', 5, 4, 4, 'When you cast a spell, restore 2 health to your hero', 'spiritHealer', 'rare', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (25, 'Spell Seeker', 2, 2, 3, 'Draw a random spell from your deck when played', 'spellSeeker', 'rare', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (27, 'Soul Exchange', 5, NULL, NULL, 'Swap the health of your hero with the enemy hero', 'soulExchange', 'legendary', 'spell', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (29, 'Mirror Image', 2, NULL, NULL, 'Create two 0/2 Mirror Images with Taunt', 'mirrorImage', 'rare', 'spell', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (30, 'Mana Crystal', 1, 1, 3, 'When this minion dies, gain 1 mana crystal', 'manaCrystal', 'common', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (32, 'Arcane Guardian', 3, 2, 4, 'Has +1 health for each spell in your hand', 'arcaneGuardian', 'common', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (26, 'Mana Surge', 3, NULL, NULL, 'Restore your mana crystals to maximum available this turn', 'manaSurge', 'epic', 'spell', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (54, 'Frost Giant', 7, 6, 8, 'Freeze any minion damaged by this unit', 'frostGiant', 'epic', 'unit', '2024-11-03 14:08:55.776286+00');
INSERT INTO public.cards VALUES (6, 'Arcane Familiar', 1, 1, 3, 'Gain +1 attack when you cast a spell', 'arcaneFamiliar', 'epic', 'unit', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (38, 'Mana Siphon', 2, 2, 2, 'When this minion attacks, gain 1 mana crystal this turn only', 'manaSiphon', 'common', 'unit', '2024-10-31 16:24:12.818929+00');
INSERT INTO public.cards VALUES (39, 'Defensive Scout', 3, 1, 5, 'When this minion is attacked, draw a card', 'defensiveScout', 'common', 'unit', '2024-10-31 16:24:12.818929+00');
INSERT INTO public.cards VALUES (40, 'Spell Breaker', 4, 3, 4, 'Enemy spells cost 1 more mana while this minion is alive', 'spellBreaker', 'uncommon', 'unit', '2024-10-31 16:24:12.818929+00');
INSERT INTO public.cards VALUES (41, 'Twin Blade', 3, 2, 4, 'This minion can attack twice each turn', 'twinBlade', 'uncommon', 'unit', '2024-10-31 16:24:12.818929+00');
INSERT INTO public.cards VALUES (42, 'Mana Collector', 5, 3, 6, 'At the start of your turn, gain mana equal to this minions attack', 'manaCollector', 'uncommon', 'unit', '2024-10-31 16:24:12.818929+00');
INSERT INTO public.cards VALUES (43, 'Mountain Giant', 7, 6, 9, 'Taunt', 'mountainGiant', 'rare', 'unit', '2024-10-31 17:28:38.610418+00');
INSERT INTO public.cards VALUES (45, 'Arcane Protector', 4, 2, 5, 'Taunt. Gain +1 attack when you cast a spell', 'arcaneProtector', 'rare', 'unit', '2024-10-31 17:28:38.610418+00');
INSERT INTO public.cards VALUES (46, 'Freezing Dragon', 8, 6, 7, 'Freeze all enemy minions when played', 'freezingDragon', 'legendary', 'unit', '2024-11-02 15:46:33.913701+00');
INSERT INTO public.cards VALUES (47, 'Elven Commander', 5, 4, 4, 'Give all friendly minions +1/+1 when played', 'elvenCommander', 'epic', 'unit', '2024-11-02 15:46:33.913701+00');
INSERT INTO public.cards VALUES (48, 'Lava Golem', 6, 6, 7, 'Deal 3 damage to enemy hero when played', 'lavaGolem', 'epic', 'unit', '2024-11-02 15:46:33.913701+00');
INSERT INTO public.cards VALUES (49, 'Wolf Warrior', 4, 3, 4, 'Gain +1 attack at the end of each turn', 'wolfWarrior', 'rare', 'unit', '2024-11-02 15:46:33.913701+00');
INSERT INTO public.cards VALUES (51, 'Sleeping Giant', 7, 8, 8, 'Cannot attack the turn it is played', 'sleepingGiant', 'epic', 'unit', '2024-11-02 15:46:33.913701+00');
INSERT INTO public.cards VALUES (50, 'Blind Assassin', 3, 6, 3, 'This unit has 50% chance to miss its attacks.', 'blindAssassin', 'epic', 'unit', '2024-11-02 15:46:33.913701+00');
INSERT INTO public.cards VALUES (3, 'Water Elemental', 3, 3, 5, 'Freeze ramdom enemy minion when played', 'waterElemental', 'rare', 'unit', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (9, 'Healing Touch', 3, NULL, NULL, 'Restore 8 health to your hero', 'healingTouch', 'common', 'spell', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (8, 'Lightning Bolt', 2, NULL, NULL, 'Deal 3 damage to enemy hero', 'lightningBolt', 'common', 'spell', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (7, 'Fireball', 4, NULL, NULL, 'Deal 6 damage to enemy hero', 'fireball', 'uncommon', 'spell', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (1, 'Fire Elemental', 4, 5, 6, 'Deals 2 damage to enemy hero when played', 'fireElemental', 'rare', 'unit', '2024-10-28 17:48:24.192746+00');
INSERT INTO public.cards VALUES (52, 'Mana Vampire', 4, 2, 4, 'When this minion deals damage, gain 1 mana crystal this turn for each damage dealt', 'manaVampire', 'epic', 'unit', '2024-11-03 14:08:55.776286+00');
INSERT INTO public.cards VALUES (53, 'Crystal Guardian', 5, 3, 6, 'Divine Shield, Taunt. When Divine Shield is broken, restore 3 health to your hero', 'crystalGuardian', 'rare', 'unit', '2024-11-03 14:08:55.776286+00');
INSERT INTO public.cards VALUES (55, 'Shadow Priest', 3, 2, 4, 'When this minion attacks, restore health equal to the damage dealt to your hero', 'shadowPriest', 'rare', 'unit', '2024-11-03 14:08:55.776286+00');
INSERT INTO public.cards VALUES (56, 'Mana Golem Elite', 6, 0, 7, 'Attack equals your maximum mana crystals. Taunt', 'manaGolemElite', 'epic', 'unit', '2024-11-03 14:08:55.776286+00');
INSERT INTO public.cards VALUES (57, 'Cursed Warrior', 2, 4, 3, 'Takes double damage from all sources', 'cursedWarrior', 'common', 'unit', '2024-11-03 14:08:55.776286+00');
INSERT INTO public.cards VALUES (58, 'Ancient Protector', 8, 5, 9, 'Divine Shield, Taunt. Adjacent minions also gain Divine Shield', 'ancientProtector', 'legendary', 'unit', '2024-11-03 14:08:55.776286+00');
INSERT INTO public.cards VALUES (21, 'Mana Leech', 7, 4, 5, 'When this minion deals damage, restore that much mana to you', 'manaLeech', 'legendary', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (31, 'Healing Wisp', 2, 2, 3, 'When this minion attacks, restore 1 health to your hero', 'healingWisp', 'common', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (28, 'Arcane Storm', 7, NULL, NULL, 'Deal 8 damage to all characters', 'arcaneStorm', 'epic', 'spell', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (16, 'Soul Collector', 5, 3, 5, 'Draw a card when this minion kills an enemy', 'soulCollector', 'epic', 'unit', '2024-10-28 18:09:21.214613+00');
INSERT INTO public.cards VALUES (22, 'Mirror Entity', 3, 3, 3, 'Copy a random enemy minion stats when played', 'mirrorEntity', 'epic', 'unit', '2024-10-29 15:55:32.53039+00');
INSERT INTO public.cards VALUES (44, 'Ancient Guardian', 3, 4, 5, 'Taunt. Cannot attack', 'ancientGuardian', 'rare', 'unit', '2024-10-31 17:28:38.610418+00');
INSERT INTO public.cards VALUES (59, 'Battle Mage', 4, 3, 5, 'When you cast a spell, this minion gains +2 attack this turn', 'battleMage', 'rare', 'unit', '2024-11-03 14:08:55.776286+00');
INSERT INTO public.cards VALUES (60, 'Stone Guardian', 3, 2, 5, 'Taunt', 'stoneGuardian', 'common', 'unit', '2024-11-04 17:33:03.403057+00');
INSERT INTO public.cards VALUES (64, 'Light Champion', 6, 5, 5, 'Divine Shield', 'lightChampion', 'uncommon', 'unit', '2024-11-04 17:33:03.403057+00');
INSERT INTO public.cards VALUES (66, 'Twilight Guardian', 7, 4, 7, 'Taunt. At the end of your turn, give a random friendly minion Divine Shield', 'twilightGuardian', 'legendary', 'unit', '2024-11-04 17:33:03.403057+00');
INSERT INTO public.cards VALUES (67, 'Unity Warrior', 4, 3, 3, 'Gain +1/+1 for each other friendly minion when played', 'unityWarrior', 'epic', 'unit', '2024-11-04 17:33:03.403057+00');
INSERT INTO public.cards VALUES (68, 'Blood Cultist', 3, 4, 5, 'Deal 5 damage to your hero when played. When any minion dies, gain +1 attack', 'bloodCultist', 'legendary', 'unit', '2024-11-06 16:51:12.812626+00');
INSERT INTO public.cards VALUES (69, 'Guardian Totem', 4, 2, 5, 'Taunt. Adjacent minions gain Taunt', 'guardianTotem', 'rare', 'unit', '2024-11-06 16:51:12.812626+00');
INSERT INTO public.cards VALUES (71, 'Sacrifice Pact', 2, NULL, NULL, 'Deal 3 damage to your hero. Draw 2 cards', 'sacrificePact', 'uncommon', 'spell', '2024-11-06 16:51:12.812626+00');
INSERT INTO public.cards VALUES (72, 'Mass Fortification', 4, NULL, NULL, 'Give all friendly minions Taunt and +0/+2', 'massFortification', 'rare', 'spell', '2024-11-06 16:51:12.812626+00');
INSERT INTO public.cards VALUES (73, 'Death Prophet', 1, 2, 1, 'When this minion dies, draw a card', 'deathProphet', 'common', 'unit', '2024-11-06 16:51:12.812626+00');
INSERT INTO public.cards VALUES (74, 'Phoenix', 4, 4, 3, 'When this minion dies, summon a 2/2 Phoenix Hatchling', 'phoenix', 'legendary', 'unit', '2024-11-14 18:14:32.295888+00');
INSERT INTO public.cards VALUES (75, 'Raging Berserker', 3, 5, 3, 'At the end of each turn, this minion loses 1 attack until it reaches 1', 'ragingBerserker', 'rare', 'unit', '2024-11-14 18:14:32.295888+00');
INSERT INTO public.cards VALUES (76, 'Cursed Imp', 1, 3, 3, 'When this minion dies, deal 3 damage to your hero', 'cursedImp', 'legendary', 'unit', '2024-11-14 18:14:32.295888+00');
INSERT INTO public.cards VALUES (77, 'Spirit Guardian', 2, 1, 3, 'Divine Shield. When Divine Shield is broken, give a random friendly minion Divine Shield', 'spiritGuardian', 'legendary', 'unit', '2024-11-15 21:01:05.936062+00');
INSERT INTO public.cards VALUES (78, 'Flame Warrior', 4, 6, 6, 'Takes 2 damage whenever this minion attacks', 'flameWarrior', 'uncommon', 'unit', '2024-11-15 21:01:05.936062+00');
INSERT INTO public.cards VALUES (79, 'Arcane Wisp', 1, 1, 1, 'When this minion dies, add a copy of The Coin to your hand', 'arcaneWisp', 'uncommon', 'unit', '2024-11-15 21:01:05.936062+00');
INSERT INTO public.cards VALUES (80, 'Armored Elephant', 4, 2, 8, 'Taunt', 'armoredElephant', 'uncommon', 'unit', '2024-11-20 15:45:38.371404+00');
INSERT INTO public.cards VALUES (82, 'Divine Healer', 4, 3, 4, 'Restore 3 health to all friendly characters when played', 'divineHealer', 'rare', 'unit', '2024-11-20 15:45:38.371404+00');
INSERT INTO public.cards VALUES (83, 'Friendly Spirit', 3, 2, 3, 'Divine Shield. At the end of each turn, gain +1 health', 'friendlySpirit', 'uncommon', 'unit', '2024-11-20 15:45:38.371404+00');
INSERT INTO public.cards VALUES (81, 'Holy Elemental', 3, 3, 5, 'Restore 2 health to your hero when played', 'holyElemental', 'uncommon', 'unit', '2024-11-20 15:45:38.371404+00');
INSERT INTO public.cards VALUES (114, 'Battle Cry', 2, NULL, NULL, 'Give all friendly minions +1 Attack', 'battleCry', 'epic', 'spell', '2024-12-06 19:17:30.762775+00');
INSERT INTO public.cards VALUES (65, 'Life Drainer', 5, 4, 5, 'When this minion attacks, restore 2 health to your hero', 'lifeDrainer', 'rare', 'unit', '2024-11-04 17:33:03.403057+00');
INSERT INTO public.cards VALUES (62, 'Spell Weaver', 4, 3, 3, 'Gain +1/+1 for each spell in your hand when played', 'spellWeaver', 'epic', 'unit', '2024-11-04 17:33:03.403057+00');
INSERT INTO public.cards VALUES (84, 'Magic Arrows', 1, NULL, NULL, 'Deal 1 damage to a random enemy character 3 times', 'magicArrows', 'common', 'spell', '2024-11-22 17:37:48.429841+00');
INSERT INTO public.cards VALUES (85, 'Charging Knight', 4, 5, 3, 'Divine Shield', 'chargingKnight', 'rare', 'unit', '2024-11-22 17:37:48.429841+00');
INSERT INTO public.cards VALUES (86, 'Rookie Guard', 2, 2, 4, 'Taunt. Cannot attack the turn it is played', 'rookieGuard', 'common', 'unit', '2024-11-22 17:37:48.429841+00');
INSERT INTO public.cards VALUES (87, 'Sacred Defender', 3, 2, 5, 'Taunt, Divine Shield. Cannot attack the turn it is played', 'sacredDefender', 'rare', 'unit', '2024-11-22 17:37:48.429841+00');
INSERT INTO public.cards VALUES (88, 'Fire Dragon', 7, 6, 7, 'Taunt. When this minion dies, shuffle a Fireball into your deck', 'fireDragon', 'legendary', 'unit', '2024-11-24 12:32:01.224075+00');
INSERT INTO public.cards VALUES (89, 'Sacred Dragon', 10, 8, 10, 'Taunt. When this minion dies, restore your hero to full health', 'sacredDragon', 'legendary', 'unit', '2024-11-24 12:32:01.224075+00');
INSERT INTO public.cards VALUES (90, 'Divine Formation', 1, NULL, NULL, 'Give Taunt to all friendly minions with Divine Shield', 'divineFormation', 'uncommon', 'spell', '2024-11-25 17:39:35.967165+00');
INSERT INTO public.cards VALUES (98, 'Mind Theft', 4, NULL, NULL, 'Steal a random card from your opponent''s hand', 'mindTheft', 'legendary', 'spell', '2024-11-29 18:45:42.893996+00');
INSERT INTO public.cards VALUES (100, 'Assassin Scout', 3, 3, 3, 'Deals +2 damage when attacking the enemy hero', 'assassinScout', 'uncommon', 'unit', '2024-11-29 18:45:42.893996+00');
INSERT INTO public.cards VALUES (101, 'Shield Breaker', 2, NULL, NULL, 'Destroy all enemy Divine Shields. Restore 1 health to your hero for each shield destroyed', 'shieldBreaker', 'uncommon', 'spell', '2024-11-29 18:45:42.893996+00');
INSERT INTO public.cards VALUES (102, 'Divine Squire', 1, 1, 1, 'Divine Shield', 'divineSquire', 'legendary', 'unit', '2024-11-29 18:45:42.893996+00');
INSERT INTO public.cards VALUES (103, 'Mind Copy', 1, NULL, NULL, 'Create a copy of a random card from your opponent''s hand', 'mindCopy', 'epic', 'spell', '2024-11-29 18:45:42.893996+00');
INSERT INTO public.cards VALUES (104, 'Divine Protector', 4, 5, 5, 'Gain Divine Shield if your hero has full health when played', 'divineProtector', 'uncommon', 'unit', '2024-11-30 18:01:35.445249+00');
INSERT INTO public.cards VALUES (106, 'Pride Hunter', 2, 2, 3, 'Gain +1/+1 if enemy hero has full health when played', 'prideHunter', 'uncommon', 'unit', '2024-11-30 18:01:35.445249+00');
INSERT INTO public.cards VALUES (107, 'Mass Dispel', 3, NULL, NULL, 'Remove Taunt from all minions', 'massDispel', 'epic', 'spell', '2024-11-30 18:01:35.445249+00');
INSERT INTO public.cards VALUES (105, 'Elendralis', 5, 5, 6, 'If your hero has less than 10 health when played, gain Taunt and restore 3 health to your hero', 'elendralis', 'legendary', 'unit', '2024-11-30 18:01:35.445249+00');
INSERT INTO public.cards VALUES (108, 'Frostbolt', 2, NULL, NULL, 'Deal 3 damage to a random enemy minion and freeze it', 'frostbolt', 'uncommon', 'spell', '2024-12-01 09:30:37.403998+00');
INSERT INTO public.cards VALUES (109, 'Frost Knight', 3, 2, 4, 'Divine Shield. Freeze any minion damaged by this unit', 'frostKnight', 'epic', 'unit', '2024-12-01 09:30:37.403998+00');
INSERT INTO public.cards VALUES (99, 'Wise Oracle', 5, 4, 4, 'Draw 2 cards when played', 'wiseOracle', 'legendary', 'unit', '2024-11-29 18:45:42.893996+00');
INSERT INTO public.cards VALUES (70, 'Soul Harvester', 5, 3, 5, 'Whenever a minion dies, gain +1 attack', 'soulHarvester', 'epic', 'unit', '2024-11-06 16:51:12.812626+00');
INSERT INTO public.cards VALUES (63, 'Ice Revenant', 4, 4, 4, 'Freeze a random enemy minion when this dies', 'iceRevenant', 'rare', 'unit', '2024-11-04 17:33:03.403057+00');
INSERT INTO public.cards VALUES (61, 'Holy Defender', 5, 3, 7, 'Divine Shield, Taunt', 'holyDefender', 'rare', 'unit', '2024-11-04 17:33:03.403057+00');
INSERT INTO public.cards VALUES (110, 'Polymorph Wave', 7, NULL, NULL, 'Transform all minions into 1/1 Ducks', 'polymorphWave', 'epic', 'spell', '2024-12-04 19:21:50.5854+00');
INSERT INTO public.cards VALUES (111, 'Sneaky Infiltrator', 1, 3, 2, 'Deals 2 less damage when attacking enemy hero', 'sneakyInfiltrator', 'rare', 'unit', '2024-12-04 19:21:50.5854+00');
INSERT INTO public.cards VALUES (112, 'Holy Strike', 2, NULL, NULL, 'Deal 2 damage to a random enemy minion and restore 2 health to your hero', 'holyStrike', 'uncommon', 'spell', '2024-12-04 19:21:50.5854+00');
INSERT INTO public.cards VALUES (115, 'Frost Warden', 6, 6, 6, 'Freeze a random enemy minion when played', 'frostWarden', 'rare', 'unit', '2024-12-06 19:17:30.762775+00');
INSERT INTO public.cards VALUES (116, 'Chaos Lord', 6, 6, 9, 'When played, discard a random card from your hand', 'chaosLord', 'legendary', 'unit', '2024-12-06 19:17:30.762775+00');
INSERT INTO public.cards VALUES (117, 'Blood Knight', 6, 6, 8, 'Deal 2 damage to your hero when played', 'bloodKnight', 'epic', 'unit', '2024-12-06 19:17:30.762775+00');
INSERT INTO public.cards VALUES (118, 'Desperate Scout', 0, 1, 1, 'Draw a card and deal 1 damage to your hero when played', 'desperateScout', 'common', 'unit', '2024-12-06 19:17:30.762775+00');
INSERT INTO public.cards VALUES (119, 'Balanced Warrior', 5, 6, 6, NULL, 'balancedWarrior', 'common', 'unit', '2024-12-07 17:10:04.166558+00');
INSERT INTO public.cards VALUES (120, 'Aggressive Warrior', 4, 6, 3, NULL, 'aggressiveWarrior', 'common', 'unit', '2024-12-07 17:10:04.166558+00');
INSERT INTO public.cards VALUES (121, 'Healing Sentinel', 5, 4, 5, 'Restore 4 health to your hero when played', 'healingSentinel', 'uncommon', 'unit', '2024-12-07 17:10:04.166558+00');
INSERT INTO public.cards VALUES (123, 'Legion Commander', 9, 6, 6, 'When played, fill your board with 1/1 minions that cannot attack this turn', 'legionCommander', 'legendary', 'unit', '2024-12-17 19:41:04.910872+00');
INSERT INTO public.cards VALUES (124, 'Arcane Summoner', 4, 3, 3, 'When this minion dies, shuffle two Arcane Wisps into your deck', 'arcaneSummoner', 'epic', 'unit', '2024-12-17 19:41:04.910872+00');
INSERT INTO public.cards VALUES (125, 'Mind Mimic', 5, 4, 4, 'When played, create a copy of a random card from your opponent''s hand', 'mindMimic', 'epic', 'unit', '2024-12-17 19:41:04.910872+00');
INSERT INTO public.cards VALUES (126, 'Eternal Wanderer', 6, 5, 5, 'Cannot attack the turn it is played. When this minion dies, return it to your hand', 'eternalWanderer', 'epic', 'unit', '2024-12-17 19:41:04.910872+00');
INSERT INTO public.cards VALUES (127, 'Tiny Protector', 1, 1, 3, 'Taunt', 'tinyProtector', 'common', 'unit', '2024-12-18 17:38:10.613203+00');
INSERT INTO public.cards VALUES (130, 'Spirit Summoner', 4, 3, 4, 'At the end of your turn, summon a 1/1 Spirit', 'spiritSummoner', 'epic', 'unit', '2024-12-18 17:38:10.613203+00');
INSERT INTO public.cards VALUES (155, 'Explosive Trap', 2, NULL, NULL, 'Secret: When an enemy minion attacks your hero, deal 2 damage to all enemy characters.', 'explosiveTrap', 'rare', 'secret', '2025-03-02 09:59:58.476481+00');
INSERT INTO public.cards VALUES (128, 'Soothing Return', 2, NULL, NULL, 'Return a random enemy minion to their hand and restore 3 health to your hero', 'soothingReturn', 'uncommon', 'spell', '2024-12-18 17:38:10.613203+00');
INSERT INTO public.cards VALUES (129, 'Death Touch', 3, NULL, NULL, 'Destroy a random enemy minion', 'deathTouch', 'rare', 'spell', '2024-12-18 17:38:10.613203+00');
INSERT INTO public.cards VALUES (131, 'Angel Guardian', 5, 3, 8, 'Taunt. At the end of your turn, gain +1/+1 if your hero has full health', 'angelGuardian', 'epic', 'unit', '2024-12-20 14:34:33.731712+00');
INSERT INTO public.cards VALUES (132, 'Rune Defender', 4, 5, 6, 'Gain Taunt if your hero has full health when played', 'runeDefender', 'uncommon', 'unit', '2024-12-20 14:34:33.731712+00');
INSERT INTO public.cards VALUES (133, 'Unity Strike', 2, NULL, NULL, 'Deal damage to enemy hero equal to the number of friendly minions', 'unityStrike', 'rare', 'spell', '2024-12-20 14:34:33.731712+00');
INSERT INTO public.cards VALUES (134, 'Source Healing', 2, NULL, NULL, 'Restore health to your hero equal to the total number of minions on the board', 'sourceHealing', 'rare', 'spell', '2024-12-20 14:34:33.731712+00');
INSERT INTO public.cards VALUES (91, 'Ancient Colossus', 30, 12, 12, 'Costs (1) less for each minion that died this game', 'ancientColossus', 'legendary', 'unit', '2024-11-25 17:39:35.967165+00');
INSERT INTO public.cards VALUES (136, 'Merciful Protector', 3, 3, 4, 'Divine Shield. When played, restore 5 health to enemy hero', 'mercifulProtector', 'epic', 'unit', '2025-01-11 11:17:56.374368+00');
INSERT INTO public.cards VALUES (137, 'Mana Benefactor', 2, 3, 4, 'When played, your opponent gains 1 mana crystal next turn', 'manaBenefactor', 'epic', 'unit', '2025-01-11 11:17:56.374368+00');
INSERT INTO public.cards VALUES (135, 'Zoxus', 2, 1, 1, 'Divine Shield. At the end of your turn, gain +1/+1', 'zoxus', 'legendary', 'unit', '2025-01-11 11:17:56.374368+00');
INSERT INTO public.cards VALUES (113, 'Silence Assassin', 3, 3, 5, 'When this minion attacks a Taunt minion, remove its Taunt. Cannot attack the turn it is played', 'silenceAssassin', 'legendary', 'unit', '2024-12-04 19:21:50.5854+00');
INSERT INTO public.cards VALUES (122, 'Frost Overseer', 5, 4, 6, 'At the end of your turn, freeze a random unfrozen enemy minion.', 'frostOverseer', 'epic', 'unit', '2024-12-07 17:10:04.166558+00');
INSERT INTO public.cards VALUES (138, 'Frost Spirit', 1, 2, 1, 'When this minion dies, freeze a random enemy minion', 'frostSpirit', 'uncommon', 'unit', '2025-01-12 18:03:14.095299+00');
INSERT INTO public.cards VALUES (139, 'Bee Guardian', 6, 5, 5, 'Taunt, Divine Shield. When this minion dies, your opponent draws a card', 'beeGuardian', 'epic', 'unit', '2025-01-12 18:03:14.095299+00');
INSERT INTO public.cards VALUES (140, 'Healing Acolyte', 2, 1, 4, 'At the end of your turn, restore 1 health to your hero', 'healingAcolyte', 'rare', 'unit', '2025-01-12 18:03:14.095299+00');
INSERT INTO public.cards VALUES (141, 'Overloading Giant', 4, 7, 7, 'Overload (2)', 'overloadingGiant', 'epic', 'unit', '2025-01-13 17:00:35.747764+00');
INSERT INTO public.cards VALUES (142, 'Mana Fusion', 0, NULL, NULL, 'Gain 2 Mana Crystals this turn only. Overload (2)', 'manaFusion', 'epic', 'spell', '2025-01-13 17:00:35.747764+00');
INSERT INTO public.cards VALUES (143, 'Swift Guardian', 4, 3, 3, 'Divine Shield. Can attack twice each turn', 'swiftGuardian', 'epic', 'unit', '2025-01-13 17:00:35.747764+00');
INSERT INTO public.cards VALUES (144, 'Tactical Scout', 2, 2, 4, 'Draw a card when played if your hero has more health than your opponent', 'tacticalScout', 'rare', 'unit', '2025-02-04 19:47:06.425218+00');
INSERT INTO public.cards VALUES (145, 'Frost Harvester', 3, 3, 3, 'Gain +1/+1 for each frozen enemy minion when played', 'frostHarvester', 'epic', 'unit', '2025-02-04 19:47:06.425218+00');
INSERT INTO public.cards VALUES (146, 'Taunt Collector', 6, 3, 3, 'Taunt. Remove Taunt from all other minions, gain +1 HP per Taunt removed.', 'tauntCollector', 'epic', 'unit', '2025-02-04 19:47:06.425218+00');
INSERT INTO public.cards VALUES (147, 'Dark Scholar', 2, 3, 2, 'Deal 2 damage to your hero and draw a card when played', 'darkScholar', 'rare', 'unit', '2025-02-08 22:11:37.536947+00');
INSERT INTO public.cards VALUES (148, 'Vigilant Guard', 3, 2, 4, 'Taunt. Draw a card when played', 'vigilantGuard', 'uncommon', 'unit', '2025-02-08 22:11:37.536947+00');
INSERT INTO public.cards VALUES (149, 'Lone Protector', 4, 6, 2, 'Gain Divine Shield and Taunt if there are no other minions on the board when played', 'loneProtector', 'epic', 'unit', '2025-02-08 22:11:37.536947+00');
INSERT INTO public.cards VALUES (150, 'Wisdom Seeker', 6, 5, 5, 'Draw a card if your hero has full health when played, otherwise gain Taunt', 'wisdomSeeker', 'epic', 'unit', '2025-02-14 16:16:46.479426+00');
INSERT INTO public.cards VALUES (151, 'Echo Warrior', 5, 4, 4, 'When played, shuffle a copy of this card into your deck', 'echoWarrior', 'epic', 'unit', '2025-02-14 16:16:46.479426+00');
INSERT INTO public.cards VALUES (152, 'Chaos Imp', 2, 2, 1, 'Divine Shield. When played, destroy a random card in your hand', 'chaosImp', 'epic', 'unit', '2025-02-14 16:16:46.479426+00');
INSERT INTO public.cards VALUES (154, 'Counterspell', 3, NULL, NULL, 'Secret: When your opponent casts a spell, counter it.', 'counterspell', 'rare', 'secret', '2025-03-02 09:59:58.476481+00');
INSERT INTO public.cards VALUES (156, 'Ambush', 2, NULL, NULL, 'Secret: When your opponent plays a minion, summon a 3/2 Ambusher with Taunt.', 'ambush', 'rare', 'secret', '2025-03-02 09:59:58.476481+00');
INSERT INTO public.cards VALUES (157, 'Soul Guardian', 3, NULL, NULL, 'Secret: When an enemy minion attacks your hero and your hero has less than 10 health, restore 10 health to your hero.', 'soulGuardian', 'epic', 'secret', '2025-03-04 19:42:14.568888+00');
INSERT INTO public.cards VALUES (158, 'Phantom Mirage', 3, NULL, NULL, 'Secret: When your opponent plays a minion, take control of it until the end of your next turn.', 'phantomMirage', 'epic', 'secret', '2025-03-04 19:42:14.568888+00');
INSERT INTO public.cards VALUES (159, 'Spell Reflector', 2, NULL, NULL, 'Secret: When your opponent casts a spell, deal 3 damage to their hero and draw a card.', 'spellReflector', 'epic', 'secret', '2025-03-04 19:42:14.568888+00');


--
-- TOC entry 4037 (class 0 OID 46878)
-- Dependencies: 342
-- Data for Name: challenges; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.challenges VALUES (3, 'Weekly Champion', 'Win 10 games this week', 500, 'games_won', 10, 'weekly');
INSERT INTO public.challenges VALUES (2, 'Daily Player', 'Play 5 games today', 100, 'games_played', 5, 'daily');
INSERT INTO public.challenges VALUES (1, 'Win Streak', 'Win 3 games in a row', 300, 'win_streak', 3, NULL);
INSERT INTO public.challenges VALUES (4, 'Weekly Player', 'Play 20 games this week', 300, 'games_played', 20, 'weekly');
INSERT INTO public.challenges VALUES (6, 'Victory Marathon', 'Win 5 games in a row', 500, 'win_streak', 5, NULL);



--
-- TOC entry 4040 (class 0 OID 72959)
-- Dependencies: 345
-- Data for Name: heroes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.heroes VALUES (2, 'Priest', 'Lesser Heal', 'Restore 2 health to your hero', 2, 'priest');
INSERT INTO public.heroes VALUES (3, 'Seer', 'Fortune Draw', 'Draw a random card from your deck', 2, 'seer');
INSERT INTO public.heroes VALUES (4, 'Defender', 'Protect', 'Give a random friendly minion Taunt', 2, 'defender');
INSERT INTO public.heroes VALUES (5, 'Warrior', 'Battle Command', 'Give a random friendly minion +1 Attack', 2, 'warrior');
INSERT INTO public.heroes VALUES (6, 'Frost Mage', 'Frost Nova', 'Freeze a random enemy minion', 2, 'frostmage');
INSERT INTO public.heroes VALUES (1, 'Fire Mage', 'Fireblast', 'Deal 2 damage to enemy hero', 2, 'mage');



--
-- TOC entry 4079 (class 0 OID 0)
-- Dependencies: 339
-- Name: card_packs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.card_packs_id_seq', 2, true);


--
-- TOC entry 4080 (class 0 OID 0)
-- Dependencies: 333
-- Name: cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cards_id_seq', 159, true);


--
-- TOC entry 4081 (class 0 OID 0)
-- Dependencies: 341
-- Name: challenges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.challenges_id_seq', 3, true);


--
-- TOC entry 4082 (class 0 OID 0)
-- Dependencies: 344
-- Name: heroes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.heroes_id_seq', 6, true);


--
-- TOC entry 3811 (class 2606 OID 46876)
-- Name: card_packs card_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_packs
    ADD CONSTRAINT card_packs_pkey PRIMARY KEY (id);


--
-- TOC entry 3792 (class 2606 OID 31982)
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- TOC entry 3813 (class 2606 OID 46886)
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- TOC entry 3800 (class 2606 OID 32006)
-- Name: deck_cards deck_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deck_cards
    ADD CONSTRAINT deck_cards_pkey PRIMARY KEY (deck_id, card_id);


--
-- TOC entry 3797 (class 2606 OID 31993)
-- Name: decks decks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decks
    ADD CONSTRAINT decks_pkey PRIMARY KEY (id);


--
-- TOC entry 3787 (class 2606 OID 30336)
-- Name: game_history game_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_history
    ADD CONSTRAINT game_history_pkey PRIMARY KEY (id);


--
-- TOC entry 3820 (class 2606 OID 72967)
-- Name: heroes heroes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.heroes
    ADD CONSTRAINT heroes_pkey PRIMARY KEY (id);


--
-- TOC entry 3807 (class 2606 OID 46855)
-- Name: player_cards player_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_cards
    ADD CONSTRAINT player_cards_pkey PRIMARY KEY (id);


--
-- TOC entry 3809 (class 2606 OID 46857)
-- Name: player_cards player_cards_player_id_card_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_cards
    ADD CONSTRAINT player_cards_player_id_card_id_key UNIQUE (player_id, card_id);


--
-- TOC entry 3816 (class 2606 OID 46894)
-- Name: player_challenges player_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_challenges
    ADD CONSTRAINT player_challenges_pkey PRIMARY KEY (player_id, challenge_id);


--
-- TOC entry 3804 (class 2606 OID 46842)
-- Name: player_currency player_currency_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_currency
    ADD CONSTRAINT player_currency_pkey PRIMARY KEY (player_id);


--
-- TOC entry 3781 (class 2606 OID 30276)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 3783 (class 2606 OID 30278)
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- TOC entry 3818 (class 2606 OID 51068)
-- Name: player_challenges unique_player_challenge; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_challenges
    ADD CONSTRAINT unique_player_challenge UNIQUE (player_id, challenge_id);


--
-- TOC entry 3785 (class 2606 OID 31751)
-- Name: profiles unique_username; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT unique_username UNIQUE (username);


--
-- TOC entry 3793 (class 1259 OID 32298)
-- Name: idx_cards_mana_cost; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cards_mana_cost ON public.cards USING btree (mana_cost);


--
-- TOC entry 3794 (class 1259 OID 32297)
-- Name: idx_cards_rarity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cards_rarity ON public.cards USING btree (rarity);


--
-- TOC entry 3795 (class 1259 OID 32296)
-- Name: idx_cards_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cards_type ON public.cards USING btree (type);


--
-- TOC entry 3801 (class 1259 OID 32020)
-- Name: idx_deck_cards_card_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deck_cards_card_id ON public.deck_cards USING btree (card_id);


--
-- TOC entry 3802 (class 1259 OID 32019)
-- Name: idx_deck_cards_deck_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deck_cards_deck_id ON public.deck_cards USING btree (deck_id);


--
-- TOC entry 3798 (class 1259 OID 32021)
-- Name: idx_decks_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_decks_user_id ON public.decks USING btree (user_id);


--
-- TOC entry 3788 (class 1259 OID 30403)
-- Name: idx_game_history_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_game_history_created_at ON public.game_history USING btree (created_at);


--
-- TOC entry 3789 (class 1259 OID 30402)
-- Name: idx_game_history_opponent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_game_history_opponent_id ON public.game_history USING btree (opponent_id);


--
-- TOC entry 3790 (class 1259 OID 30401)
-- Name: idx_game_history_player_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_game_history_player_id ON public.game_history USING btree (player_id);


--
-- TOC entry 3805 (class 1259 OID 46905)
-- Name: idx_player_cards_player_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_cards_player_id ON public.player_cards USING btree (player_id);


--
-- TOC entry 3814 (class 1259 OID 46906)
-- Name: idx_player_challenges_player_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_challenges_player_id ON public.player_challenges USING btree (player_id);


--
-- TOC entry 3779 (class 1259 OID 30400)
-- Name: idx_profiles_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);


--
-- TOC entry 3834 (class 2620 OID 46915)
-- Name: profiles add_starter_cards_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER add_starter_cards_trigger AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.add_starter_cards();


--
-- TOC entry 3838 (class 2620 OID 32018)
-- Name: deck_cards check_deck_size_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER check_deck_size_trigger AFTER INSERT OR UPDATE ON public.deck_cards FOR EACH ROW EXECUTE FUNCTION public.check_deck_size();


--
-- TOC entry 3835 (class 2620 OID 46913)
-- Name: profiles create_player_currency_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER create_player_currency_trigger AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_player_currency();


--
-- TOC entry 3837 (class 2620 OID 32733)
-- Name: decks ensure_single_active_deck; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ensure_single_active_deck BEFORE INSERT OR UPDATE ON public.decks FOR EACH ROW EXECUTE FUNCTION public.check_active_decks();


--
-- TOC entry 3836 (class 2620 OID 30554)
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3827 (class 2606 OID 32012)
-- Name: deck_cards deck_cards_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deck_cards
    ADD CONSTRAINT deck_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id);


--
-- TOC entry 3828 (class 2606 OID 32007)
-- Name: deck_cards deck_cards_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deck_cards
    ADD CONSTRAINT deck_cards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.decks(id) ON DELETE CASCADE;


--
-- TOC entry 3826 (class 2606 OID 31996)
-- Name: decks decks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decks
    ADD CONSTRAINT decks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- TOC entry 3823 (class 2606 OID 30342)
-- Name: game_history game_history_opponent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_history
    ADD CONSTRAINT game_history_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.profiles(id);


--
-- TOC entry 3824 (class 2606 OID 30337)
-- Name: game_history game_history_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_history
    ADD CONSTRAINT game_history_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);


--
-- TOC entry 3825 (class 2606 OID 30347)
-- Name: game_history game_history_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_history
    ADD CONSTRAINT game_history_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);


--
-- TOC entry 3830 (class 2606 OID 46863)
-- Name: player_cards player_cards_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_cards
    ADD CONSTRAINT player_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id);


--
-- TOC entry 3831 (class 2606 OID 46858)
-- Name: player_cards player_cards_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_cards
    ADD CONSTRAINT player_cards_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);


--
-- TOC entry 3832 (class 2606 OID 46900)
-- Name: player_challenges player_challenges_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_challenges
    ADD CONSTRAINT player_challenges_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id);


--
-- TOC entry 3833 (class 2606 OID 46895)
-- Name: player_challenges player_challenges_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_challenges
    ADD CONSTRAINT player_challenges_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);


--
-- TOC entry 3829 (class 2606 OID 46843)
-- Name: player_currency player_currency_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_currency
    ADD CONSTRAINT player_currency_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);


--
-- TOC entry 3821 (class 2606 OID 72969)
-- Name: profiles profiles_hero_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_hero_id_fkey FOREIGN KEY (hero_id) REFERENCES public.heroes(id);


--
-- TOC entry 3822 (class 2606 OID 30279)
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4004 (class 3256 OID 32022)
-- Name: cards Cards are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cards are viewable by everyone" ON public.cards FOR SELECT USING (true);


--
-- TOC entry 4001 (class 3256 OID 30847)
-- Name: profiles Enable insert for authentication users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authentication users only" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- TOC entry 4015 (class 3256 OID 46909)
-- Name: card_packs Everyone can view card packs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Everyone can view card packs" ON public.card_packs FOR SELECT USING (true);


--
-- TOC entry 4016 (class 3256 OID 46910)
-- Name: challenges Everyone can view challenges; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Everyone can view challenges" ON public.challenges FOR SELECT USING (true);


--
-- TOC entry 4003 (class 3256 OID 30849)
-- Name: game_history Game history insertable by server only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Game history insertable by server only" ON public.game_history FOR INSERT WITH CHECK (true);


--
-- TOC entry 4002 (class 3256 OID 30848)
-- Name: game_history Game history viewable by participants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Game history viewable by participants" ON public.game_history FOR SELECT USING (((auth.uid() = player_id) OR (auth.uid() = opponent_id)));


--
-- TOC entry 3998 (class 3256 OID 30844)
-- Name: profiles Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- TOC entry 4024 (class 3256 OID 51066)
-- Name: player_challenges Users can accept new challenges; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can accept new challenges" ON public.player_challenges FOR INSERT WITH CHECK ((auth.uid() = player_id));


--
-- TOC entry 4012 (class 3256 OID 32030)
-- Name: deck_cards Users can delete cards from own decks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete cards from own decks" ON public.deck_cards FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.decks
  WHERE ((decks.id = deck_cards.deck_id) AND (decks.user_id = auth.uid())))));


--
-- TOC entry 4023 (class 3256 OID 50233)
-- Name: player_challenges Users can delete own challenges; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own challenges" ON public.player_challenges FOR DELETE USING ((auth.uid() = player_id));


--
-- TOC entry 4008 (class 3256 OID 32026)
-- Name: decks Users can delete own decks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own decks" ON public.decks FOR DELETE USING ((auth.uid() = user_id));


--
-- TOC entry 4010 (class 3256 OID 32028)
-- Name: deck_cards Users can insert cards to own decks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert cards to own decks" ON public.deck_cards FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.decks
  WHERE ((decks.id = deck_cards.deck_id) AND (decks.user_id = auth.uid())))));


--
-- TOC entry 4019 (class 3256 OID 47810)
-- Name: player_cards Users can insert own cards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own cards" ON public.player_cards FOR INSERT WITH CHECK ((auth.uid() = player_id));


--
-- TOC entry 4006 (class 3256 OID 32024)
-- Name: decks Users can insert own decks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own decks" ON public.decks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- TOC entry 4000 (class 3256 OID 30846)
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- TOC entry 4011 (class 3256 OID 32029)
-- Name: deck_cards Users can update cards in own decks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update cards in own decks" ON public.deck_cards FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.decks
  WHERE ((decks.id = deck_cards.deck_id) AND (decks.user_id = auth.uid())))));


--
-- TOC entry 4020 (class 3256 OID 47811)
-- Name: player_cards Users can update own cards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own cards" ON public.player_cards FOR UPDATE USING ((auth.uid() = player_id)) WITH CHECK ((auth.uid() = player_id));


--
-- TOC entry 4022 (class 3256 OID 50232)
-- Name: player_challenges Users can update own challenges; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own challenges" ON public.player_challenges FOR UPDATE USING ((auth.uid() = player_id));


--
-- TOC entry 4018 (class 3256 OID 47809)
-- Name: player_currency Users can update own currency; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own currency" ON public.player_currency FOR UPDATE USING ((auth.uid() = player_id)) WITH CHECK ((auth.uid() = player_id));


--
-- TOC entry 4007 (class 3256 OID 32025)
-- Name: decks Users can update own decks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own decks" ON public.decks FOR UPDATE USING ((auth.uid() = user_id));


--
-- TOC entry 3999 (class 3256 OID 30845)
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- TOC entry 4014 (class 3256 OID 46908)
-- Name: player_cards Users can view own cards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own cards" ON public.player_cards FOR SELECT USING ((auth.uid() = player_id));


--
-- TOC entry 4017 (class 3256 OID 46911)
-- Name: player_challenges Users can view own challenge progress; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own challenge progress" ON public.player_challenges FOR SELECT USING ((auth.uid() = player_id));


--
-- TOC entry 4021 (class 3256 OID 50230)
-- Name: player_challenges Users can view own challenges; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own challenges" ON public.player_challenges FOR SELECT USING ((auth.uid() = player_id));


--
-- TOC entry 4013 (class 3256 OID 46907)
-- Name: player_currency Users can view own currency; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own currency" ON public.player_currency FOR SELECT USING ((auth.uid() = player_id));


--
-- TOC entry 4009 (class 3256 OID 32027)
-- Name: deck_cards Users can view own deck cards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own deck cards" ON public.deck_cards FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.decks
  WHERE ((decks.id = deck_cards.deck_id) AND (decks.user_id = auth.uid())))));


--
-- TOC entry 4005 (class 3256 OID 32023)
-- Name: decks Users can view own decks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own decks" ON public.decks FOR SELECT USING ((auth.uid() = user_id));


--
-- TOC entry 3995 (class 0 OID 46869)
-- Dependencies: 340
-- Name: card_packs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.card_packs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3990 (class 0 OID 31973)
-- Dependencies: 334
-- Name: cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3996 (class 0 OID 46878)
-- Dependencies: 342
-- Name: challenges; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3992 (class 0 OID 32001)
-- Dependencies: 336
-- Name: deck_cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3991 (class 0 OID 31983)
-- Dependencies: 335
-- Name: decks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3989 (class 0 OID 30328)
-- Dependencies: 332
-- Name: game_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3994 (class 0 OID 46848)
-- Dependencies: 338
-- Name: player_cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3997 (class 0 OID 46887)
-- Dependencies: 343
-- Name: player_challenges; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.player_challenges ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3993 (class 0 OID 46836)
-- Dependencies: 337
-- Name: player_currency; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.player_currency ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3988 (class 0 OID 30264)
-- Dependencies: 331
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4047 (class 0 OID 0)
-- Dependencies: 33
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;


--
-- TOC entry 4048 (class 0 OID 0)
-- Dependencies: 599
-- Name: FUNCTION add_starter_cards(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.add_starter_cards() TO anon;
GRANT ALL ON FUNCTION public.add_starter_cards() TO authenticated;


--
-- TOC entry 4049 (class 0 OID 0)
-- Dependencies: 600
-- Name: FUNCTION award_challenge_completion(p_player_id uuid, p_challenge_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.award_challenge_completion(p_player_id uuid, p_challenge_id integer) TO anon;
GRANT ALL ON FUNCTION public.award_challenge_completion(p_player_id uuid, p_challenge_id integer) TO authenticated;


--
-- TOC entry 4050 (class 0 OID 0)
-- Dependencies: 602
-- Name: FUNCTION check_active_decks(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_active_decks() TO anon;
GRANT ALL ON FUNCTION public.check_active_decks() TO authenticated;


--
-- TOC entry 4051 (class 0 OID 0)
-- Dependencies: 601
-- Name: FUNCTION check_deck_size(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_deck_size() TO anon;
GRANT ALL ON FUNCTION public.check_deck_size() TO authenticated;


--
-- TOC entry 4052 (class 0 OID 0)
-- Dependencies: 597
-- Name: FUNCTION create_player_currency(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_player_currency() TO anon;
GRANT ALL ON FUNCTION public.create_player_currency() TO authenticated;


--
-- TOC entry 4053 (class 0 OID 0)
-- Dependencies: 331
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO authenticated;


--
-- TOC entry 4054 (class 0 OID 0)
-- Dependencies: 596
-- Name: FUNCTION create_profile(user_id uuid, user_username text, initial_rank integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_profile(user_id uuid, user_username text, initial_rank integer) TO anon;
GRANT ALL ON FUNCTION public.create_profile(user_id uuid, user_username text, initial_rank integer) TO authenticated;


--
-- TOC entry 4055 (class 0 OID 0)
-- Dependencies: 393
-- Name: FUNCTION delete_player_account(player_uuid uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.delete_player_account(player_uuid uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_player_account(player_uuid uuid) TO authenticated;


--
-- TOC entry 4056 (class 0 OID 0)
-- Dependencies: 427
-- Name: FUNCTION generate_pack_cards(p_pack_id integer, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_pack_cards(p_pack_id integer, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.generate_pack_cards(p_pack_id integer, p_user_id uuid) TO authenticated;


--
-- TOC entry 4057 (class 0 OID 0)
-- Dependencies: 573
-- Name: FUNCTION get_player_challenges(p_player_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_player_challenges(p_player_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_player_challenges(p_player_id uuid) TO authenticated;


--
-- TOC entry 4058 (class 0 OID 0)
-- Dependencies: 412
-- Name: FUNCTION purchase_card_pack(p_pack_id integer, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.purchase_card_pack(p_pack_id integer, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.purchase_card_pack(p_pack_id integer, p_user_id uuid) TO authenticated;


--
-- TOC entry 4059 (class 0 OID 0)
-- Dependencies: 598
-- Name: FUNCTION purchase_card_pack(user_id uuid, pack_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.purchase_card_pack(user_id uuid, pack_id integer) TO anon;
GRANT ALL ON FUNCTION public.purchase_card_pack(user_id uuid, pack_id integer) TO authenticated;


--
-- TOC entry 4060 (class 0 OID 0)
-- Dependencies: 595
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;


--
-- TOC entry 4061 (class 0 OID 0)
-- Dependencies: 340
-- Name: TABLE card_packs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.card_packs TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.card_packs TO authenticated;


--
-- TOC entry 4063 (class 0 OID 0)
-- Dependencies: 339
-- Name: SEQUENCE card_packs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.card_packs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.card_packs_id_seq TO authenticated;


--
-- TOC entry 4064 (class 0 OID 0)
-- Dependencies: 334
-- Name: TABLE cards; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.cards TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.cards TO authenticated;


--
-- TOC entry 4066 (class 0 OID 0)
-- Dependencies: 333
-- Name: SEQUENCE cards_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cards_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cards_id_seq TO authenticated;


--
-- TOC entry 4067 (class 0 OID 0)
-- Dependencies: 342
-- Name: TABLE challenges; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.challenges TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.challenges TO authenticated;


--
-- TOC entry 4069 (class 0 OID 0)
-- Dependencies: 341
-- Name: SEQUENCE challenges_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.challenges_id_seq TO anon;
GRANT ALL ON SEQUENCE public.challenges_id_seq TO authenticated;


--
-- TOC entry 4070 (class 0 OID 0)
-- Dependencies: 336
-- Name: TABLE deck_cards; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.deck_cards TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.deck_cards TO authenticated;


--
-- TOC entry 4071 (class 0 OID 0)
-- Dependencies: 335
-- Name: TABLE decks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.decks TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.decks TO authenticated;


--
-- TOC entry 4072 (class 0 OID 0)
-- Dependencies: 332
-- Name: TABLE game_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.game_history TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.game_history TO authenticated;


--
-- TOC entry 4073 (class 0 OID 0)
-- Dependencies: 345
-- Name: TABLE heroes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.heroes TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.heroes TO authenticated;


--
-- TOC entry 4075 (class 0 OID 0)
-- Dependencies: 344
-- Name: SEQUENCE heroes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.heroes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.heroes_id_seq TO authenticated;


--
-- TOC entry 4076 (class 0 OID 0)
-- Dependencies: 338
-- Name: TABLE player_cards; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.player_cards TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.player_cards TO authenticated;


--
-- TOC entry 4077 (class 0 OID 0)
-- Dependencies: 343
-- Name: TABLE player_challenges; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.player_challenges TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.player_challenges TO authenticated;


--
-- TOC entry 4078 (class 0 OID 0)
-- Dependencies: 337
-- Name: TABLE player_currency; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.player_currency TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.player_currency TO authenticated;




-- Completed on 2025-04-27 12:13:43

--
-- PostgreSQL database dump complete
--

