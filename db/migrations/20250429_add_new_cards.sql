
-- Add new cards to the database
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    -- Mystic Chronicler (2 mana - legendary card)
    ('Mystic Chronicler', 2, 1, 3, 'At the end of your turn, draw a card', 'mysticChronicler', 'legendary', 'unit'),

    -- Celestial Healer (7 mana - epic card)
    ('Celestial Healer', 7, 5, 6, 'When played, restore 10 health to your hero', 'celestialHealer', 'epic', 'unit'),

    -- Arcane Scholar (5 mana - epic card)
    ('Arcane Scholar', 5, 3, 6, 'When played, draw a random spell from your deck', 'arcaneScholar', 'epic', 'unit');

