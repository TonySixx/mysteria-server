-- Funkce pro přidání nových karet hráči
CREATE OR REPLACE FUNCTION add_new_cards_to_player(player_uuid UUID)
RETURNS void AS $$
DECLARE
    card_id INTEGER;
BEGIN
    -- Pro každou novou kartu přidáme 2 kopie hráči (nebo 1 pro legendární)
    FOR card_id IN (
        SELECT id FROM cards 
        WHERE name IN (
            -- Nově přidané karty
            'Stone Guardian',
            'Holy Defender',
            'Spell Weaver',
            'Ice Revenant',
            'Light Champion',
            'Life Drainer',
            'Twilight Guardian',
            'Unity Warrior'
        )
    )
    LOOP
        -- Přidáme nebo aktualizujeme počet karet
        INSERT INTO player_cards (player_id, card_id, quantity)
        VALUES (player_uuid, card_id, 2)
        ON CONFLICT (player_id, card_id)
        DO UPDATE SET quantity = 
            CASE 
                WHEN cards.rarity = 'legendary' THEN 1  -- Legendární karty max 1
                ELSE LEAST(player_cards.quantity + 2, 2)  -- Ostatní karty max 2
            END
        FROM cards
        WHERE cards.id = card_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Použití funkce pro konkrétního hráče (nahraďte YOUR_PLAYER_UUID skutečným UUID):
-- SELECT add_new_cards_to_player('YOUR_PLAYER_UUID'); 