-- Přidání nových karet do databáze
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    -- Blood Cultist (3 mana - legendární karta s obětováním životů)
    ('Blood Cultist', 3, 4, 5, 'Deal 5 damage to your hero when played. When any minion dies, gain +1 attack', 'bloodCultist', 'legendary', 'unit'),

    -- Guardian Totem (4 mana - vzácná karta s Taunt efektem)
    ('Guardian Totem', 4, 2, 5, 'Taunt. Adjacent minions gain Taunt', 'guardianTotem', 'rare', 'unit'),

    -- Soul Harvester (5 mana - epická karta získávající sílu ze smrti)
    ('Soul Harvester', 5, 3, 4, 'Whenever a minion dies, gain +1 attack', 'soulHarvester', 'epic', 'unit'),

    -- Sacrifice Pact (2 mana - uncommon kouzlo)
    ('Sacrifice Pact', 2, NULL, NULL, 'Deal 3 damage to your hero. Draw 2 cards', 'sacrificePact', 'uncommon', 'spell'),

    -- Mass Fortification (4 mana - rare kouzlo)
    ('Mass Fortification', 4, NULL, NULL, 'Give all friendly minions Taunt and +0/+2', 'massFortification', 'rare', 'spell'),

    -- Death Prophet (1 mana - common jednotka)
    ('Death Prophet', 1, 1, 1, 'When this minion dies, draw a card', 'deathProphet', 'common', 'unit');