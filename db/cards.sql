-- Vložení všech karet do databáze
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    -- Základní karty
    ('Fire Elemental', 4, 5, 6, 'Deals 2 damage when played', 'fireElemental', 'rare', 'unit'),
    ('Shield Bearer', 2, 1, 7, 'Taunt', 'shieldBearer', 'common', 'unit'),
    ('Water Elemental', 3, 3, 5, 'Freeze enemy when played', 'waterElemental', 'rare', 'unit'),
    ('Earth Golem', 5, 4, 8, 'Taunt', 'earthGolem', 'uncommon', 'unit'),
    ('Nimble Sprite', 1, 1, 2, 'Draw a card when played', 'nimbleSprite', 'common', 'unit'),
    ('Arcane Familiar', 1, 1, 3, 'Gain +1 attack when you cast a spell', 'arcaneFamiliar', 'epic', 'unit'),
    ('Fireball', 4, NULL, NULL, 'Deal 6 damage', 'fireball', 'uncommon', 'spell'),
    ('Lightning Bolt', 2, NULL, NULL, 'Deal 3 damage', 'lightningBolt', 'common', 'spell'),
    ('Healing Touch', 3, NULL, NULL, 'Restore 8 health', 'healingTouch', 'common', 'spell'),
    ('Arcane Intellect', 3, NULL, NULL, 'Draw 2 cards', 'arcaneIntellect', 'rare', 'spell'),
    ('Glacial Burst', 3, NULL, NULL, 'Freeze all enemy minions', 'glacialBurst', 'epic', 'spell'),
    ('Inferno Wave', 7, NULL, NULL, 'Deal 4 damage to all enemy minions', 'infernoWave', 'epic', 'spell'),

    -- Legendární a další vzácné karty
    ('Radiant Protector', 6, 4, 5, 'Taunt, Divine Shield', 'radiantProtector', 'legendary', 'unit'),
    ('Shadow Assassin', 3, 4, 2, 'Deal 2 damage to enemy hero when played', 'shadowAssassin', 'rare', 'unit'),
    ('Mana Wyrm', 2, 2, 3, 'Gain +1 attack when you cast a spell', 'manaWyrm', 'rare', 'unit'),
    ('Soul Collector', 5, 3, 4, 'Draw a card when this minion kills an enemy', 'soulCollector', 'epic', 'unit'),
    ('Mind Control', 8, NULL, NULL, 'Take control of an enemy minion', 'mindControl', 'epic', 'spell'),
    ('Arcane Explosion', 2, NULL, NULL, 'Deal 1 damage to all enemy minions', 'arcaneExplosion', 'common', 'spell'),
    ('Holy Nova', 5, NULL, NULL, 'Deal 2 damage to all enemies and restore 2 health to all friendly characters', 'holyNova', 'rare', 'spell'),

    -- Legendární jednotky a další karty
    ('Time Weaver', 8, 6, 8, 'At the end of your turn, restore 2 health to all friendly characters', 'timeWeaver', 'legendary', 'unit'),
    ('Mana Leech', 6, 5, 5, 'When this minion deals damage, restore that much mana to you', 'manaLeech', 'legendary', 'unit'),
    ('Mirror Entity', 4, 3, 3, 'Copy a random enemy minion stats when played', 'mirrorEntity', 'epic', 'unit'),
    ('Mana Golem', 3, 0, 4, 'Attack equals your current mana crystals', 'manaGolem', 'epic', 'unit'),
    ('Spirit Healer', 5, 4, 4, 'When you cast a spell, restore 2 health to your hero', 'spiritHealer', 'rare', 'unit'),
    ('Spell Seeker', 2, 2, 3, 'Draw a random spell from your deck when played', 'spellSeeker', 'rare', 'unit'),
    ('Mana Surge', 3, NULL, NULL, 'Restore your mana crystals to maximum available this turn', 'manaSurge', 'epic', 'spell'),
    ('Soul Exchange', 5, NULL, NULL, 'Swap the health of your hero with the enemy hero', 'soulExchange', 'legendary', 'spell'),
    ('Arcane Storm', 7, NULL, NULL, 'Deal 1 damage to all characters for each spell cast by both players this game', 'arcaneStorm', 'epic', 'spell'),
    ('Mirror Image', 2, NULL, NULL, 'Create two 0/2 Mirror Images with Taunt', 'mirrorImage', 'rare', 'spell'),

    -- Common jednotky
    ('Mana Crystal', 1, 1, 3, 'When this minion dies, gain 1 mana crystal', 'manaCrystal', 'common', 'unit'),
    ('Healing Wisp', 2, 2, 2, 'When this minion attacks, restore 1 health to your hero', 'healingWisp', 'common', 'unit'),
    ('Arcane Guardian', 3, 2, 4, 'Has +1 health for each spell in your hand', 'arcaneGuardian', 'common', 'unit'),
    ('Mana Siphon', 2, 2, 2, 'When this minion attacks, gain 1 mana crystal this turn only', 'manaSiphon', 'common', 'unit'),
    ('Defensive Scout', 3, 1, 5, 'When this minion is attacked, draw a card', 'defensiveScout', 'common', 'unit'),

    -- Uncommon a rare jednotky
    ('Spell Breaker', 4, 3, 4, 'Enemy spells cost 1 more mana while this minion is alive', 'spellBreaker', 'uncommon', 'unit'),
    ('Twin Blade', 3, 2, 4, 'This minion can attack twice each turn', 'twinBlade', 'uncommon', 'unit'),
    ('Mana Collector', 5, 3, 6, 'At the start of your turn, gain mana equal to this minions attack', 'manaCollector', 'uncommon', 'unit'),
    ('Mountain Giant', 7, 6, 9, 'Taunt', 'mountainGiant', 'rare', 'unit'),
    ('Ancient Guardian', 3, 4, 6, 'Taunt. Cannot attack', 'ancientGuardian', 'rare', 'unit'),
    ('Arcane Protector', 4, 2, 5, 'Taunt. Gain +1 attack when you cast a spell', 'arcaneProtector', 'rare', 'unit'),

    -- Freezing Dragon (8 many - silná legendarní karta)
    ('Freezing Dragon', 8, 6, 7, 'Freeze all enemy minions when played', 'freezingDragon', 'legendary', 'unit'),
    
    -- Elven Commander (5 many - středně silná epická karta)
    ('Elven Commander', 5, 4, 4, 'Give all friendly minions +1/+1 when played', 'elvenCommander', 'epic', 'unit'),
    
    -- Lava Golem (6 many - silnější verze Fire Elementala)
    ('Lava Golem', 6, 6, 7, 'Deal 3 damage to enemy hero when played', 'lavaGolem', 'epic', 'unit'),
    
    -- Wolf Warrior (4 many - postupně sílící jednotka)
    ('Wolf Warrior', 4, 3, 4, 'Gain +1 attack at the end of each turn', 'wolfWarrior', 'rare', 'unit'),
    
    -- Blind Assassin (3 many - riziková jednotka s vysokým útokem)
    ('Blind Assassin', 3, 6, 3, 'This unit has 50% chance to miss its attacks.', 'blindAssassin', 'epic', 'unit'),
    
    -- Sleeping Giant (7 many - silná jednotka co první kolo nesmí útočit)
    ('Sleeping Giant', 7, 8, 8, 'Cannot attack the turn it is played', 'sleepingGiant', 'epic', 'unit');

-- Upravit popisek karty Blind Assassin
UPDATE cards 
SET description = 'This unit has 50% chance to miss its attacks.' 
WHERE name = 'Blind Assassin';