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
    ('Sleeping Giant', 7, 8, 8, 'Cannot attack the turn it is played', 'sleepingGiant', 'epic', 'unit'),

    -- Nové karty
    ('Mana Vampire', 4, 2, 4, 'When this minion deals damage, gain 1 mana crystal this turn for each damage dealt', 'manaVampire', 'epic', 'unit'),
    ('Crystal Guardian', 5, 3, 6, 'Divine Shield, Taunt. When Divine Shield is broken, restore 3 health to your hero', 'crystalGuardian', 'rare', 'unit'),
    ('Frost Giant', 7, 6, 8, 'Freeze any character damaged by this minion', 'frostGiant', 'epic', 'unit'),
    ('Shadow Priest', 3, 2, 4, 'When this minion attacks, restore health equal to the damage dealt to your hero', 'shadowPriest', 'rare', 'unit'),
    ('Mana Golem Elite', 6, 0, 7, 'Attack equals your maximum mana crystals. Taunt', 'manaGolemElite', 'epic', 'unit'),
    ('Cursed Warrior', 2, 4, 3, 'Takes double damage from all sources', 'cursedWarrior', 'common', 'unit'),
    ('Ancient Protector', 8, 5, 9, 'Divine Shield, Taunt. Adjacent minions also gain Divine Shield', 'ancientProtector', 'legendary', 'unit'),
    ('Battle Mage', 4, 3, 5, 'When you cast a spell, this minion gains +2 attack this turn', 'battleMage', 'rare', 'unit'),

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
    ('Unity Warrior', 4, 3, 3, 'Gain +1/+1 for each other friendly minion when played', 'unityWarrior', 'epic', 'unit'),

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
    ('Death Prophet', 1, 1, 1, 'When this minion dies, draw a card', 'deathProphet', 'common', 'unit'),

    -- Fénix - legendární karta s efektem znovuzrození
    ('Phoenix', 4, 4, 3, 'When this minion dies, summon a 2/2 Phoenix Hatchling', 'phoenix', 'legendary', 'unit'),
    
    -- Berserker - karta ztrácející útok
    ('Raging Berserker', 3, 5, 3, 'At the end of each turn, this minion loses 1 attack until it reaches 1', 'ragingBerserker', 'rare', 'unit'),
    
    -- Cursed Imp - silná karta s nevýhodou
    ('Cursed Imp', 1, 3, 3, 'When this minion dies, deal 3 damage to your hero', 'cursedImp', 'legendary', 'unit'),

    -- Přidáme nové karty
    ('Spirit Guardian', 2, 1, 3, 'Divine Shield. When Divine Shield is broken, give a random friendly minion Divine Shield', 'spiritGuardian', 'legendary', 'unit'),
    ('Flame Warrior', 4, 6, 6, 'Takes 2 damage whenever this minion attacks', 'flameWarrior', 'uncommon', 'unit'),
    ('Arcane Wisp', 1, 1, 1, 'When this minion dies, add a copy of The Coin to your hand', 'arcaneWisp', 'uncommon', 'unit'),
    ('Armored Elephant', 4, 2, 8, 'Taunt', 'armoredElephant', 'uncommon', 'unit'),
    ('Holy Elemental', 3, 3, 4, 'Restore 2 health to your hero when played', 'holyElemental', 'uncommon', 'unit'),
    ('Divine Healer', 4, 3, 4, 'Restore 3 health to all friendly characters when played', 'divineHealer', 'rare', 'unit'),
    ('Friendly Spirit', 3, 2, 3, 'Divine Shield. At the end of each turn, gain +1 health', 'growingShield', 'uncommon', 'unit'),
    ('Magic Arrows', 1, NULL, NULL, 'Deal 1 damage to a random enemy character 3 times', 'magicArrows', 'common', 'spell'),
    ('Charging Knight', 4, 5, 3, 'Divine Shield', 'chargingKnight', 'rare', 'unit'),
    ('Rookie Guard', 2, 2, 4, 'Taunt. Cannot attack the turn it is played', 'rookieGuard', 'common', 'unit'),
    ('Sacred Defender', 3, 2, 5, 'Taunt, Divine Shield. Cannot attack the turn it is played', 'sacredDefender', 'rare', 'unit'),

    -- Ohnivý drak - vyvážená karta za 7 many s Taunt a death efektem
    ('Fire Dragon', 7, 6, 7, 'Taunt. When this minion dies, shuffle a Fireball into your deck', 'fireDragon', 'legendary', 'unit'),
    
    -- Posvátný drak - silná karta za 10 many s Taunt a léčivým death efektem
    ('Sacred Dragon', 10, 8, 10, 'Taunt. When this minion dies, restore your hero to full health', 'sacredDragon', 'legendary', 'unit'),

    -- Divine Protector - uncommon kouzlo dávající Taunt jednotkám s Divine Shield
    ('Divine Formation', 1, NULL, NULL, 'Give Taunt to all friendly minions with Divine Shield', 'divineFormation', 'uncommon', 'spell'),
    
    -- Ancient Colossus - legendary minion se snižující se cenou
    ('Ancient Colossus', 20, 12, 12, 'Costs (1) less for each minion that died this game', 'ancientColossus', 'legendary', 'unit'),

    -- 1. Legendary kouzlo - Mind Theft
    ('Mind Theft', 4, NULL, NULL, 'Steal a random card from your opponent''s hand', 'mindTheft', 'legendary', 'spell'),
    
    -- 2. Legendary minion - Wise Oracle
    ('Wise Oracle', 5, 3, 4, 'Draw 2 cards when played', 'wiseOracle', 'legendary', 'unit'),
    
    -- 3. Uncommon minion - Assassin Scout
    ('Assassin Scout', 3, 3, 3, 'Deals +2 damage when attacking the enemy hero', 'assassinScout', 'uncommon', 'unit'),
    
    -- 4. Uncommon kouzlo - Shield Breaker
    ('Shield Breaker', 2, NULL, NULL, 'Destroy all enemy Divine Shields. Restore 1 health to your hero for each shield destroyed', 'shieldBreaker', 'uncommon', 'spell'),
    
    -- 5. Legendary minion - Divine Squire
    ('Divine Squire', 1, 1, 1, 'Divine Shield', 'divineSquire', 'legendary', 'unit'),

    -- 6. Epic kouzlo - Mind Copy
    ('Mind Copy', 1, NULL, NULL, 'Create a copy of a random card from your opponent''s hand', 'mindCopy', 'epic', 'spell'),

    -- 1. Uncommon Minion - Divine Protector
    ('Divine Protector', 4, 5, 5, 'Gain Divine Shield if your hero has full health when played', 'divineProtector', 'uncommon', 'unit'),
    
    -- 2. Legendary Minion - Last Hope Guardian
    ('Elendralis', 5, 4, 6, 'If your hero has less than 10 health when played, gain Taunt and restore 3 health to your hero', 'elendralis', 'legendary', 'unit'),
    
    -- 3. Uncommon Minion - Pride Hunter
    ('Pride Hunter', 2, 2, 3, 'Gain +1/+1 if enemy hero has full health when played', 'prideHunter', 'uncommon', 'unit'),
    
    -- 4. Epic Spell - Mass Dispel
    ('Mass Dispel', 3, NULL, NULL, 'Remove Taunt from all minions', 'massDispel', 'epic', 'spell'),

    -- 1. Frostbolt - uncommon kouzlo za 2 many
    ('Frostbolt', 2, NULL, NULL, 'Deal 3 damage to a random enemy minion and freeze it', 'frostbolt', 'uncommon', 'spell'),

    -- 2. Frost Knight - legendary jednotka s divine shield a freeze efektem
    ('Frost Knight', 3, 2, 4, 'Divine Shield. Freeze any minion damaged by this unit', 'frostKnight', 'epic', 'unit'),

    -- 1. Epic kouzlo - Polymorph Wave
    ('Polymorph Wave', 7, NULL, NULL, 'Transform all minions into 1/1 Ducks', 'polymorphWave', 'epic', 'spell'),

    -- 2. Rare jednotka - Sneaky Infiltrator
    ('Sneaky Infiltrator', 1, 3, 2, 'Deals 2 less damage when attacking enemy hero', 'sneakyInfiltrator', 'rare', 'unit'),

    -- 3. Uncommon kouzlo - Holy Strike
    ('Holy Strike', 2, NULL, NULL, 'Deal 2 damage to a random enemy minion and restore 2 health to your hero', 'holyStrike', 'uncommon', 'spell'),

    -- 4. Legendary jednotka - Silence Assassin
    ('Silence Assassin', 3, 3, 4, 'When this minion attacks a Taunt minion, remove its Taunt. Cannot attack the turn it is played', 'silenceAssassin', 'legendary', 'unit'),

    -- Přidáme nové karty na konec souboru
    -- 1. Epic Spell - Battle Cry
    ('Battle Cry', 2, 'Give all friendly minions +1 Attack', 'battleCry', 'epic', 'spell'),

    -- 2. Rare minion - Frost Warden
    ('Frost Warden', 6, 6, 6, 'Freeze a random enemy minion when played', 'frostWarden', 'rare', 'unit'),

    -- 3. Legendary Minion - Chaos Lord
    ('Chaos Lord', 6, 6, 9, 'When played, discard a random card from your hand', 'chaosLord', 'legendary', 'unit'),

    -- 4. Epic Minion - Blood Knight
    ('Blood Knight', 6, 6, 8, 'Deal 2 damage to your hero when played', 'bloodKnight', 'epic', 'unit'),

    -- Přidáme nového miniona za 0 many
    ('Desperate Scout', 0, 1, 1, 'Draw a card and deal 1 damage to your hero when played', 'desperateScout', 'common', 'unit'),

    -- 1. Balanced Warrior - common 5 mana minion bez efektu
    ('Balanced Warrior', 5, 6, 6, NULL, 'balancedWarrior', 'common', 'unit'),
    
    -- 2. Aggressive Warrior - common 4 mana minion s vysokým útokem
    ('Aggressive Warrior', 4, 6, 3, NULL, 'aggressiveWarrior', 'common', 'unit'),
    
    -- 3. Healing Sentinel - uncommon 5 mana minion s léčivým efektem
    ('Healing Sentinel', 5, 4, 5, 'Restore 4 health to your hero when played', 'healingSentinel', 'uncommon', 'unit'),
    
    -- 4. Frost Overseer - epic 6 mana minion se zmrazovacím efektem
    ('Frost Overseer', 5, 4, 6, 'At the end of your turn, freeze a random enemy minion', 'frostOverseer', 'epic', 'unit'),

    -- 1. Legendary minion - Legion Commander
    ('Legion Commander', 9, 6, 6, 'When played, fill your board with 1/1 minions that cannot attack this turn', 'legionCommander', 'legendary', 'unit'),
    
    -- 2. Epic minion - Arcane Summoner
    ('Arcane Summoner', 4, 3, 3, 'When this minion dies, shuffle two Arcane Wisps into your deck', 'arcaneSummoner', 'epic', 'unit'),
    
    -- 3. Epic minion - Mind Mimic
    ('Mind Mimic', 5, 4, 4, 'When played, create a copy of a random card from your opponent''s hand', 'mindMimic', 'epic', 'unit'),
    
    -- 4. Epic minion - Eternal Wanderer
    ('Eternal Wanderer', 6, 5, 5, 'Cannot attack the turn it is played. When this minion dies, return it to your hand', 'eternalWanderer', 'epic', 'unit'),

    -- 1. Taunt za 1 manu (Common)
    ('Tiny Protector', 1, 1, 3, 'Taunt', 'tinyProtector', 'common', 'unit'),

    -- 2. Uncommon spell - vrácení karty a léčení
    ('Soothing Return', 3, NULL, NULL, 'Return a random enemy minion to their hand and restore 3 health to your hero', 'soothingReturn', 'uncommon', 'spell'),

    -- 3. Rare spell - zničení miniona
    ('Death Touch', 4, NULL, NULL, 'Destroy a random enemy minion', 'shadowWordDeath', 'rare', 'spell'),

    -- 4. Epic minion - spawner
    ('Spirit Summoner', 4, 3, 4, 'At the end of your turn, summon a 1/1 Spirit', 'spiritSummoner', 'epic', 'unit'),

    -- 1. Epic Minion - Vitality Guardian
    ('Angel Guardian', 5, 3, 8, 'Taunt. At the end of your turn, gain +1/+1 if your hero has full health', 'angelGuardian', 'epic', 'unit'),
    
    -- 2. Uncommon Minion - Health Protector
    ('Rune Defender', 4, 5, 6, 'Gain Taunt if your hero has full health when played', 'runeDefender', 'uncommon', 'unit'),
    
    -- 3. Rare Spell - Unity Strike
    ('Unity Strike', 2, NULL, NULL, 'Deal damage to enemy hero equal to the number of friendly minions', 'unityStrike', 'rare', 'spell'),
    
    -- 4. Rare Spell - Mass Healing
    ('Source Healing', 2, NULL, NULL, 'Restore health to your hero equal to the total number of minions on the board', 'sourceHealing', 'rare', 'spell'),

    -- Přidání nových karet
    ('Zoxus', 2, 1, 1, 'Divine Shield. At the end of each turn, gain +1/+1', 'zoxus', 'legendary', 'unit'),
    ('Merciful Protector', 3, 3, 4, 'Divine Shield. When played, restore 5 health to enemy hero', 'mercifulProtector', 'epic', 'unit'),
    ('Mana Benefactor', 2, 3, 4, 'When played, your opponent gains 1 mana crystal next turn', 'manaBenefactor', 'epic', 'unit'),

    -- Přidání nových karet
    ('Frost Spirit', 1, 2, 1, 'When this minion dies, freeze a random enemy minion', 'frostSpirit', 'uncommon', 'unit'),
    ('Bee Guardian', 6, 5, 5, 'Taunt, Divine Shield. When this minion dies, your opponent draws a card', 'beeGuardian', 'epic', 'unit'),
    ('Healing Acolyte', 2, 1, 4, 'At the end of your turn, restore 1 health to your hero', 'healingAcolyte', 'rare', 'unit'),

    -- Přidáme nové karty
    ('Overloading Giant', 4, 7, 7, 'Overload (2)', 'overloadingGiant', 'epic', 'unit'),
    ('Mana Fusion', 0, NULL, NULL, 'Gain 2 Mana Crystals this turn only. Overload (2)', 'manaFusion', 'epic', 'spell'),
    ('Swift Guardian', 4, 3, 3, 'Divine Shield. Can attack twice each turn', 'swiftGuardian', 'epic', 'unit'),

    -- Přidání nových karet
    ('Tactical Scout', 2, 2, 4, 'Draw a card when played if your hero has more health than your opponent', 'tacticalScout', 'rare', 'unit'),
    ('Frost Harvester', 3, 3, 3, 'Gain +1/+1 for each frozen enemy minion when played', 'frostHarvester', 'epic', 'unit'),
    ('Taunt Collector', 6, 3, 3, 'Taunt. Remove Taunt from all other minions, gain +1 HP per Taunt removed.', 'tauntCollector', 'epic', 'unit'),

    -- Přidání nových karet
    ('Dark Scholar', 2, 3, 2, 'Deal 2 damage to your hero and draw a card when played', 'darkScholar', 'rare', 'unit'),
    ('Vigilant Guard', 3, 2, 4, 'Taunt. Draw a card when played', 'vigilantGuard', 'uncommon', 'unit'),
    ('Lone Protector', 3, 4, 2, 'Gain Divine Shield and Taunt if there are no other minions on the board when played', 'loneProtector', 'epic', 'unit'),

    -- Přidání nových karet
    ('Wisdom Seeker', 6, 5, 5, 'Draw a card if your hero has full health when played, otherwise gain Taunt', 'wisdomSeeker', 'epic', 'unit'),
    ('Echo Warrior', 5, 4, 4, 'When played, shuffle a copy of this card into your deck', 'echoWarrior', 'epic', 'unit'),
    ('Chaos Imp', 2, 2, 1, 'Divine Shield. When played, destroy a random card in your hand', 'chaosImp', 'epic', 'unit');

-- Upravit popisek karty Blind Assassin
UPDATE cards 
SET description = 'This unit has 50% chance to miss its attacks.' 
WHERE name = 'Blind Assassin';

-- Upravíme popisek pro Spell Weaver
UPDATE cards 
SET effect = 'Gain +1/+1 for each spell in your hand when played' 
WHERE name = 'Spell Weaver';

