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

    // Zpracování jednotek s dočasnou změnou vlastníka (pro kartu Phantom Mirage)
    // Musíme projít pole obou hráčů, protože ukradené jednotky mohou být kdekoliv
    const unitsToReturn = [];
    
    // Funkce pro zpracování pole s jednotkami
    const processField = (field, currentOwnerIndex) => {
        field.forEach(unit => {
            if (unit && unit.temporaryOwnerChange) {
                unit.turnsUntilReturn--;
                
                // Pokud je čas na vrácení, přidáme jednotku do seznamu s informací o současném vlastníkovi
                if (unit.turnsUntilReturn <= 0) {
                    unitsToReturn.push({
                        unit: unit,
                        currentOwnerIndex: currentOwnerIndex
                    });
                }
            }
        });
    };
    
    // Zpracujeme pole obou hráčů
    processField(player.field, nextPlayer);
    processField(opponent.field, 1 - nextPlayer);

    if (unitsToReturn.length > 0) {
        for (const item of unitsToReturn) {
            const { unit, currentOwnerIndex } = item;
            const currentOwner = newState.players[currentOwnerIndex];
            const originalOwner = newState.players[unit.originalOwner];
            
            // Odstraníme jednotku z pole současného vlastníka
            const unitIndex = currentOwner.field.indexOf(unit);
            if (unitIndex !== -1) {
                const returnedUnit = currentOwner.field.splice(unitIndex, 1)[0];
                
                // Resetujeme příznaky dočasné změny vlastníka
                delete returnedUnit.temporaryOwnerChange;
                delete returnedUnit.originalOwner;
                delete returnedUnit.turnsUntilReturn;
                
                // Vrátíme jednotku původnímu majiteli, pokud má místo
                if (originalOwner.field.length < 7) {
                    originalOwner.field.push(returnedUnit);
                    returnedUnit.hasAttacked = false;
                    returnedUnit.attacksThisTurn = 0;
                    returnedUnit.canAttack = true; // Výchozí hodnota
                    addCombatLogMessage(newState, `<span class="spell-name">${returnedUnit.name}</span> returned to <span class="${unit.originalOwner === 0 ? 'player-name' : 'enemy-name'}">${originalOwner.username}</span>'s control`);
                } else {
                    addCombatLogMessage(newState, `<span class="spell-name">${returnedUnit.name}</span> was destroyed - no space on <span class="${unit.originalOwner === 0 ? 'player-name' : 'enemy-name'}">${originalOwner.username}</span>'s board`);
                }
            }
        }
    }


    if (player.deck.length > 0) {
        const drawnCard = player.deck.pop();
        if (player.hand.length < 10) {
            // Najdeme pozici Hand Of Fate v ruce, pokud existuje
            const handOfFateIndex = player.hand.findIndex(card => card.name === 'Hand of Fate');
            if (handOfFateIndex !== -1) {
                // Vložíme novou kartu před Hand Of Fate
                player.hand.splice(handOfFateIndex, 0, drawnCard);
            } else {
                // Pokud Hand Of Fate není v ruce, vložíme kartu na konec
                player.hand.push(drawnCard);
            }
        } else {
            // Přidáme notifikaci o spálení karty
            newState.notification = {
                message: `Card "${drawnCard.name}" was burned because your hand was full!`,
                forPlayer: nextPlayer
            };
        }
    } else {
        // Fatigue damage
        if (!player.fatigueDamage) {
            player.fatigueDamage = 1;
        } else {
            player.fatigueDamage++;
        }

        // Aplikujeme fatigue damage
        player.hero.health -= player.fatigueDamage;
        
        // Přidáme zprávu do combat logu
        addCombatLogMessage(newState, `<span class="${nextPlayer === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> took <span class="damage">${player.fatigueDamage} fatigue damage</span> from an empty deck`);
        
        // Použijeme checkGameOver místo přímé kontroly
        const gameOverState = checkGameOver(newState);
        if (gameOverState.gameOver) {
            return gameOverState;
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
        else if (card.name === 'Frost Overseer') {
            newState.endTurnEffects.push({
                type: 'frostOverseer',
                owner: previousPlayer,
                unitId: card.id
            });
        }
        else if (card.name === 'Spirit Summoner') {
            newState.endTurnEffects.push({
                type: 'spiritSummoner',
                owner: previousPlayer,
                unitId: card.id
            });
        }
        else if (card.name === 'Angel Guardian') {
           newState.endTurnEffects.push({
            type: 'angelGuardian',
            owner: previousPlayer,
            unitId: card.id
           });
        }
        else if (card.name === 'Zoxus') {
            newState.endTurnEffects.push({
                type: 'zoxus',
                owner: previousPlayer,
                unitId: card.id
            });
        }
        else if (card.name === 'Healing Acolyte') {
            newState.endTurnEffects.push({
                type: 'healingAcolyte',
                owner: previousPlayer,
                unitId: card.id
            });
        }
        else if (card.name === 'Mystic Chronicler') {
            newState.endTurnEffects.push({
                type: 'mysticChronicler',
                owner: previousPlayer
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



    // Zpracování extra many z Mana Benefactor
    if (newState.players[nextPlayer].nextTurnExtraMana) {
        const extraMana = newState.players[nextPlayer].nextTurnExtraMana;
        newState.players[nextPlayer].mana += extraMana;
        newState.players[nextPlayer].mana = Math.min(10, newState.players[nextPlayer].mana);
        newState.players[nextPlayer].nextTurnExtraMana = 0;
        addCombatLogMessage(newState, `<span class="${nextPlayer === 0 ? 'player-name' : 'enemy-name'}">${newState.players[nextPlayer].username}</span> gained <span class="mana">${extraMana} bonus mana crystal</span> from Mana Benefactor`);
    }
    if (newState.players[nextPlayer].overloadedMana > 0) {
        var playerMana = newState.players[nextPlayer].mana;
        newState.players[nextPlayer].mana = Math.max(0, playerMana - newState.players[nextPlayer].overloadedMana);
        newState.players[nextPlayer].overloadedMana = 0;
    }

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
                var owner = newState.players[previousPlayer];
                var availableTargets = owner.field.filter(unit => 
                    unit && !unit.hasDivineShield && unit.id !== effect.unitId
                );
                
                if (availableTargets.length > 0) {
                    const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                    randomTarget.hasDivineShield = true;
                    randomTarget.divineShieldProcessed = false;
                    addCombatLogMessage(newState, `<span class="${previousPlayer === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Twilight Guardian</span> gave <span class="buff">Divine Shield</span> to <span class="spell-name">${randomTarget.name}</span>`);
                }
            }

            else if (effect.type === 'frostOverseer' && effect.owner === previousPlayer) {
                var owner = newState.players[previousPlayer];
                var opponent_local = newState.players[1 - effect.owner];
                var availableTargets = opponent_local.field.filter(unit => unit &&!unit.frozen);
                
                if (availableTargets.length > 0) {
                    const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                    randomTarget.frozen = true;
                    randomTarget.frozenLastTurn = true;
                    addCombatLogMessage(newState, `<span class="${effect.owner === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Frost Overseer</span> <span class="freeze">froze</span> enemy <span class="spell-name">${randomTarget.name}</span>`);
                }
            }

            else if (effect.type === 'angelGuardian' && effect.owner === previousPlayer) {
                var owner = newState.players[previousPlayer];
                if (owner.hero.health === 30) {     
                    var angelGuardian = owner.field.find(unit => unit && unit.id === effect.unitId);
                    angelGuardian.attack += 1;
                    angelGuardian.health += 1;
                    angelGuardian.maxHealth += 1;
                    addCombatLogMessage(newState, `<span class="${previousPlayer === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Angel Guardian</span> gained <span class="buff">+1/+1</span>`);
                }
            }

            else if (effect.type === 'zoxus' && effect.owner === previousPlayer) {
                var owner = newState.players[previousPlayer];
                var zoxus = owner.field.find(unit => unit && unit.id === effect.unitId);
                zoxus.attack += 1;
                zoxus.health += 1;
                zoxus.maxHealth += 1;
                addCombatLogMessage(newState, `<span class="${previousPlayer === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Zoxus</span> gained <span class="buff">+1/+1</span>`);
            }

            else if (effect.type === "healingAcolyte" && effect.owner === previousPlayer) {
                var owner = newState.players[previousPlayer];
                owner.hero.health = Math.min(30, owner.hero.health + 1);
                addCombatLogMessage(newState, `<span class="${previousPlayer === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Healing Acolyte</span> restored <span class="heal">1 health</span> to their hero`);
            }

            else if (effect.type === 'mysticChronicler' && effect.owner === previousPlayer) {
                var owner = newState.players[previousPlayer];
                if (owner.deck.length > 0) {
                    var drawnCard = owner.deck.pop();
                    if (owner.hand.length < 10) {
                        owner.hand.push(drawnCard);
                        addCombatLogMessage(newState, `<span class="${previousPlayer === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Mystic Chronicler</span> <span class="draw">drew a card</span>`);
                    } else {
                        addCombatLogMessage(newState, `<span class="${previousPlayer === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Mystic Chronicler</span> <span class="draw">burned a card</span> because their hand was full`);
                    }
                }
            }

            else if (effect.type === 'spiritSummoner' && effect.owner === previousPlayer) {
                var owner = newState.players[previousPlayer];
                if (owner.field.length < 7) {
                    const spirit = new UnitCard(
                        `spirit-${Date.now()}-${Math.random()}`,
                        'Spirit',
                        1,
                        1,
                        1,
                        '',
                        'spirit',
                        'rare'
                    );
                    owner.field.push(spirit);
                    addCombatLogMessage(newState, `<span class="${effect.owner === 0 ? 'player-name' : 'enemy-name'}">${owner.username}'s</span> <span class="spell-name">Spirit Summoner</span> summoned a <span class="spell-name">Spirit</span>`);
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

    if (previousPlayerState.maxMana === 1) {
        const handOfFateIndex = previousPlayerState.hand.findIndex(card => card.name === 'Hand of Fate');
        if (handOfFateIndex !== -1) {
            previousPlayerState.hand.splice(handOfFateIndex, 1);
                  // Vytvoříme a přidáme Fate Token
                  const fateToken = new SpellCard(
                    `fateToken-${Date.now()}`,
                    'Fate Token',
                    99,
                    'Unplayable. At the start of your next turn, draw a random card from your deck.',
                    'fateToken',
                    'legendary'
                );
                previousPlayerState.hand.push(fateToken);
                addCombatLogMessage(newState, `<span class="${nextPlayer === 0 ? 'player-name' : 'enemy-name'}">${previousPlayerState.username}'s</span> <span class="spell-name">Hand of Fate</span> was transformed into a <span class="spell-name">Fate Token</span>`);
        }
    }

        // Kontrola a zpracování Fate Token
        const fateTokenIndex = player.hand.findIndex(card => card.name === 'Fate Token');
        if (fateTokenIndex !== -1) {
            // Odstraníme Fate Token
            player.hand.splice(fateTokenIndex, 1);
            
            // Přidáme náhodnou kartu z balíčku
            if (player.deck.length > 0) {
                var randomIndex = Math.floor(Math.random() * player.deck.length);
                const bonusCard = player.deck.splice(randomIndex, 1)[0];
                player.hand.push(bonusCard);
                addCombatLogMessage(newState, `<span class="${nextPlayer === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Fate Token</span> granted them a random card from their deck`);
            }
        }


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
function handleUnitDamage(unit, damage, opponent, playerIndex, newState,ingoreDivineShield = false) {
    if (!unit) return;
    var afterEffectFunc = null;

    const oldHealth = unit.health;
    const hadDivineShield = unit.hasDivineShield;

    if (unit.hasDivineShield && !ingoreDivineShield) {
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
            var drawnCard = opponent.deck.pop();
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
                var drawnCard = opponent.deck.pop();
                opponent.hand.push(drawnCard);
                addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Death Prophet</span> <span class="draw">drew a card</span> on death`);
            }
        }

        // Ice Revenant efekt
        if (unit.name === 'Ice Revenant') {
            const enemyPlayer = newState.players[playerIndex];
            var availableTargets = enemyPlayer.field.filter(unit => unit && unit.health > 0);
            
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

        // Přidáme efekt pro Arcane Summoner
        if (unit.name === 'Arcane Summoner') {
            const player = newState.players[1 - playerIndex];
            for (let i = 0; i < 2; i++) {
                const arcaneWisp = new UnitCard(
                    `wisp-${Date.now()}-${i}`,
                    'Arcane Wisp',
                    1,
                    1,
                    1,
                    'When this minion dies, add a copy of The Coin to your hand',
                    'arcaneWisp',
                    'uncommon'
                );
                // Vložíme Arcane Wisp na náhodnou pozici v balíčku
                const randomIndex = Math.floor(Math.random() * (player.deck.length + 1));
                player.deck.splice(randomIndex, 0, arcaneWisp);
            }
            addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Arcane Summoner</span> shuffled two <span class="spell-name">Arcane Wisps</span> into their deck`);
        }

        // Přidáme efekt pro Eternal Wanderer
        if (unit.name === 'Eternal Wanderer') {
            const player = newState.players[1 - playerIndex];
            if (player.hand.length < 10) {
                const wanderer = new UnitCard(
                    `wanderer-${Date.now()}`,
                    'Eternal Wanderer',
                    6,
                    5,
                    5,
                    'Cannot attack the turn it is played. When this minion dies, return it to your hand',
                    'eternalWanderer',
                    'epic'
                );
                player.hand.push(wanderer);
                addCombatLogMessage(newState, `<span class="${(1 - playerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Eternal Wanderer</span> returned to their hand`);
            }
        }

        // Frost Spirit efekt
        if (unit.name === 'Frost Spirit') {
            const enemyPlayer = newState.players[playerIndex];
            var availableTargets = enemyPlayer.field.filter(target => target && target.health > 0);
            if (availableTargets.length > 0) {
                var randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                randomTarget.frozen = true;
                randomTarget.frozenLastTurn = false;
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${unit.name}</span> <span class="freeze">froze</span> enemy <span class="spell-name">${randomTarget.name}</span>`);
            }
        }

        // Bee Guardian efekt
        if (unit.name === 'Bee Guardian') {
            const enemyPlayer = newState.players[playerIndex];
            if (enemyPlayer.deck.length > 0 && enemyPlayer.hand.length < 10) {
                var drawnCard = enemyPlayer.deck.pop();
                enemyPlayer.hand.push(drawnCard);
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'enemy-name' : 'player-name'}">${opponent.username}</span> drew a card from <span class="spell-name">Bee Guardian's</span> death effect`);
            }
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

    // Přidáme efekt Arcane Berserker
    player.field.forEach(unit => {
        if (unit.name === 'Arcane Berserker') {
            unit.attack += 2;
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}'s</span> <span class="spell-name">Arcane Berserker</span> gained <span class="attack">+2 attack</span>`);
        }
    });

    // Přidáme efekt Runic Warden
    player.field.forEach(unit => {
        if (unit.name === 'Runic Warden') {
            unit.health += 2;
            unit.maxHealth += 2;
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}'s</span> <span class="spell-name">Runic Warden</span> gained <span class="health">+2 health</span>`);
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

        case 'Hellfire':
            opponent.hero.health = Math.max(0, opponent.hero.health - 10);
            newState.notification = {
                message: `Hellfire dealt 6 damage to the ${opponentName}'s hero!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Hellfire</span> dealing <span class="damage">10 damage</span> to ${opponentName}'s hero`);
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
            var healAmount = player.hero.health - oldHealth;

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

        case 'Mana Fusion':
            player.mana = Math.min(player.mana + 2, 10);
            player.overloadedMana = (player.overloadedMana || 0) + 2;
            addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> gained <span class="mana">2 temporary mana</span> but will be overloaded next turn`);
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
            
            // Vybereme náhodnou kartu z ruky protivníka, která není Hand of Fate ani Fate Token
            var validCardsToCopy = opponent.hand.filter(card => 
                card.name !== 'Hand of Fate' && card.name !== 'Fate Token'
            );
            
            var randomIndexToCopy = Math.floor(Math.random() * validCardsToCopy.length);
            const cardToCopy = validCardsToCopy[randomIndexToCopy];

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
                    ) : cardToCopy instanceof SpellCard ?
                    new SpellCard(
                        `copy-${Date.now()}-${Math.random()}`,
                        cardToCopy.name,
                        cardToCopy.manaCost,
                        cardToCopy.effect,
                        cardToCopy.image,
                        cardToCopy.rarity
                    ) : new SecretCard(
                        `copy-${Date.now()}-${Math.random()}`,
                        cardToCopy.name,
                        cardToCopy.manaCost,
                        cardToCopy.effect,
                        cardToCopy.image,
                        cardToCopy.rarity,
                        cardToCopy.triggerType
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
            
            var randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
            var afterEffectFunc = handleUnitDamage(randomTarget, 3, opponent, playerIndex, newState);
            if (afterEffectFunc) afterEffectFunc();
            
            randomTarget.frozen = true;
            randomTarget.frozenLastTurn = false;
            randomTarget.canAttack = false;
            
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Frostbolt</span> dealing <span class="damage">3 damage</span> and <span class="freeze">freezing</span> <span class="spell-name">${randomTarget.name}</span>`);
            break;

        case 'Polymorph Wave':
            // Transformujeme všechny jednotky na obou stranách pole
            [...player.field, ...opponent.field].forEach((unit, index) => {
                if (unit) {
                    const isDuck = new UnitCard(
                        `duck-${Date.now()}-${index}`,
                        'Duck',
                        1,
                        1,
                        1,
                        'Quack! I used to be something more majestic...',
                        'duck',
                        'common'
                    );
                    if (index < player.field.length) {
                        player.field[index] = isDuck;
                    } else {
                        opponent.field[index - player.field.length] = isDuck;
                    }
                }
            });
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Polymorph Wave</span> transforming all minions into Ducks`);
            break;

        case 'Holy Strike':
            var validTargets = opponent.field.filter(unit => unit !== null);
            if (validTargets.length > 0) {
                var randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
                var afterEffectFunc = handleUnitDamage(randomTarget, 2, opponent, playerIndex, newState);
                if (afterEffectFunc) afterEffectFunc();
                
                // Léčení hrdiny
                var healAmount = 2;
                player.hero.health = Math.min(30, player.hero.health + healAmount);
                
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Holy Strike</span> dealing <span class="damage">2 damage</span> to <span class="spell-name">${randomTarget.name}</span> and restoring <span class="heal">2 health</span>`);
            } else {
                // Pokud nejsou cíle, stále vyléčíme hrdinu
                player.hero.health = Math.min(30, player.hero.health + 2);
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Holy Strike</span> restoring <span class="heal">2 health</span>`);
            }
            break;

        case 'Battle Cry':
            let buffedUnits = 0;
            player.field.forEach(unit => {
                if (unit) {
                    unit.attack += 1;
                    if (unit.baseAttack !== undefined) {
                        unit.baseAttack += 1;
                    }
                    buffedUnits++;
                }
            });
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Battle Cry</span> giving <span class="buff">+1 Attack</span> to ${buffedUnits} minions`);
            break;

        case 'Soothing Return':
            var validTargets = opponent.field.filter(unit => unit !== null);
            if (validTargets.length > 0) {
                var randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
                // Vrátíme kartu do ruky
                if (opponent.hand.length < 10) {
                    opponent.hand.push(randomTarget);
                    // Odstraníme kartu z pole
                    opponent.field = opponent.field.filter(unit => unit.id !== randomTarget.id);
                    // Vyléčíme hrdinu
                    player.hero.health = Math.min(30, player.hero.health + 3);
                    
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Soothing Return</span>, returning <span class="spell-name">${randomTarget.name}</span> to hand and restoring <span class="heal">3 health</span>`);
                }
            }
            break;

        case 'Death Touch':
            var validTargets = opponent.field.filter(unit => unit !== null);
            if (validTargets.length > 0) {
                var randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
                // Odstraníme kartu z pole
                var afterEffectFunc = handleUnitDamage(randomTarget, randomTarget.health, opponent, playerIndex, newState,true);
                if (afterEffectFunc) afterEffectFunc();             
                
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Death Touch</span>, destroying <span class="spell-name">${randomTarget.name}</span>`);
            }
            break;

        case 'Unity Strike':
            var friendlyMinions = player.field.filter(unit => unit !== null).length;
            var damage = friendlyMinions;
            opponent.hero.health = Math.max(0, opponent.hero.health - damage);
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Unity Strike</span> dealing <span class="damage">${damage} damage</span> based on friendly minions`);
            break;

        case 'Source Healing':
            var totalMinions = player.field.filter(unit => unit !== null).length + 
                               opponent.field.filter(unit => unit !== null).length;
            var healAmount = totalMinions;
            player.hero.health = Math.min(30, player.hero.health + healAmount);
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Source Healing</span> restoring <span class="heal">${healAmount} health</span> based on total minions`);
            break;

        case 'Mystic Reversal':
            let swappedUnits = 0;
            let destroyedUnits = [];
            
            // Projdeme všechny přátelské jednotky a prohodíme jim útok a zdraví
            player.field.forEach((unit, index) => {
                if (unit) {
                    const tempAttack = unit.attack;
                    const tempHealth = unit.health;
                    
                    // Prohodíme hodnoty
                    unit.attack = tempHealth;
                    unit.health = tempAttack;
                    unit.maxHealth = tempAttack;
                    
                    swappedUnits++;
                    
                    // Pokud má jednotka po prohození 0 nebo méně zdraví, označíme ji ke zničení
                    if (unit.health <= 0) {
                        destroyedUnits.push({unit, index});
                    }
                }
            });
            
            // Zničíme jednotky s 0 nebo méně zdraví
            destroyedUnits.forEach(({unit}) => {
                addCombatLogMessage(newState, `<span class="spell-name">${unit.name}</span> was destroyed after stat swap`);
            });
            
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Mystic Reversal</span> swapping attack and health of ${swappedUnits} friendly minions`);
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
                    card.manaCost = Math.max(1, 30 - newState.deadMinionsCount);
                }
            });
            // V balíčku
            p.deck.forEach(card => {
                if (card.name === 'Ancient Colossus') {
                    card.manaCost = Math.max(1, 30 - newState.deadMinionsCount);
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

        case 'Overloading Giant':
            player.overloadedMana = (player.overloadedMana || 0) + 2;
            addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> will be overloaded by <span class="mana">2</span> next turn`);
            break;

        case 'Swift Guardian':
            card.hasDivineShield = true;
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

        case 'Celestial Healer':
            player.hero.health = Math.min(30, player.hero.health + 10);
            newState.notification = {
                message: 'Celestial Healer restored 10 health to your hero!',
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Celestial Healer</span> restoring <span class="heal">10 health</span> to their hero`);
            break;

        case 'Arcane Scholar':
            const arcaneScholarSpells = player.deck.filter(card => card.type === 'spell');
            if (arcaneScholarSpells.length > 0) {
                const randomSpell = arcaneScholarSpells[Math.floor(Math.random() * arcaneScholarSpells.length)];
                const spellIndex = player.deck.indexOf(randomSpell);
                player.deck.splice(spellIndex, 1);
                if (player.hand.length < 10) {
                    player.hand.push(randomSpell);
                    newState.notification = {
                        message: `Drew ${randomSpell.name}!`,
                        forPlayer: playerIndex
                    };
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Arcane Scholar</span> and <span class="draw">drew a random spell</span>`);
                }
            }
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
            var healAmount = 2;
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

            case 'Sneaky Infiltrator':
                    // Efekt se zpracuje v combat logice
                    break;
        
            case 'Silence Assassin':
                    // Nastavíme, že nemůže útočit v tomto kole
                    card.hasTaunt = false;
                    card.hasAttacked = true;
                    card.canAttack = false;
                    break;          

        case 'Frost Warden':
            var availableTargets = opponent.field.filter(unit => unit);
            if (availableTargets.length > 0) {
                const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                randomTarget.frozen = true;
                randomTarget.frozenLastTurn = false;
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Frost Warden</span> <span class="freeze">froze</span> enemy <span class="spell-name">${randomTarget.name}</span>`);
            }
            break;

        case 'Chaos Lord':
            if (player.hand.length > 0) {
                const randomIndex = Math.floor(Math.random() * player.hand.length);
                const discardedCard = player.hand.splice(randomIndex, 1)[0];
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Chaos Lord</span> discarded <span class="spell-name">${discardedCard.name}</span>`);
            }
            break;

        case 'Blood Knight':
            player.hero.health = Math.max(0, player.hero.health - 2);
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Blood Knight</span> dealt <span class="damage">2 damage</span> to their hero`);
            break;
            
        case 'Desperate Scout':
            // Poškození vlastního hrdiny
            player.hero.health = Math.max(0, player.hero.health - 1);

            // Líznutí karty
            if (player.deck.length > 0) {
                const drawnCard = player.deck.pop();
                if (player.hand.length < 10) {
                    player.hand.push(drawnCard);
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Desperate Scout</span> <span class="draw">drew a card</span>`);
                } else {
                    addCombatLogMessage(newState, `<span class="spell-name">${drawnCard.name}</span> was burned because hand was full`);
                }
            }

            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Desperate Scout</span> dealt <span class="damage">1 damage</span> to their hero`);
            break;

        case 'Healing Sentinel':
            var healAmount = 4;
            player.hero.health = Math.min(30, player.hero.health + healAmount);
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Healing Sentinel</span> restoring <span class="heal">${healAmount} health</span> to their hero`);
            break;

        case 'Legion Commander':
            const emptySpaces = 7 - player.field.length;
            for (let i = 0; i < emptySpaces; i++) {
                const recruit = new UnitCard(
                    `recruit-${Date.now()}-${i}`,
                    'Recruit',
                    1,
                    1,
                    1,
                    '',
                    'recruit',
                    'common'
                );
                recruit.hasAttacked = true;
                recruit.canAttack = false;
                player.field.push(recruit);
            }
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Legion Commander</span> summoning ${emptySpaces} <span class="spell-name">Recruits</span>`);
            break;

        case 'Mind Mimic':
            if (opponent.hand.length > 0) {
                const randomIndex = Math.floor(Math.random() * opponent.hand.length);
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
                        ) : cardToCopy instanceof SpellCard ?
                        new SpellCard(
                            `copy-${Date.now()}-${Math.random()}`,
                            cardToCopy.name,
                            cardToCopy.manaCost,
                            cardToCopy.effect,
                            cardToCopy.image,
                            cardToCopy.rarity
                        ) : new SecretCard(
                            `copy-${Date.now()}-${Math.random()}`,
                            cardToCopy.name,
                            cardToCopy.manaCost,
                            cardToCopy.effect,
                            cardToCopy.image,
                            cardToCopy.rarity,
                            cardToCopy.triggerType
                        );
                    player.hand.push(copiedCard);
                    addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> played <span class="spell-name">Mind Mimic</span> copying a card from opponent's hand`);
                }
            }
            break;

        case 'Eternal Wanderer':
            // Nastavíme, že nemůže útočit v tomto kole
            card.hasAttacked = true;
            card.canAttack = false;
            break;

        case 'Rune Defender':
            if (player.hero.health === 30) {
                card.hasTaunt = true;
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}'s</span> <span class="spell-name">Rune Defender</span> gained <span class="buff">Taunt</span>`);
            }
            else {card.hasTaunt = false;}
            break;

        // Growing Guardian - přidání efektu na konci kola
        case 'Zoxus':
            card.hasDivineShield = true;
            break;

        // Merciful Protector - obnovení HP nepříteli při vyložení
        case 'Merciful Protector':
            card.hasDivineShield = true;
            opponent.hero.health = Math.min(30, opponent.hero.health + 5);
            addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Merciful Protector</span> restored <span class="heal">5 health</span> to enemy hero`);
            break;

        // Mana Benefactor - přidání many nepříteli v příštím kole
        case 'Mana Benefactor':
            opponent.nextTurnExtraMana = (opponent.nextTurnExtraMana || 0) + 1;
            addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Mana Benefactor</span> will grant enemy <span class="mana">1 extra mana crystal</span> next turn`);
            break;

        // Tactical Scout - Draw a card when played if your hero has more health than opponent's hero
        case 'Tactical Scout':
            if (player.hero.health > opponent.hero.health && player.deck.length > 0 ) {
                var drawnCard = player.deck.pop();
                if (player.hand.length < 10) {
                    player.hand.push(drawnCard);
                    addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Tactical Scout</span> <span class="draw">drew a card</span>`);
                } else {
                    addCombatLogMessage(newState, `<span class="spell-name">${drawnCard.name}</span> was burned because hand was full`);
                }
            }
            break;

        // Frost Harvester - Gain +1/+1 for each frozen enemy minion
        case 'Frost Harvester':
            const frozenCount = opponent.field.filter(unit => unit && unit.frozen).length;
            if (frozenCount > 0) {
                card.attack += frozenCount;
                card.health += frozenCount;
                card.maxHealth = card.health;
                addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Frost Harvester</span> gained <span class="buff">+${frozenCount}/+${frozenCount}</span>`);
            }
            break;

        // Taunt Collector - Remove Taunt from all other minions and gain +1 Health for each
        case 'Taunt Collector':
            let tauntCount = 0;
            
            // Počítáme a odebíráme Taunt z vlastních minionů
            player.field.forEach(unit => {
                if (unit && unit.hasTaunt && unit.id !== card.id) {
                    unit.hasTaunt = false;
                    tauntCount++;
                }
            });
            
            // Počítáme a odebíráme Taunt z nepřátelských minionů
            opponent.field.forEach(unit => {
                if (unit && unit.hasTaunt) {
                    unit.hasTaunt = false;
                    tauntCount++;
                }
            });

            if (tauntCount > 0) {
                card.health += tauntCount;
                addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Taunt Collector</span> removed <span class="buff">${tauntCount} Taunts</span> and gained <span class="buff">+${tauntCount} Health</span>`);
            }
            break;

        // Dark Scholar efekt
        case 'Dark Scholar':
            player.hero.health = Math.max(0, player.hero.health - 2);
            if (player.deck.length > 0) {
                const drawnCard = player.deck.pop();
                if (player.hand.length < 10) {
                    player.hand.push(drawnCard);
                    addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Dark Scholar</span> dealt <span class="damage">2 damage</span> to their hero and <span class="draw">drew a card</span>`);
                }
                else {
                    addCombatLogMessage(newState, `<span class="spell-name">${drawnCard.name}</span> was burned because hand was full`);
                }
            }
            break;

        // Vigilant Guard efekt
        case 'Vigilant Guard':
            if (player.deck.length > 0) {
                const drawnCard = player.deck.pop();
                if (player.hand.length < 10) {
                    player.hand.push(drawnCard);
                    addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Vigilant Guard</span> <span class="draw">drew a card</span>`);
                }
                else {
                    addCombatLogMessage(newState, `<span class="spell-name">${drawnCard.name}</span> was burned because hand was full`);
                }
            }
            break;

        // Lone Protector efekt
        case 'Lone Protector':
            const totalMinions = player.field.filter(unit => unit && unit.id !== card.id).length +
                opponent.field.filter(unit => unit).length;

            if (totalMinions === 0) {
                card.hasDivineShield = true;
                card.hasTaunt = true;
                addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Lone Protector</span> gained <span class="buff">Divine Shield</span> and <span class="buff">Taunt</span>`);
            }
            else {
                card.hasDivineShield = false;
                card.hasTaunt = false;
            }
            break;
               // Wisdom Seeker efekt
            case 'Wisdom Seeker':
            if (player.hero.health === 30) {
                card.hasTaunt = false
                if (player.deck.length > 0) {
                    const drawnCard = player.deck.pop();
                    if (player.hand.length < 10) {
                        player.hand.push(drawnCard);
                        addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Wisdom Seeker</span> <span class="draw">drew a card</span>`);
                    } else {
                        addCombatLogMessage(state, `<span class="spell-name">${drawnCard.name}</span> was burned because hand was full`);
                    }
                }
            } else {
                card.hasTaunt = true;
                addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Wisdom Seeker</span> gained <span class="buff">Taunt</span>`);
            }
            break;
            
            // Echo Warrior efekt
            case 'Echo Warrior':
            const echoWarriorCopy = { ...card };
            echoWarriorCopy.id = `echo-${Date.now()}-${Math.random()}`;
            const randomIndex = Math.floor(Math.random() * (player.deck.length + 1));
            player.deck.splice(randomIndex, 0, echoWarriorCopy);
            addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Echo Warrior</span> shuffled a copy of itself into their deck`);
            break;

        // Chaos Imp efekt
        case 'Chaos Imp':
            if (player.hand.length > 0) {
                const randomCardIndex = Math.floor(Math.random() * player.hand.length);
                const destroyedCard = player.hand.splice(randomCardIndex, 1)[0];
                addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Chaos Imp</span> destroyed <span class="spell-name">${destroyedCard.name}</span> from their hand`);
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

    // Speciální logika pro Hand of Fate
    if (card.name === 'Hand of Fate') {    
        
        // Odstraníme kartu z ruky
        player.hand.splice(cardIndex, 1);
        
        // Aplikujeme efekt
        return handleHandOfFate(state, playerIndex);
    }
    // Pokud hráč zahrál jinou kartu než Hand of Fate ve svém prvním tahu,
    // odstraníme Hand of Fate z jeho ruky a přidáme Fate Token
    else if (player.maxMana === 1) {
        const handOfFateIndex = player.hand.findIndex(c => c.name === 'Hand of Fate');
        if (handOfFateIndex !== -1) {
            player.hand.splice(handOfFateIndex, 1);
            addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Hand of Fate</span> was transformed into a <span class="spell-name">Fate Token</span>`);
            const fateToken = new SpellCard(
                `fateToken-${Date.now()}`,
                'Fate Token',
                99,
                'At the start of your next turn, draw a random card from your deck.',
                'fateToken',
                'legendary'
            );
            player.hand.push(fateToken);
        }
    } 

    if (!card || player.mana < card.manaCost) {
        return {
            ...newState,
            notification: {
                message: 'Not enough mana!',
                forPlayer: playerIndex
            }
        };
    }

     // Přidáme novou logiku pro tajné karty
     if (card.type === 'secret') {
        // Kontrola, zda již nemáme aktivní tajnou kartu stejného jména
        if (player.secrets.some(secret => secret.name === card.name && !secret.isRevealed)) {
            return {
                ...newState,
                notification: {
                    message: 'You already have this secret active!',
                    forPlayer: playerIndex
                }
            };
        }

        // Odečteme manu a přidáme kartu do secrets
        player.mana -= card.manaCost;
        player.hand.splice(cardIndex, 1);
        player.secrets.push(card);

        // Přidáme log zprávu
        addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> played a <span class="spell-name">Secret</span>`);

        return newState;
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

        let {updatedState, shouldContinue} = checkAndActivateSecrets(newState, 'unit_played', {
            playerIndex,
            cardIndex,
            card
        });

        if (!shouldContinue) {
            return updatedState;
        }

        // Aplikujeme efekty jednotky při vyložení
        const stateWithEffects = handleUnitEffects(card, player, opponent, updatedState, playerIndex);
        
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

        let {updatedState, shouldContinue} = checkAndActivateSecrets(newState, 'spell_played', {
            playerIndex,
            cardIndex,
            card
        });

        if (!shouldContinue) {
            return updatedState;
        }

        // Aplikujeme efekt kouzla
        const spellResult = handleSpellEffects(card, player, opponent, updatedState, playerIndex);

        // Po úspěšném seslání kouzla aplikujeme efekt Spirit Healera
        if (spellResult !== false && spiritHealers.length > 0) {
            var healAmount = 2 * spiritHealers.length;
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
        case 6: // Frost Mage
            const availableMinionsFrost = opponent.field.filter(unit => unit);
            if (availableMinionsFrost.length > 0) {
                const randomMinion = availableMinionsFrost[Math.floor(Math.random() * availableMinionsFrost.length)];
                randomMinion.frozen = true;
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Frost Nova</span> freezing <span class="spell-name">${randomMinion.name}</span>`);
            } else {
                addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Frost Nova</span> but had no valid targets`);
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

function handleHandOfFate(state, playerIndex) {
    const player = state.players[playerIndex];
    
    // Uložíme si The Coin karty
    const coinCards = player.hand.filter(card => card.name === 'The Coin');
    
    // Vrátíme všechny ostatní karty do balíčku
    const nonCoinCards = player.hand.filter(card => card.name !== 'The Coin');
    const cardCount = nonCoinCards.length;
    player.deck.push(...nonCoinCards);
    
    // Zamícháme balíček
    for (let i = player.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
    }
    
    // Vyprázdníme ruku a vrátíme The Coin
    player.hand = [...coinCards];
    
    // Doberte nové karty
    const cardsToDraw = Math.min(cardCount, player.deck.length);
    for (let i = 0; i < cardsToDraw; i++) {
        player.hand.push(player.deck.pop());
    }
    
    addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}</span> used <span class="spell-name">Hand of Fate</span> to shuffle their hand back into their deck and draw new cards`);
    
    return state;
}

// Exportujeme novou funkci
module.exports = {
    startNextTurn,
    checkGameOver,
    playCardCommon,
    handleSpellEffects,
    handleUnitEffects,
    addCombatLogMessage,
    useHeroAbility,
    checkAndActivateSecrets,  // Přidáme čárku
    updateAncientColossusManaCost  // Přidáme export
};

// Přidám novou funkci pro kontrolu a aktivaci tajných karet
function checkAndActivateSecrets(state, triggerType, data) {
    const newState = { ...state };
    const { playerIndex, cardIndex } = data;
    const opponentIndex = 1 - playerIndex;
    const opponent = newState.players[opponentIndex];
    const player = newState.players[playerIndex];

    var shouldContinue = true;
    var attackerIsDead = false;
    
    // Najdeme tajné karty protihráče podle typu triggeru, ale aktivujeme jen jednu
    const potentialSecrets = opponent.secrets.filter(
        secret => !secret.isRevealed && secret.triggerType === triggerType
    );
    
    if (potentialSecrets.length === 0) {
        return {updatedState: newState, shouldContinue: shouldContinue};
    }

    // Filtrujeme secrets podle všech podmínek (nejen triggerType)
    const matchingSecrets = [];
    
    for (const secret of potentialSecrets) {
        let meetsAllConditions = true;
        
        // Kontrola specifických podmínek pro jednotlivé karty
        switch (secret.name) {
            case 'Soul Guardian':
                // Secret se aktivuje pouze když má hrdina méně než 10 životů
                if (triggerType === 'hero_attack' && opponent.hero.health >= 10) {
                    meetsAllConditions = false;
                }
                break;
            // Zde můžeme přidat další specifické podmínky pro jiné karty
            // case 'OtherSecret':
            //     if (someCondition) {
            //         meetsAllConditions = false;
            //     }
            //     break;
        }
        
        if (meetsAllConditions) {
            matchingSecrets.push(secret);
        }
    }
    
    if (matchingSecrets.length === 0) {
        return {updatedState: newState, shouldContinue: shouldContinue};
    }
    
    // Aktivujeme pouze první odpovídající tajnou kartu (FIFO)
    const secret = matchingSecrets[0];
    secret.isRevealed = true;
    
    // Přidáme log zprávu o odhalení tajné karty
    addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Secret</span> was revealed: <span class="spell-name">${secret.name}</span>!`);
    
    // Přidáme animaci pro aktivaci secret karty
    newState.secretAnimation = {
        type: 'secretActivation',
        secret: { ...secret },
        owner: opponentIndex  // Nastavíme správně vlastníka jako opponentIndex
    };
    
    // Aplikujeme efekt tajné karty podle jejího jména
    switch (secret.name) {
        case 'Counterspell':
            if (triggerType === 'spell_played') {
                // Pokud je to kouzlo, zrušíme jeho efekt
                addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Counterspell</span> negated the spell!`);
                shouldContinue = false;
                player.hand.splice(cardIndex, 1);
                // Přidáme notifikaci
                newState.notification = {
                    message: 'Your spell was countered!',
                    forPlayer: playerIndex
                };
            }
            break;
            
        case 'Explosive Trap':
            if (triggerType === 'hero_attack') {
                // Pokud někdo zaútočí na hrdinu, způsobíme 2 poškození všem nepřátelským jednotkám
                // Způsobíme 2 poškození hrdinovi
                player.hero.health = Math.max(0, player.hero.health - 2);
                
                var afterEffectFuncs = [];
                player.field.forEach(unit => {
                    var afterEffectFunc = handleUnitDamage(unit, 2, player, 1 - playerIndex, newState);
                    if (afterEffectFunc) {
                        afterEffectFuncs.push(afterEffectFunc);
                    }
                });
                afterEffectFuncs.forEach(func => func());
                
                addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Explosive Trap</span> dealt <span class="damage">2 damage</span> to enemy hero and all enemy minions`);
                
                if (player.field[data.attackerIndex] && player.field[data.attackerIndex].health <= 0) {
                    attackerIsDead = true;
                }
                // Před odstraněním mrtvých jednotek spočítáme jejich počet
                newState.players.forEach(player => {
                    const deadUnits = player.field.filter(unit => unit && unit.health <= 0).length;
                    newState.deadMinionsCount = (newState.deadMinionsCount || 0) + deadUnits;

                    // Aktualizujeme cenu Ancient Colossus ve všech místech
                    updateAncientColossusManaCost(newState);

                    // Odstraníme mrtvé jednotky
                    player.field = player.field.filter(card => card.health > 0);
                });
            }
            break;
            
        case 'Ambush':
            if (triggerType === 'unit_played') {
                // Pokud protihráč zahraje jednotku, přidáme na pole 2/1 jednotku s Stealth
                if (opponent.field.length < 7) {
                    const { UnitCard } = require('./CardClasses');
                    const ambusher = new UnitCard(
                        `ambusher-${Date.now()}`,
                        'Ambusher',
                        0,
                        3,
                        2,
                        'Taunt',
                        'ambusher',
                        'rare'
                    );
                    ambusher.hasTaunt = true;
                    // Přidáme jednotku na pole
                    opponent.field.push(ambusher);
                    
                    addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Ambush</span> summoned a <span class="spell-name">3/2 Ambusher</span>`);
                } else {
                    addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Ambush</span> failed to summon a minion - board is full`);
                }
            }
            break;

        case 'Soul Guardian':
            if (triggerType === 'hero_attack') {
                // Pokud někdo zaútočí na hrdinu a hrdina má méně jak 10 životů, obnoví se mu 10 životů
                // Tuto podmínku jsme již ověřili, takže víme, že opponent.hero.health < 10
                const oldHealth = opponent.hero.health;
                opponent.hero.health = Math.min(30, opponent.hero.health + 10);
                const healAmount = opponent.hero.health - oldHealth;
                
                addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Soul Guardian</span> restored <span class="heal">${healAmount} health</span> to their hero`);
            }
            break;

        case 'Phantom Mirage':
            if (triggerType === 'unit_played') {
                const playedUnit = player.field[player.field.length - 1];
                if (playedUnit) {
                    // Přemístíme jednotku na pole protihráče a označíme ji pro návrat zpět
                    const unitIndex = player.field.indexOf(playedUnit);
                    if (unitIndex !== -1 && opponent.field.length < 7) {
                        const stolenUnit = player.field.splice(unitIndex, 1)[0];
                        stolenUnit.temporaryOwnerChange = true;
                        stolenUnit.originalOwner = playerIndex;
                        stolenUnit.turnsUntilReturn = 2; // Vrátí se za 1 kolo
                        opponent.field.push(stolenUnit);
                        
                        addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Phantom Mirage</span> took control of <span class="spell-name">${stolenUnit.name}</span> until the end of their next turn`);
                    } else {
                        addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Phantom Mirage</span> failed to take control - board is full`);
                    }
                }
            }
            break;

        case 'Spell Reflector':
            if (triggerType === 'spell_played') {
                // Způsobíme 3 poškození hrdinovi, který zahrál kouzlo, a táhneme kartu
                player.hero.health = Math.max(0, player.hero.health - 3);
                
                // Táhneme kartu pro majitele tajné karty
                if (opponent.deck.length > 0) {
                    const drawnCard = opponent.deck.shift();
                    if (opponent.hand.length < 10) {
                        opponent.hand.push(drawnCard);
                        addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}</span> drew a card`);
                    } else {
                        addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}</span> burned a card - hand is full`);
                    }
                }
                
                addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">Spell Reflector</span> dealt <span class="damage">3 damage</span> to the enemy hero and drew a card`);
            }
            break;
            
        default:
            addCombatLogMessage(newState, `<span class="${opponentIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}'s</span> <span class="spell-name">${secret.name}</span> was activated`);
            break;
    }
    
    // Odstraníme tajnou kartu po aktivaci
    const secretIndex = opponent.secrets.findIndex(s => s.id === secret.id);
    if (secretIndex !== -1) {
        opponent.secrets.splice(secretIndex, 1);
    }
    
    return {updatedState: checkGameOver(newState), shouldContinue: shouldContinue,attackerIsDead: attackerIsDead};
}

/**
 * Aktualizuje mana cost karty Ancient Colossus ve všech místech (ruce a balíčky všech hráčů)
 * na základě počtu mrtvých jednotek
 * @param {Object} state - Herní stav
 */
function updateAncientColossusManaCost(state) {
    state.players.forEach(p => {
        // V ruce
        p.hand.forEach(card => {
            if (card.name === 'Ancient Colossus') {
                card.manaCost = Math.max(1, 30 - state.deadMinionsCount);
            }
        });
        // V balíčku
        p.deck.forEach(card => {
            if (card.name === 'Ancient Colossus') {
                card.manaCost = Math.max(1, 30 - state.deadMinionsCount);
            }
        });
    });
}
