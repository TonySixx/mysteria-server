-- Přidání nových karet do databáze
INSERT INTO cards (name, mana_cost, attack, health, effect, image, rarity, type) VALUES
    -- Přidání nových karet na konec souboru
    ('Stone Guardian', 3, 2, 5, 'Taunt', 'stoneGuardian', 'common', 'unit'),
    
    -- Silná jednotka s Divine Shield a Taunt
    ('Holy Defender', 5, 3, 6, 'Divine Shield, Taunt', 'holyDefender', 'rare', 'unit'),
    
    -- Jednotka co získává +1/+1 za každé kouzlo v ruce
    ('Spell Weaver', 4, 2, 3, 'Gain +1/+1 for each spell in your hand when played', 'spellWeaver', 'epic', 'unit'),
    
    -- Jednotka co při smrti zmrazí nepřátelskou jednotku
    ('Ice Revenant', 4, 3, 3, 'Freeze a random enemy minion when this dies', 'iceRevenant', 'rare', 'unit'),
    
    -- Silná jednotka s Divine Shield
    ('Light Champion', 6, 5, 5, 'Divine Shield', 'lightChampion', 'uncommon', 'unit'),
    
    -- Jednotka co léčí hrdinu při útoku
    ('Life Drainer', 5, 4, 4, 'When this minion attacks, restore 2 health to your hero', 'lifeDrainer', 'rare', 'unit'),
    
    -- Legendární jednotka co dává Divine Shield sousedům
    ('Twilight Guardian', 7, 4, 7, 'Taunt. At the end of your turn, give a random friendly minion Divine Shield', 'twilightGuardian', 'legendary', 'unit'),
    
    -- Jednotka co při vyložení získá +1/+1 za každou přátelskou jednotku
    ('Unity Warrior', 4, 3, 3, 'Gain +1/+1 for each other friendly minion when played', 'unityWarrior', 'epic', 'unit');