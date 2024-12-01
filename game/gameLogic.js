const { UnitCard, SpellCard } = require('./CardClasses');

// Helper funkce pro přidání combat log zprávy
function addCombatLogMessage(state, message) {
    if (!state.combatLogMessages) {
        state.combatLogMessages = [];
    }
    state.combatLogMessages.push({
        message,
        timestamp: Date.now()
    });
}

function startNextTurn(state, nextPlayer) {
    const newState = { ...state };
    newState.currentPlayer = nextPlayer;

    // Získáme předchozího hráče (ten, kdo právě končí tah)
    const previousPlayer = 1 - nextPlayer;

    const player = newState.players[nextPlayer];
    player.maxMana = Math.min(10, player.maxMana + 1);
    player.mana = player.maxMana;

    // Reset schopnosti hrdinů
    newState.players.forEach(p => p.hero.hasUsedAbility = false);

    // Reset útoků jednotek a kontrola zmražení
    player.field.forEach(card => {
        if (card.name === 'Ancient Guardian') {
            card.hasAttacked = true;
            card.canAttack = false;
        } else {
            card.hasAttacked = false;
            card.attacksThisTurn = 0;
            card.canAttack = true; // Výchozí hodnota
        }

        // Přidáme reset útoku pro Battle Mage
        if (card.name === 'Battle Mage') {
            card.attack = card.baseAttack || 3; // Reset na základní útok (3)
        }
    });

    // Rozmrazíme jednotky protivníka, které byly zmražené během jeho tahu
    const opponent = newState.players[1 - nextPlayer];
    opponent.field.forEach(card => {
        if (card.frozen && card.frozenLastTurn) {
            card.frozen = false;
            delete card.frozenLastTurn;
        }
        // Přidáme reset útoku pro Battle Mage
        if (card.name === 'Battle Mage') {
            card.attack = card.baseAttack || 3; // Reset na základní útok (3)
        }
    });

    // Označíme vlastní zmražené jednotky jako již zmražené během svého tahu
    player.field.forEach(card => {
        if (card.frozen && !card.frozenLastTurn) {
            card.frozenLastTurn = true;
            card.canAttack = false;
        }
    });

    if (player.deck.length > 0) {
        const drawnCard = player.deck.pop();
        if (player.hand.length < 10) {
            player.hand.push(drawnCard);
        } else {
            // Přidáme notifikaci o spálení karty
            newState.notification = {
                message: `Card "${drawnCard.name}" was burned because your hand was full!`,
                forPlayer: nextPlayer
            };
        }
    }

    const playerName = newState.players[nextPlayer].username;
    addCombatLogMessage(newState, `<span class="${nextPlayer === 0 ? 'player-name' : 'enemy-name'}">${playerName}'s</span> turn begins`);

    // Inicializujeme pole pro efekty, pokud neexistuje
    if (!newState.endTurnEffects) {
        newState.endTurnEffects = [];
    }

    // Přidáme efekty pro všechny Time Weavery na poli předchozího hráče
    const previousPlayerState = newState.players[previousPlayer];
    previousPlayerState.field.forEach(card => {
        if (card.name === 'Time Weaver') {
            newState.endTurnEffects.push({
                type: 'heal',
                amount: 2,
                owner: previousPlayer
            });
        }
        else if (card.name === 'Twilight Guardian') {
            newState.endTurnEffects.push({
                type: 'twilightGuardian',
                owner: previousPlayer,
                unitId: card.id
            });
        }
    });

    // Přidáme efekty pro všechny Wolf Warriory na poli OBOU hráčů
    newState.players.forEach((player, playerIndex) => {
        player.field.forEach(card => {
            if (card.name === 'Wolf Warrior') {
                newState.endTurnEffects.push({
                    type: 'wolfAttack',
                    unitId: card.id,
                    owner: playerIndex
                });
            }
        });
    });

    // Zpracování end-turn efektů
    if (newState.endTurnEffects && newState.endTurnEffects.length > 0) {
        newState.endTurnEffects.forEach(effect => {
            if (effect.type === 'heal' && effect.owner === previousPlayer) {
                const effectOwner = newState.players[previousPlayer];
                effectOwner.hero.health = Math.min(30, effectOwner.hero.health + effect.amount);
                effectOwner.field.forEach(unit => {
                    if (unit) {
                        unit.health = Math.min(unit.maxHealth, unit.health + effect.amount);
                    }
                });

                const effectOwnerName = effectOwner.username;
                addCombatLogMessage(newState, `<span class="${previousPlayer === 0 ? 'player-name' : 'enemy-name'}">${effectOwnerName}'s</span> <span class="spell-name">Time Weaver</span> restored <span class="heal">${effect.amount} health</span> to all friendly characters`);
            }
            // Wolf Warrior efekt se nyní zpracuje pro oba hráče
            else if (effect.type === 'wolfAttack') {
                const effectOwner = newState.players[effect.owner];
                const wolfWarrior = effectOwner.field.find(unit => unit && unit.id === effect.unitId);
                if (wolfWarrior) {
                    wolfWarrior.attack += 1;
                    const effectOwnerName = effectOwner.username;
                    addCombatLogMessage(newState, `<span class="${effect.owner === 0 ? 'player-name' : 'enemy-name'}">${effectOwnerName}'s</span> <span class="spell-name">Wolf Warrior</span> gained <span class="attack">+1 attack</span>`);
                }
            }

            if (effect.type === 'twilightGuardian' && effect.owner === previousPlayer) {
                const owner = newState.players[previousPlayer];
                const availableTargets = owner.field.filter(unit => 
                    unit && !unit.hasDivineShield && unit.id !== effect.unitId
                );
                
                if (availableTargets.length > 0) {
                    const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                    randomTarget.hasDivineShield = true;
                    randomTarget.divineShieldProcessed = false;
                    addCombatLogMessage(newState, `<span class="${previousPlayer === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Twilight Guardian</span> gave <span class="buff">Divine Shield</span> to <span class="spell-name">${randomTarget.name}</span>`);
                }
            }
        });
        // Vyčistíme efekty po zpracování
        newState.endTurnEffects = [];
    }

    // Inicializujeme pole pro start-turn efekty, pokud neexistuje
    if (!newState.startTurnEffects) {
        newState.startTurnEffects = [];
    }

    // Přidáme efekty pro všechny Mana Collector jednotky na poli aktuálního hráče
    const currentPlayer = newState.players[nextPlayer];
    currentPlayer.field.forEach(card => {
        if (card.name === 'Mana Collector') {
            newState.startTurnEffects.push({
                type: 'mana',
                owner: nextPlayer,
                unitId: card.id
            });
        }
    });

    // Zpracování start-turn efektů
    if (newState.startTurnEffects && newState.startTurnEffects.length > 0) {
        newState.startTurnEffects.forEach(effect => {
            if (effect.type === 'mana' && effect.owner === nextPlayer) {
                const currentPlayer = newState.players[nextPlayer];
                // Najdeme všechny Mana Collector jednotky na poli
                currentPlayer.field.forEach(unit => {
                    if (unit.name === 'Mana Collector') {
                        const manaGain = unit.attack;
                        currentPlayer.mana = Math.min(10, currentPlayer.mana + manaGain);
                        addCombatLogMessage(newState, `<span class="${nextPlayer === 0 ? 'player-name' : 'enemy-name'}">${currentPlayer.username}'s</span> <span class="spell-name">Mana Collector</span> granted <span class="mana">${manaGain} mana</span>`);
                    }
                });
            }
        });
        // Vyčistíme efekty po zpracování
        newState.startTurnEffects = [];
    }

    // Spojíme efekty Raging Berserker a Friendly Spirit do jednoho průchodu
    newState.players.forEach((player, playerIndex) => {
        player.field.forEach(card => {
            if (card) {
                if (card.name === 'Raging Berserker' && card.attack > 1) {
                    card.attack -= 1;
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Raging Berserker</span> lost <span class="attack">1 attack</span>`);
                }
                else if (card.name === 'Friendly Spirit') {
                    card.health += 1;
                    card.maxHealth += 1;
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Friendly Spirit</span> gained <span class="health">+1 health</span>`);
                }
            }
        });
    });

    return newState;
}

/**
 * Kontroluje, zda hra neskončila (některý z hrdinů má 0 nebo méně životů)
 * @param {Object} state - Aktuální stav hry
 * @returns {Object} - Aktualizovaný stav hry s informací o konci hry
 */
function checkGameOver(state) {
    if (!state || !state.players) return state;

    const newState = { ...state };

    // Kontrola životů hrdinů
    const player1Dead = newState.players[0]?.hero?.health <= 0;
    const player2Dead = newState.players[1]?.hero?.health <= 0;

    if (player1Dead || player2Dead) {
        console.log('Detekován konec hry - životy hrdinů:', {
            player1Health: newState.players[0]?.hero?.health,
            player2Health: newState.players[1]?.hero?.health
        });

        newState.gameOver = true;

        if (player1Dead && player2Dead) {
            newState.winner = 'draw';
        } else if (player1Dead) {
            newState.winner = 1;
        } else {
            newState.winner = 0;
        }

        // Deaktivujeme vechny karty
        newState.players.forEach(player => {
            if (player.field) {
                player.field.forEach(card => {
                    if (card) {
                        card.canAttack = false;
                        card.hasAttacked = true;
                    }
                });
            }
        });

        console.log('Hra končí, stav:', {
            gameOver: newState.gameOver,
            winner: newState.winner
        });
    }

    return newState;
}

// Pomocná funkce pro zpracování poškození jednotky a její efekty
function handleUnitDamage(unit, damage, opponent, playerIndex, newState) {
    if (!unit) return;
    var afterEffectFunc = null;

    const oldHealth = unit.health;
    const hadDivineShield = unit.hasDivineShield;

    if (unit.hasDivineShield) {
        unit.hasDivineShield = false;
        
        // Efekt Crystal Guardian při ztrátě Divine Shield
        if (unit.name === 'Crystal Guardian' && !unit.divineShieldProcessed) {
            const player = newState.players[1 - playerIndex];
            player.hero.health = Math.min(30, player.hero.health + 3);
            unit.divineShieldProcessed = true;
            addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Crystal Guardian</span> restored <span class="heal">3 health</span> to their hero`);
        }

        // Efekt Spirit Guardian při ztrátě Divine Shield
        if (unit.name === 'Spirit Guardian' && !unit.divineShieldProcessed) {
            unit.divineShieldProcessed = true;            
            const player = newState.players[1 - playerIndex];
            const availableTargets = player.field.filter(target => 
                target && !target.hasDivineShield && target.id !== unit.id
            );
            afterEffectFunc = () => {
                if (availableTargets.length > 0) {
                    const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                    randomTarget.hasDivineShield = true;
                    randomTarget.divineShieldProcessed = false;
                    addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Spirit Guardian</span> gave <span class="buff">Divine Shield</span> to <span class="spell-name">${randomTarget.name}</span>`);
                }
            }
        }
    } else {
        // Použijeme applySpellDamage místo přímého poškození
        if (unit.isCursed) {
            const cursedDamage = damage * 2;
            unit.health -= cursedDamage;
            if (cursedDamage > 0) addCombatLogMessage(newState, `<span class="spell-name">${unit.name}</span> takes <span class="damage">double damage (${cursedDamage})</span> due to curse`);
        } else {
            unit.health -= damage;
        }
    }

    // Kontrola pro Arcane Wisp při smrti od poškození kouzlem
    if (unit.name === 'Arcane Wisp' && unit.health <= 0) {
        const player = newState.players[1 - playerIndex];
        if (player.hand.length < 10) {
            const coin = new SpellCard(`$coin-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 'The Coin', 0, 'Gain 1 Mana Crystal', 'coinImage');
            player.hand.push(coin);
            addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Arcane Wisp</span> added <span class="spell-name">The Coin</span> to their hand`);
        }
    }

    // Kontrola pro Defensive Scout
    if (unit.name === 'Defensive Scout' && oldHealth > unit.health) {
        if (opponent.deck.length > 0 && opponent.hand.length < 10) {
            const drawnCard = opponent.deck.pop();
            opponent.hand.push(drawnCard);

            newState.notification = {
                message: 'Defensive Scout drew a card!',
                forPlayer: 1 - playerIndex
            };
            addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Defensive Scout</span> <span class="draw">drew a card</span>`);
        }
    }

    // Kontrola death efektů pokud jednotka zemřela
    if (unit.health <= 0) {
        // Death Prophet efekt
        if (unit.name === 'Death Prophet') {
            if (opponent.deck.length > 0 && opponent.hand.length < 10) {
                const drawnCard = opponent.deck.pop();
                opponent.hand.push(drawnCard);
                addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Death Prophet</span> <span class="draw">drew a card</span> on death`);
            }
        }

        // Ice Revenant efekt
        if (unit.name === 'Ice Revenant') {
            const enemyPlayer = newState.players[playerIndex];
            const availableTargets = enemyPlayer.field.filter(unit => unit && unit.health > 0);
            
            if (availableTargets.length > 0) {
                const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                randomTarget.frozen = true;
                randomTarget.frozenLastTurn = false;
                addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Ice Revenant</span> <span class="freeze">froze</span> enemy <span class="spell-name">${randomTarget.name}</span>`);
            }
        }

        // Efekt gainAttackOnDeath pro Blood Cultist a Soul Harvester
        newState.players.forEach((player, pIndex) => {
            player.field.forEach(unit => {
                if (unit && unit.gainAttackOnDeath) {
                    unit.attack += 1;
                    addCombatLogMessage(newState, `<span class="${pIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">${unit.name}</span> gained <span class="attack">+1 attack</span>`);
                }
            });
        });

        // Přidáme efekt pro Phoenix
        if (unit.name === 'Phoenix') {
            const player = newState.players[1 - playerIndex];
            const fieldIndex = player.field.findIndex(card => card && card.id === unit.id);
            if (fieldIndex !== -1) {
                // Vytvoříme Phoenix Hatchling
                const hatchling = new UnitCard(
                    `hatchling-${Date.now()}`,
                    'Phoenix Hatchling',
                    2,
                    2,
                    2,
                    '',
                    'phoenixHatchling',
                    'legendary'
                );
                player.field[fieldIndex] = hatchling;
                addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Phoenix</span> was reborn as a Phoenix Hatchling`);
            }
        }

        // Přidáme efekt pro Cursed Imp
        if (unit.name === 'Cursed Imp') {
            const player = newState.players[1 - playerIndex];
            player.hero.health = Math.max(0, player.hero.health - 3);
            addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Cursed Imp</span> dealt <span class="damage">3 damage</span> to their hero`);
        }

        // Přidáme efekt pro Fire Dragon
        if (unit.name === 'Fire Dragon') {
            let owner = opponent;
            const fireball = new SpellCard(
                `fireball-${Date.now()}`,
                'Fireball',
                4,
                'Deal 6 damage to enemy hero',
                'fireball',
                'uncommon'
            );
            
            // Vložíme Fireball do balíčku vlastníka
            const randomIndex = Math.floor(Math.random() * (owner.deck.length + 1));
            owner.deck.splice(randomIndex, 0, fireball);
            
            addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Fire Dragon</span> shuffled a <span class="spell-name">Fireball</span> into their deck`);
        }

        // Přidáme efekt pro Sacred Dragon
        if (unit.name === 'Sacred Dragon') {
            let owner = opponent;
            owner.hero.health = 30;
            addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Sacred Dragon</span> restored their hero to <span class="heal">full health</span>`);
        }
    }
    return afterEffectFunc;
}

function handleSpellEffects(card, player, opponent, state, playerIndex) {
    console.log('Začátek aplikace kouzla:', {
        cardName: card.name,
        playerMana: player.mana,
        playerHealth: player.hero.health,
        opponentHealth: opponent.hero.health
    });

    const newState = { ...state };

    // Přidáme efekt Arcane Protector k existujcí kontrole
    player.field.forEach(unit => {
        if (unit.name === 'Arcane Familiar' || unit.name === 'Arcane Protector' || unit.name === 'Mana Wyrm') {
            unit.attack += 1;
            console.log(`${unit.name} posílen:`, {
                unitName: unit.name,
                newAttack: unit.attack
            });
            // Přidáme notifikaci o posílení
            if (!newState.notification) {
                newState.notification = {
                    message: `${unit.name} gained +1 attack!`,
                    forPlayer: playerIndex
                };
            }
        }
    });

    const playerName = player.username;
    const opponentName = opponent.username;

    // Přidáme efekt Battle Mage
    player.field.forEach(unit => {
        if (unit.name === 'Battle Mage') {
            unit.attack += 2;
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}'s</span> <span class="spell-name">Battle Mage</span> gained <span class="attack">+2 attack</span>`);
        }
    });

    switch (card.name) {
        case 'Fireball':
            // Fireball nyní působí pouze 6 poškození nepřátelskému hrdinovi
            opponent.hero.health = Math.max(0, opponent.hero.health - 6);
            console.log('Fireball zasáhl hrdinu:', {
                damage: 6,
                newHealth: opponent.hero.health
            });
            newState.notification = {
                message: `Fireball dealt 6 damage to the ${opponentName}'s hero!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Fireball</span> dealing <span class="damage">6 damage</span> to ${opponentName}'s hero`);
            break;

        case 'Lightning Bolt':
            opponent.hero.health = Math.max(0, opponent.hero.health - 3);
            newState.notification = {
                message: `Lightning Bolt dealt 3 damage to the ${opponentName}'s hero!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Lightning Bolt</span> dealing <span class="damage">3 damage</span> to ${opponentName}'s hero`);
            break;

        case 'Healing Touch':
            // Healing Touch nyní léčí pouze vlastního hrdinu
            const oldHealth = player.hero.health;
            player.hero.health = Math.min(player.hero.health + 8, 30);
            const healAmount = player.hero.health - oldHealth;

            console.log('Healing Touch vyléčil:', {
                healAmount,
                newHealth: player.hero.health
            });
            newState.notification = {
                message: `Healing Touch restored ${healAmount} health to your hero!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Healing Touch</span> restoring <span class="heal">${healAmount} health</span>`);
            break;

        case 'Glacial Burst':
            opponent.field.forEach(unit => {
                if (unit) {
                    unit.frozen = true;
                    unit.frozenLastTurn = false;
                }
            });
            newState.notification = {
                message: 'All enemy units were frozen!',
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Glacial Burst</span> and <span class="freeze">froze all enemy units</span>`);
            break;

        case 'Inferno Wave':
            const damagedUnits = opponent.field.filter(unit => unit).length;
            var afterEffectFuncs = [];
            opponent.field.forEach(unit => {
                let afterEffectFunc = handleUnitDamage(unit, 4, opponent, playerIndex, newState);
                if (afterEffectFunc) {
                    afterEffectFuncs.push(afterEffectFunc);
                }
            });
            afterEffectFuncs.forEach(func => func());
            newState.notification = {
                message: 'Inferno Wave dealt 4 damage to all enemy units!',
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Inferno Wave</span> dealing <span class="damage">4 damage</span> to ${damagedUnits} enemy units`);
            break;

        case 'The Coin':
            player.mana = Math.min(player.mana + 1, 10);
            newState.notification = {
                message: 'Gained 1 mana crystal!',
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> used <span class="spell-name">The Coin</span> and gained <span class="mana">1 mana crystal</span>`);
            break;

        case 'Arcane Intellect':
            const cardsDrawn = [];
            for (let i = 0; i < 2; i++) {
                if (player.deck.length > 0) {
                    const drawnCard = player.deck.pop();
                    if (player.hand.length < 10) {
                        player.hand.push(drawnCard);
                        cardsDrawn.push(drawnCard.name);
                    }
                }
            }
            newState.notification = {
                message: `Drew ${cardsDrawn.length} cards!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Arcane Intellect</span> and <span class="draw">drew ${cardsDrawn.length} cards</span>`);
            break;

        case 'Mind Control':
            if (player.field.length >= 7) {
                newState.notification = {
                    message: 'Your field is full! Cannot take control of enemy minion.',
                    forPlayer: playerIndex
                };
                return false;
            }

            // Najdeme všechny dostupné nepřátelské jednotky
            var availableTargets = opponent.field.filter(unit => unit !== null);

            if (availableTargets.length === 0) {
                newState.notification = {
                    message: 'No enemy minions to control!',
                    forPlayer: playerIndex
                };
                return false;
            }

            // Vybereme náhodnou jednotku
            var randomIndex = Math.floor(Math.random() * availableTargets.length);
            const targetUnit = availableTargets[randomIndex];

            // Najdeme původní index jednotky v poli protivníka
            const originalIndex = opponent.field.indexOf(targetUnit);
            opponent.field[originalIndex] = null; // Odstraníme jednotku z původní pozice

            // Přidáme jednotku do pole hráče
            targetUnit.hasAttacked = true; // Nemůže útočit v tomto kole
            player.field.push(targetUnit);

            newState.notification = {
                message: `Took control of enemy ${targetUnit.name}!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mind Control</span> and took control of <span class="spell-name">${targetUnit.name}</span>`);
            break;

        case 'Arcane Explosion':
            let damagedCount = 0;
            var afterEffectFuncs = [];
            opponent.field.forEach(unit => {
                if (unit) {
                    var afterEffectFunc = handleUnitDamage(unit, 1, opponent, playerIndex, newState);
                    if (afterEffectFunc) {
                        afterEffectFuncs.push(afterEffectFunc);
                    }
                    damagedCount++;
                }
            });
            afterEffectFuncs.forEach(func => func());
            newState.notification = {
                message: `Dealt 1 damage to ${damagedCount} enemy minions!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Arcane Explosion</span> dealing <span class="damage">1 damage</span> to ${damagedCount} enemy minions`);
            break;

        case 'Holy Nova':
            let healedCount = 0;
            let damagedEnemies = 0;
            var afterEffectFuncs = [];
            // Poškození nepřátel
            opponent.field.forEach(unit => {
                if (unit) {
                    var afterEffectFunc = handleUnitDamage(unit, 2, opponent, playerIndex, newState);
                    if (afterEffectFunc) {
                        afterEffectFuncs.push(afterEffectFunc);
                    }
                    damagedEnemies++;
                }
            });
            afterEffectFuncs.forEach(func => func());
            opponent.hero.health = Math.max(0, opponent.hero.health - 2);

            // Léčení přátel
            player.field.forEach(unit => {
                if (unit) {
                    const oldHealth = unit.health;
                    unit.health = Math.min(unit.maxHealth, unit.health + 2);
                    if (unit.health > oldHealth) healedCount++;
                }
            });
            const oldHeroHealth = player.hero.health;
            player.hero.health = Math.min(30, player.hero.health + 2);
            if (player.hero.health > oldHeroHealth) healedCount++;

            newState.notification = {
                message: `Dealt 2 damage to all enemies and restored 2 health to all friendly characters!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Holy Nova</span> dealing <span class="damage">2 damage</span> to enemies and restoring <span class="heal">2 health</span> to friendly characters`);
            break;

        case 'Mana Surge':
            // Nejprve vrátíme manu za kouzlo (protože jsme ji odečetli na začátku)
            player.mana += card.manaCost;
            // Doplníme manu na maximum dostupné v tomto kole
            player.mana = player.maxMana;

            newState.notification = {
                message: `Restored mana to maximum (${player.maxMana})!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mana Surge</span> and restored mana to <span class="mana">${player.maxMana}</span>`);
            break;

        case 'Soul Exchange':
            const playerHealth = player.hero.health;
            player.hero.health = opponent.hero.health;
            opponent.hero.health = playerHealth;
            newState.notification = {
                message: `Swapped hero health with opponent!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Soul Exchange</span> and swapped hero health values`);
            break;

        case 'Arcane Storm':
            var damage = 8;

            // Poškození všech postav
            player.hero.health = Math.max(0, player.hero.health - damage);
            opponent.hero.health = Math.max(0, opponent.hero.health - damage);
            var afterEffectFuncs = [];
            // Upravené zpracování poškození jednotek
            
            player.field.forEach(unit => {
                var afterEffectFunc = handleUnitDamage(unit, damage, player, 1 - playerIndex, newState);
                if (afterEffectFunc) {
                    afterEffectFuncs.push(afterEffectFunc);
                }
            });

            //var afterEffectFunc = handleUnitDamage(unit, 1, opponent, playerIndex, newState);
            opponent.field.forEach(unit => {
                var afterEffectFunc = handleUnitDamage(unit, damage, opponent, playerIndex, newState);
                if (afterEffectFunc) {
                    afterEffectFuncs.push(afterEffectFunc);
                }
            });
            afterEffectFuncs.forEach(func => func());

            newState.notification = {
                message: `Arcane Storm dealt ${damage} damage to all characters!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Arcane Storm</span> dealing <span class="damage">${damage} damage</span> to all characters`);
            break;

        case 'Mirror Image':
            const maxNewImages = Math.min(2, 7 - player.field.length);
            if (maxNewImages <= 0) {
                newState.notification = {
                    message: 'Your field is full!',
                    forPlayer: playerIndex
                };
                return false;
            }

            const mirrorImages = [];
            for (let i = 0; i < maxNewImages; i++) {
                mirrorImages.push(new UnitCard(
                    `mirror-${Date.now()}-${i}`,
                    'Mirror Image',
                    0,
                    0,
                    2,
                    'Taunt',
                    'mirrorImage',
                    'common'
                ));
            }

            player.field.push(...mirrorImages);
            newState.notification = {
                message: `Created ${mirrorImages.length} Mirror Images with Taunt!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mirror Image</span> and summoned ${mirrorImages.length} Mirror Images`);
            break;

        case 'Sacrifice Pact':
            // Způsobí 3 poškození vlastnímu hrdinovi
            player.hero.health = Math.max(0, player.hero.health - 3);
            // Lízneme 2 karty
            for (let i = 0; i < 2; i++) {
                if (player.deck.length > 0 && player.hand.length < 10) {
                    const drawnCard = player.deck.pop();
                    player.hand.push(drawnCard);
                }
            }
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Sacrifice Pact</span> taking <span class="damage">3 damage</span> and drawing cards`);
            break;

        case 'Mass Fortification':
            let buffedCount = 0;
            player.field.forEach(unit => {
                if (unit) {
                    unit.hasTaunt = true;
                    unit.health += 2;
                    unit.maxHealth += 2;
                    buffedCount++;
                }
            });
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mass Fortification</span> buffing ${buffedCount} minions`);
            break;

        case 'Magic Arrows':
            let arrowsShot = 0;
            let damageLog = [];

            while (arrowsShot < 3) {
                // Vytvoříme seznam všech možných cílů (hrdina + minioni)
                const targets = [...opponent.field.filter(unit => unit !== null && unit.health > 0)];
                if (opponent.hero.health > 0) {
                    targets.push(opponent.hero);
                }

                if (targets.length === 0) break;

                // Vybereme náhodný cíl
                const target = targets[Math.floor(Math.random() * targets.length)];
                
                if (target === opponent.hero) {
                    opponent.hero.health = Math.max(0, opponent.hero.health - 1);
                    damageLog.push('hero');
                } else {
                    handleUnitDamage(target, 1, opponent, playerIndex, newState);
                    damageLog.push(target.name);
                }

                arrowsShot++;
            }

            // Vytvoříme zprávu pro combat log
            const arrowsMessage = damageLog.map(target => 
                target === 'hero' ? 
                `enemy hero` : 
                `<span class="spell-name">${target}</span>`
            ).join(', ');

            addCombatLogMessage(newState, 
                `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast ` +
                `<span class="spell-name">Magic Arrows</span> hitting ${arrowsMessage}`
            );
            break;

        case 'Divine Formation':
            let tauntsGiven = 0;
            player.field.forEach(unit => {
                if (unit && unit.hasDivineShield && !unit.hasTaunt) {
                    unit.hasTaunt = true;
                    tauntsGiven++;
                }
            });
            
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Divine Formation</span> giving <span class="buff">Taunt</span> to ${tauntsGiven} Divine Shield minions`);
            break;

        case 'Mind Theft':
            if (opponent.hand.length === 0) {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mind Theft</span> but opponent's hand was empty`);
                break;
            }
            
            var randomIndex = Math.floor(Math.random() * opponent.hand.length);
            const stolenCard = opponent.hand[randomIndex];
            opponent.hand.splice(randomIndex, 1);
            
            if (player.hand.length < 10) {
                player.hand.push(stolenCard);
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mind Theft</span> and stole a card from opponent's hand`);
            } else {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mind Theft</span> but their hand was full`);
            }
            break;

        case 'Shield Breaker':
            let shieldsDestroyed = 0;
            var afterEffectFuncs = [];
            opponent.field.forEach(unit => {
                if (unit && unit.hasDivineShield) {
                    // Použijeme handleUnitDamage s nulovým poškozením, aby se spustily efekty ztráty Divine Shield
                    var afterEffectFunc = handleUnitDamage(unit, 0, opponent, playerIndex, newState);
                    if (afterEffectFunc) {
                        afterEffectFuncs.push(afterEffectFunc);
                    }
                    shieldsDestroyed++;
                }
            });
            afterEffectFuncs.forEach(func => func());
            if (shieldsDestroyed > 0) {
                player.hero.health = Math.min(30, player.hero.health + shieldsDestroyed);
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Shield Breaker</span> destroying <span class="buff">${shieldsDestroyed} Divine Shields</span> and restoring <span class="heal">${shieldsDestroyed} health</span>`);
            } else {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Shield Breaker</span> but found no Divine Shields`);
            }
            break;

        case 'Mind Copy':
            if (opponent.hand.length === 0) {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mind Copy</span> but opponent's hand was empty`);
                break;
            }
            
            var randomIndex = Math.floor(Math.random() * opponent.hand.length);
            const cardToCopy = opponent.hand[randomIndex];
            
            if (player.hand.length < 10) {
                // Vytvoříme kopii karty s novým ID
                const copiedCard = cardToCopy instanceof UnitCard ?
                    new UnitCard(
                        `copy-${Date.now()}-${Math.random()}`,
                        cardToCopy.name,
                        cardToCopy.manaCost,
                        cardToCopy.attack,
                        cardToCopy.health,
                        cardToCopy.effect,
                        cardToCopy.image,
                        cardToCopy.rarity
                    ) :
                    new SpellCard(
                        `copy-${Date.now()}-${Math.random()}`,
                        cardToCopy.name,
                        cardToCopy.manaCost,
                        cardToCopy.effect,
                        cardToCopy.image,
                        cardToCopy.rarity
                    );
                
                player.hand.push(copiedCard);
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mind Copy</span> and copied a card from opponent's hand`);
            } else {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mind Copy</span> but their hand was full`);
            }
            break;

        case 'Mass Dispel':
            let tauntsRemoved = 0;
            // Odstraníme Taunt všem jednotkám na poli
            player.field.forEach(unit => {
                if (unit && unit.hasTaunt) {
                    unit.hasTaunt = false;
                    tauntsRemoved++;
                }
            });
            opponent.field.forEach(unit => {
                if (unit && unit.hasTaunt) {
                    unit.hasTaunt = false;
                    tauntsRemoved++;
                }
            });
            
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mass Dispel</span> removing <span class="buff">Taunt</span> from ${tauntsRemoved} minions`);
            break;

        case 'Frostbolt':
            var availableTargets = opponent.field.filter(unit => unit !== null);
            if (availableTargets.length === 0) {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Frostbolt</span> but there were no targets`);
                break;
            }
            
            const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
            var afterEffectFunc = handleUnitDamage(randomTarget, 3, opponent, playerIndex, newState);
            if (afterEffectFunc) afterEffectFunc();
            
            randomTarget.frozen = true;
            randomTarget.frozenLastTurn = false;
            randomTarget.canAttack = false;
            
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Frostbolt</span> dealing <span class="damage">3 damage</span> and <span class="freeze">freezing</span> <span class="spell-name">${randomTarget.name}</span>`);
            break;
    }

     // Odstranění mrtvých jednotek
    newState.players.forEach(player => {
        const deadUnits = player.field.filter(unit => unit && unit.health <= 0).length;
        newState.deadMinionsCount += deadUnits;

        // Aktualizujeme cenu Ancient Colossus ve všech místech
        newState.players.forEach(p => {
            // V ruce
            p.hand.forEach(card => {
                if (card.name === 'Ancient Colossus') {
                    card.manaCost = Math.max(1, 20 - newState.deadMinionsCount);
                }
            });
            // V balíčku
            p.deck.forEach(card => {
                if (card.name === 'Ancient Colossus') {
                    card.manaCost = Math.max(1, 20 - newState.deadMinionsCount);
                }
            });
        });

        // Odstraníme mrtvé jednotky
        player.field = player.field.filter(unit => unit && unit.health > 0);
    });

    console.log('Konec aplikace kouzla');
    return checkGameOver(newState);
}

function handleUnitEffects(card, player, opponent, state, playerIndex) {
    const newState = { ...state };
    const playerName = player.username;
    const opponentName = opponent.username;

    switch (card.name) {
        case 'Fire Elemental':
            opponent.hero.health -= 2;
            newState.notification = {
                message: `Fire Elemental dealt 2 damage to the ${opponentName}'s hero!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Fire Elemental</span> dealing <span class="damage">2 damage</span> to ${opponentName}'s hero`);
            break;

        case 'Water Elemental':
            if (opponent.field.length > 0) {
                const randomIndex = Math.floor(Math.random() * opponent.field.length);
                const targetUnit = opponent.field[randomIndex];
                targetUnit.frozen = true;
                targetUnit.frozenLastTurn = false;
                newState.notification = {
                    message: `Water Elemental froze enemy ${targetUnit.name}!`,
                    forPlayer: playerIndex
                };
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Water Elemental</span> and <span class="freeze">froze</span> enemy <span class="spell-name">${targetUnit.name}</span>`);
            }
            break;

        case 'Nimble Sprite':
            if (player.deck.length > 0) {
                const drawnCard = player.deck.pop();
                if (player.hand.length < 10) {
                    player.hand.push(drawnCard);
                    newState.notification = {
                        message: 'Nimble Sprite allowed you to draw a card!',
                        forPlayer: playerIndex
                    };
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Nimble Sprite</span> and <span class="draw">drew a card</span>`);
                }
            }
            break;

        case 'Shadow Assassin':
            // Způsobí 2 poškození nepřátelskému hrdinovi při vyložení
            opponent.hero.health = Math.max(0, opponent.hero.health - 2);
            newState.notification = {
                message: 'Shadow Assassin dealt 2 damage to enemy hero!',
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Shadow Assassin</span> dealing <span class="damage">2 damage</span> to ${opponentName}'s hero`);
            break;

        case 'Mana Wyrm':
            // Efekt je implementován v handleSpellEffects - když je zahráno kouzlo
            break;

        case 'Soul Collector':
            // Efekt je implementován v combat logice - když jednotka zabije nepřítele
            break;

        case 'Time Weaver':
            // Logika se zpracuje ve funkci startNextTurn
            newState.notification = {
                message: 'Time Weaver will heal all friendly characters at the end of your turn!',
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Time Weaver</span> with end of turn healing effect`);
            break;

        case 'Mana Leech':
            // Efekt se zpracuje při útoku v combat logice
            break;

        case 'Mirror Entity':
            if (opponent.field.length > 0) {
                const randomUnit = opponent.field[Math.floor(Math.random() * opponent.field.length)];
                card.attack = randomUnit.attack;
                card.health = randomUnit.health;
                card.maxHealth = randomUnit.health;
                newState.notification = {
                    message: `Mirror Entity copied ${randomUnit.name}'s stats!`,
                    forPlayer: playerIndex
                };
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Mirror Entity</span> copying enemy <span class="spell-name">${randomUnit.name}</span>`);
            }
            break;

        case 'Mana Golem':
            card.attack = player.mana;
            newState.notification = {
                message: `Mana Golem's attack set to ${card.attack}!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Mana Golem</span> with <span class="attack">${card.attack} attack</span>`);
            break;

        case 'Spirit Healer':
            // Efekt se zpracuje při seslání kouzla
            break;

        case 'Spell Seeker':
            const spells = player.deck.filter(card => card.type === 'spell');
            if (spells.length > 0) {
                const randomSpell = spells[Math.floor(Math.random() * spells.length)];
                const spellIndex = player.deck.indexOf(randomSpell);
                player.deck.splice(spellIndex, 1);
                if (player.hand.length < 10) {
                    player.hand.push(randomSpell);
                    newState.notification = {
                        message: `Drew ${randomSpell.name}!`,
                        forPlayer: playerIndex
                    };
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Spell Seeker</span> and <span class="draw">drew a spell</span>`);
                }
            }
            break;

        case 'Arcane Guardian':
            // Spočítáme počet kouzel v ruce
            var spellsInHand = player.hand.filter(c => c.type === 'spell').length;
            card.health += spellsInHand;
            card.maxHealth = card.health; // Aktualizujeme i maxHealth

            newState.notification = {
                message: `Arcane Guardian gained +${spellsInHand} health from spells in hand!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Arcane Guardian</span> with <span class="health">+${spellsInHand} bonus health</span>`);
            break;

        case 'Healing Wisp':
            // Efekt se zpracuje v combat logice
            break;

        case 'Mana Crystal':
            // Efekt se zpracuje při smrti jednotky
            break;

        case 'Spell Breaker':
            // Efekt se zpracuje při hraní kouzel protivníkem
            break;

        case 'Twin Blade':
            // Nastavíme speciální vlastnost pro dvojitý útok
            card.canAttackTwice = true;
            card.attacksThisTurn = 0;
            break;

        case 'Mana Collector':
            // Logika se zpracuje v startNextTurn
            break;

        case 'Mana Siphon':
        case 'Defensive Scout':
            // Efekty se zpracují v combat logice
            break;

        case 'Ancient Guardian':
            // Nastavíme kartu tak, aby nemohla útočit
            card.hasAttacked = true;
            card.canAttack = false;
            break;

        case 'Arcane Protector':
            // Využijeme stejnou logiku jako u Arcane Familiar
            // Efekt se zpracuje v handleSpellEffects při seslání kouzla
            break;

        case 'Freezing Dragon':
            // Zmrazí všechny nepřátelské jednotky
            opponent.field.forEach(unit => {
                if (unit) {
                    unit.frozen = true;
                    unit.frozenLastTurn = false;
                    unit.canAttack = false;
                }
            });
            newState.notification = {
                message: 'Freezing Dragon froze all enemy units!',
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Freezing Dragon</span> and <span class="freeze">froze all enemy units</span>`);
            break;

        case 'Elven Commander':
            // Přidá +1/+1 všem přátelským jednotkám
            let buffedUnits = 0;
            player.field.forEach(unit => {
                if (unit && unit.id !== card.id) { // Nepočítáme samotného Elven Commandera
                    unit.attack += 1;
                    unit.baseAttack = unit.attack;
                    unit.health += 1;
                    unit.maxHealth += 1;
                    buffedUnits++;
                }
            });
            newState.notification = {
                message: `Elven Commander buffed ${buffedUnits} friendly units!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Elven Commander</span> giving <span class="buff">+1/+1</span> to ${buffedUnits} units`);
            break;

        case 'Lava Golem':
            // Způsobí 3 poškození nepřátelskému hrdinovi
            opponent.hero.health = Math.max(0, opponent.hero.health - 3);
            newState.notification = {
                message: 'Lava Golem dealt 3 damage to enemy hero!',
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Lava Golem</span> dealing <span class="damage">3 damage</span> to enemy hero`);
            break;

        case 'Wolf Warrior':
            // Logika se zpracuje ve funkci startNextTurn
            break;

        case 'Blind Assassin':
            // Nastavíme speciální vlastnost pro kontrolu v combat logice
            card.isBlind = true;
            break;

        case 'Sleeping Giant':
        case 'Rookie Guard':
        case 'Sacred Defender':
            // Nastavíme, že nemůže útočit v tomto kole
            card.hasAttacked = true;
            card.canAttack = false;
            break;

        case 'Battle Mage':
            card.baseAttack = card.attack;
            // Efekt se zpracuje v handleSpellEffects při seslání kouzla
            break;

        case 'Ancient Protector':
            // Najdeme sousední jednotky a dáme jim Divine Shield
            var fieldIndex = player.field.findIndex(unit => unit.id === card.id);
            if (fieldIndex > 0 && player.field[fieldIndex - 1]) {
                let unit = player.field[fieldIndex - 1];
                unit.hasDivineShield = true;
                unit.divineShieldProcessed = false;
            }
            if (fieldIndex < player.field.length - 1 && player.field[fieldIndex + 1]) {
                let otherUnit = player.field[fieldIndex + 1];
                otherUnit.hasDivineShield = true;
                otherUnit.divineShieldProcessed = false;
            }
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Ancient Protector</span> granting <span class="buff">Divine Shield</span> to adjacent minions`);
            break;

        case 'Mana Golem Elite':
            card.attack = player.maxMana;
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Mana Golem Elite</span> with <span class="attack">${card.attack} attack</span>`);
            break;

        case 'Crystal Guardian':
            // Efekt se zpracuje při ztrátě Divine Shield v combat logice
            break;

        case 'Frost Giant':
            // Efekt se zpracuje v combat logice
            break;

        case 'Cursed Warrior':
            card.isCursed = true; // Označíme pro zpracování v combat logice
            break;

        case 'Spell Weaver':
            var spellsInHand = player.hand.filter(c => c.type === 'spell').length;
            card.attack += spellsInHand;
            card.health += spellsInHand;
            card.maxHealth = card.health;
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Spell Weaver</span> gaining <span class="buff">+${spellsInHand}/+${spellsInHand}</span>`);
            break;

        case 'Unity Warrior':
            const friendlyMinions = player.field.length-1;
            if (friendlyMinions > 0) {
                const bonus = friendlyMinions;
                card.attack += bonus;
                card.health += bonus;
                card.maxHealth = card.health;
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Unity Warrior</span> gaining <span class="buff">+${bonus}/+${bonus}</span>`);
            }
            break;

        case 'Twilight Guardian':
            card.hasDivineShield = false;
            // logika se zpracuje v startNextTurn
            break;

        case 'Blood Cultist':
            // Způsobí 5 poškození vlastnímu hrdinovi při vyložení
            player.hero.health = Math.max(0, player.hero.health - 5);
            // Nastavíme vlastnost pro sledování úmrtí jednotek
            card.gainAttackOnDeath = true;
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Blood Cultist</span> dealing <span class="damage">5 damage</span> to their hero`);
            break;

        case 'Guardian Totem':
            // Najdeme sousední jednotky a dáme jim Taunt
            var fieldIndex = player.field.findIndex(unit => unit.id === card.id);
            if (fieldIndex > 0 && player.field[fieldIndex - 1]) {
                player.field[fieldIndex - 1].hasTaunt = true;
            }
            if (fieldIndex < player.field.length - 1 && player.field[fieldIndex + 1]) {
                player.field[fieldIndex + 1].hasTaunt = true;
            }
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Guardian Totem</span> granting <span class="buff">Taunt</span> to adjacent minions`);
            break;

        case 'Soul Harvester':
            // Nastavíme vlastnost pro sledování úmrtí jednotek
            card.gainAttackOnDeath = true;
            break;

        case 'Death Prophet':
            // Efekt se zpracuje při smrti jednotky v handleCombat
            break;

        case 'Holy Elemental':
            const healAmount = 2;
            player.hero.health = Math.min(30, player.hero.health + healAmount);
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}'s</span> <span class="spell-name">Holy Elemental</span> restored <span class="heal">${healAmount} health</span> to their hero`);
            break;

        case 'Divine Healer':
            const healValue = 3;
            // Léčení hrdiny
            player.hero.health = Math.min(30, player.hero.health + healValue);
            
            // Léčení minionů
            player.field.forEach(unit => {
                if (unit) {
                    unit.health = Math.min(unit.maxHealth, unit.health + healValue);
                }
            });
            
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}'s</span> <span class="spell-name">Divine Healer</span> restored <span class="heal">${healValue} health</span> to all friendly characters`);
            break;

        case 'Wise Oracle':
            let cardsDrawn = 0;
            let cardsBurned = 0;
            
            for (let i = 0; i < 2; i++) {
                if (player.deck.length > 0) {
                    const drawnCard = player.deck.pop();
                    if (player.hand.length < 10) {
                        player.hand.push(drawnCard);
                        cardsDrawn++;
                    } else {
                        cardsBurned++;
                        addCombatLogMessage(newState, `<span class="spell-name">${drawnCard.name}</span> was burned because hand was full`);
                    }
                }
            }
            
            // Přidáme zprávu do combat logu
            if (cardsDrawn > 0) {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Wise Oracle</span> and <span class="draw">drew ${cardsDrawn} cards</span>`);
            }
            if (cardsBurned > 0) {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> burned ${cardsBurned} cards due to full hand`);
            }
            break;

            case 'Divine Protector':
                if (player.hero.health === 30) {
                    card.hasDivineShield = true;
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Divine Protector</span> gained <span class="buff">Divine Shield</span>`);
                }
                else {card.hasDivineShield = false;}
                break;
    
            case 'Elendralis':
                if (player.hero.health < 10) {
                    card.hasTaunt = true;
                    player.hero.health = Math.min(30, player.hero.health + 3);
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Elendralis</span> gained <span class="buff">Taunt</span> and restored <span class="heal">3 health</span>`);
                }
                else {card.hasTaunt = false;}
                break;
    
            case 'Pride Hunter':
                if (opponent.hero.health === 30) {
                    card.attack += 1;
                    card.health += 1;
                    card.maxHealth += 1;
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Pride Hunter</span> gained <span class="buff">+1/+1</span>`);
                }
                break;
    }

    return newState;
}

function playCardCommon(state, playerIndex, cardIndex, target = null, destinationIndex = null) {
    const newState = { ...state };
    const player = newState.players[playerIndex];
    const opponent = newState.players[1 - playerIndex];
    const card = player.hand[cardIndex];

    if (!card || player.mana < card.manaCost) {
        return {
            ...newState,
            notification: {
                message: 'Not enough mana!',
                forPlayer: playerIndex
            }
        };
    }


    if (card instanceof UnitCard) {
        // Nejdřív zkontrolujeme, jestli je místo na poli
        if (player.field.length >= 7) {
            return {
                ...newState,
                notification: {
                    message: 'No space on the field!',
                    forPlayer: playerIndex
                }
            };
        }

        // Pokud je místo, teprve pak odečteme manu a zahrajeme kartu
        player.mana -= card.manaCost;
        player.hand.splice(cardIndex, 1);

        card.canAttack = false;
        card.hasAttacked = false;

        // Vložíme kartu na specifickou pozici nebo na konec
        if (typeof destinationIndex === 'number') {
            player.field.splice(destinationIndex, 0, card);
        } else {
            player.field.push(card);
        }

        // Přidáme log zprávu o vyložení jednotky
        addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> played <span class="spell-name">${card.name}</span> (${card.attack}/${card.health})`);

        // Aplikujeme efekty jednotky při vyložení
        const stateWithEffects = handleUnitEffects(card, player, opponent, newState, playerIndex);
        return checkGameOver(stateWithEffects);
    } else if (card instanceof SpellCard) {
        // Nejdřív odečteme manu pro všechna kouzla kromě Mana Surge
        if (card.name !== 'Mana Surge') {
            player.mana -= card.manaCost;
        }


        // Před aplikací kouzla zkontrolujeme Spirit Healer efekt
        const spiritHealers = player.field.filter(unit => unit.name === 'Spirit Healer');


        // Kontrola Spell Breaker efektuv
        var extraCost = 0;
        const spellBreakers = opponent.field.filter(unit => unit.name === 'Spell Breaker');
        if (spellBreakers.length > 0) {
            extraCost = spellBreakers.length; // Každý Spell Breaker zvyšuje cenu o 1
            const totalCost = card.manaCost + extraCost;
            console.log('Spell Breaker efekt:', {
                extraCost,
                totalCost
            });
            if (player.mana < extraCost) {
                return {
                    ...newState,
                    notification: {
                        message: `Spell costs ${extraCost} more due to enemy Spell Breaker!`,
                        forPlayer: playerIndex
                    }
                };
            }
            // Odečteme extra manu za Spell Breaker efekt
            player.mana -= extraCost;
        }

        // Aplikujeme efekt kouzla
        const spellResult = handleSpellEffects(card, player, opponent, newState, playerIndex);

        // Po úspěšném seslání kouzla aplikujeme efekt Spirit Healera
        if (spellResult !== false && spiritHealers.length > 0) {
            const healAmount = 2 * spiritHealers.length;
            player.hero.health = Math.min(30, player.hero.health + healAmount);

            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Spirit Healer</span> restored <span class="heal">${healAmount} health</span>`);
        }

        if (spellResult === false) {
            if (card.name !== 'Mana Surge') {
                player.mana += card.manaCost + extraCost; // Vrátíme manu pokud se kouzlo nepovedlo
            }
            return newState;
        }

        player.hand.splice(cardIndex, 1);
        return spellResult;
    }

    return checkGameOver(newState);
}

// Přidáme novou funkci pro použití hrdinské schopnosti
function useHeroAbility(state, playerIndex) {
    console.log('Začátek useHeroAbility:', {
        playerIndex,
        currentMana: state.players[playerIndex].mana,
        heroType: state.players[playerIndex].hero.id,
        hasUsedAbility: state.players[playerIndex].hero.hasUsedAbility
    });

    const newState = { ...state };
    const player = newState.players[playerIndex];
    const opponent = newState.players[1 - playerIndex];

    console.log('Kontrola podmínek:', {
        hasHero: !!player.hero,
        hasUsedAbility: player.hero?.hasUsedAbility,
        currentMana: player.mana,
        abilityCost: player.hero?.abilityCost,
        heroId: player.hero?.id
    });

    // Kontroly
    if (!player.hero || player.hero.hasUsedAbility) {
        console.log('Schopnost nelze použít - již byla použita nebo chybí hrdina');
        return {
            ...newState,
            notification: {
                message: 'Hero ability already used this turn!',
                forPlayer: playerIndex
            }
        };
    }

    if (player.mana < player.hero.abilityCost) {
        console.log('Schopnost nelze použít - nedostatek many');
        return {
            ...newState,
            notification: {
                message: 'Not enough mana!',
                forPlayer: playerIndex
            }
        };
    }


    // Použití schopnosti podle ID hrdiny (1 = Mage, 2 = Priest)
    switch (player.hero.id) {
        case 1: // Mage
            opponent.hero.health = Math.max(0, opponent.hero.health - 2);
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Fireblast</span> dealing <span class="damage">2 damage</span> to enemy hero`);
            break;
        case 2: // Priest
            player.hero.health = Math.min(30, player.hero.health + 2);
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Lesser Heal</span> restoring <span class="heal">2 health</span>`);
            break;
        case 3: // Seer
            if (player.deck.length > 0) {
                const drawnCard = player.deck.pop();
                if (player.hand.length < 10) {
                    player.hand.push(drawnCard);
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Fortune Draw</span> and <span class="draw">drew a card</span>`);
                } else {
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Fortune Draw</span> but their hand was full`);
                }
            } else {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Fortune Draw</span> but their deck was empty`);
            }
            break;
        case 4: // Defender
            const availableMinions = player.field.filter(unit => unit && !unit.hasTaunt);
            if (availableMinions.length > 0) {
                const randomMinion = availableMinions[Math.floor(Math.random() * availableMinions.length)];
                randomMinion.hasTaunt = true;
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Protect</span> giving <span class="buff">Taunt</span> to <span class="spell-name">${randomMinion.name}</span>`);
            } else {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Protect</span> but had no valid targets`);
            }
            break;
        case 5: // Warrior
            const availableMinionsBuff = player.field.filter(unit => unit);
            if (availableMinionsBuff.length > 0) {
                const randomMinion = availableMinionsBuff[Math.floor(Math.random() * availableMinionsBuff.length)];
                randomMinion.attack += 1;
                if (randomMinion.baseAttack !== undefined) {
                    randomMinion.baseAttack += 1;
                }
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Battle Command</span> giving <span class="buff">+1 Attack</span> to <span class="spell-name">${randomMinion.name}</span>`);
            } else {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Battle Command</span> but had no valid targets`);
            }
            break;
        default:
            console.log('Neznámý hrdina ID:', player.hero.id);
            return newState;
    }

    // Aktualizace stavu
    player.mana -= player.hero.abilityCost;
    player.hero.hasUsedAbility = true;

    // Kontrola konce hry
    return checkGameOver(newState);
}

// Exportujeme novou funkci
module.exports = {
    startNextTurn,
    checkGameOver,
    playCardCommon,
    handleSpellEffects,
    handleUnitEffects,
    addCombatLogMessage,
    useHeroAbility  // Přidáme export
};
