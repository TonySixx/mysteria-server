-- Přidání nových karet do databáze
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    ('Mana Vampire', 4, 2, 4, 'When this minion deals damage, gain 1 mana crystal this turn for each damage dealt', 'manaVampire', 'epic', 'unit'),
    ('Crystal Guardian', 5, 3, 6, 'Divine Shield, Taunt. When Divine Shield is broken, restore 3 health to your hero', 'crystalGuardian', 'rare', 'unit'),
    ('Frost Giant', 7, 6, 8, 'Freeze any character damaged by this minion', 'frostGiant', 'epic', 'unit'),
    ('Shadow Priest', 3, 2, 4, 'When this minion attacks, restore health equal to the damage dealt to your hero', 'shadowPriest', 'rare', 'unit'),
    ('Mana Golem Elite', 6, 0, 7, 'Attack equals your maximum mana crystals. Taunt', 'manaGolemElite', 'epic', 'unit'),
    ('Cursed Warrior', 2, 4, 3, 'Takes double damage from all sources', 'cursedWarrior', 'common', 'unit'),
    ('Ancient Protector', 8, 5, 9, 'Divine Shield, Taunt. Adjacent minions also gain Divine Shield', 'ancientProtector', 'legendary', 'unit'),
    ('Battle Mage', 4, 3, 5, 'When you cast a spell, this minion gains +2 attack this turn', 'battleMage', 'rare', 'unit'); 