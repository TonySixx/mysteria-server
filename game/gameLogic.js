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

    // Reset útoků jednotek a kontrola zmražení
    player.field.forEach(card => {
        card.hasAttacked = false;
        card.attacksThisTurn = 0;
        card.canAttack = true; // Výchozí hodnota
    });

    // Rozmrazíme jednotky protivníka, které byly zmražené během jeho tahu
    const opponent = newState.players[1 - nextPlayer];
    opponent.field.forEach(card => {
        if (card.frozen && card.frozenLastTurn) {
            card.frozen = false;
            delete card.frozenLastTurn;
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

    // Zpracování end-turn efektů pro předchozího hráče (ten, kdo končí tah)
    if (newState.endTurnEffects) {
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
        });
        newState.endTurnEffects = []; // Vyčistíme efekty po zpracování
    }

    // Zpracování start-turn efektů
    if (newState.startTurnEffects) {
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

function handleSpellEffects(card, player, opponent, state, playerIndex) {
    console.log('Začátek aplikace kouzla:', {
        cardName: card.name,
        playerMana: player.mana,
        playerHealth: player.hero.health,
        opponentHealth: opponent.hero.health
    });

    const newState = { ...state };
    
    // Přidáme efekt Mana Wyrm a Arcane Familiar před zpracováním kouzla
    player.field.forEach(unit => {
        if (unit.name === 'Arcane Familiar' || unit.name === 'Mana Wyrm') {
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

    // Kontrola Spell Breaker efektu
    const spellBreakers = opponent.field.filter(unit => unit.name === 'Spell Breaker');
    if (spellBreakers.length > 0) {
        const extraCost = spellBreakers.length; // Každý Spell Breaker zvyšuje cenu o 1
        const totalCost = card.manaCost + extraCost;
        
        if (player.mana < totalCost) {
            return {
                ...state,
                notification: {
                    message: `Spell costs ${extraCost} more due to enemy Spell Breaker!`,
                    forPlayer: playerIndex
                }
            };
        }
        // Odečteme extra manu za Spell Breaker efekt
        player.mana -= extraCost;
    }

    // Odečteme základní cenu kouzla
    player.mana -= card.manaCost;

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
            opponent.field.forEach(unit => {
                if (unit) {
                    if (unit.hasDivineShield) {
                        unit.hasDivineShield = false;
                    } else {
                        unit.health -= 4;
                    }
                }
            });
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
            const availableTargets = opponent.field.filter(unit => unit !== null);
            
            if (availableTargets.length === 0) {
                newState.notification = {
                    message: 'No enemy minions to control!',
                    forPlayer: playerIndex
                };
                return false;
            }

            // Vybereme náhodnou jednotku
            const randomIndex = Math.floor(Math.random() * availableTargets.length);
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
            opponent.field.forEach(unit => {
                if (unit) {
                    if (unit.hasDivineShield) {
                        unit.hasDivineShield = false;
                    } else {
                        unit.health -= 1;
                    }
                    damagedCount++;
                }
            });
            newState.notification = {
                message: `Dealt 1 damage to ${damagedCount} enemy minions!`,
                forPlayer: playerIndex
            };
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerName}</span> cast <span class="spell-name">Arcane Explosion</span> dealing <span class="damage">1 damage</span> to ${damagedCount} enemy minions`);
            break;

        case 'Holy Nova':
            let healedCount = 0;
            let damagedEnemies = 0;

            // Poškození nepřátel
            opponent.field.forEach(unit => {
                if (unit) {
                    unit.health -= 2;
                    damagedEnemies++;
                }
            });
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
            // Získáme počet zahraných kouzel z historie
            const spellsCast = (state.spellsPlayedThisGame || 0);
            const damage = spellsCast;
            
            console.log('Arcane Storm damage:', {
                spellsPlayed: spellsCast,
                damage: damage
            });
            
            // Poškození všech postav
            player.hero.health = Math.max(0, player.hero.health - damage);
            opponent.hero.health = Math.max(0, opponent.hero.health - damage);
            
            // Upravené zpracování poškození jednotek
            player.field.forEach(unit => {
                if (unit) {
                    if (unit.hasDivineShield) {
                        unit.hasDivineShield = false;
                    } else {
                        unit.health -= damage;
                    }
                }
            });
            
            opponent.field.forEach(unit => {
                if (unit) {
                    if (unit.hasDivineShield) {
                        unit.hasDivineShield = false;
                    } else {
                        unit.health -= damage;
                    }
                }
            });
            
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
    }

    // Odstranění mrtvých jednotek
    newState.players.forEach(player => {
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
            // Inicializujeme pole pro efekty, pokud neexistuje
            if (!newState.endTurnEffects) {
                newState.endTurnEffects = [];
            }
            
            newState.endTurnEffects.push({
                type: 'heal',
                amount: 2,
                owner: playerIndex
            });

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
            const spellsInHand = player.hand.filter(c => c.type === 'spell').length;
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
            // Přidáme efekt do pole efektů na začátku tahu
            if (!newState.startTurnEffects) {
                newState.startTurnEffects = [];
            }
            newState.startTurnEffects.push({
                type: 'mana',
                owner: playerIndex,
                unitId: card.id
            });
            break;

        case 'Mana Siphon':
        case 'Defensive Scout':
            // Efekty se zpracují v combat logice
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

    // Inicializace počítadla kouzel, pokud neexistuje
    if (!newState.spellsPlayedThisGame) {
        newState.spellsPlayedThisGame = 0;
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

        // Zvýšíme počítadlo zahraných kouzel
        newState.spellsPlayedThisGame++;
        console.log(`Zahráno kouzel celkem: ${newState.spellsPlayedThisGame}`);

        // Před aplikací kouzla zkontrolujeme Spirit Healer efekt
        const spiritHealers = player.field.filter(unit => unit.name === 'Spirit Healer');
        
        // Aplikujeme efekt kouzla
        const spellResult = handleSpellEffects(card, player, opponent, newState, playerIndex);
        
        // Po úspěšném seslání kouzla aplikujeme efekt Spirit Healera
        if (spellResult !== false && spiritHealers.length > 0) {
            const healAmount = 2 * spiritHealers.length;
            player.hero.health = Math.min(30, player.hero.health + healAmount);
            
            addCombatLogMessage(newState, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Spirit Healer</span> restored <span class="heal">${healAmount} health</span>`);
        }

        if (spellResult === false) {
            newState.spellsPlayedThisGame = Math.max(0, newState.spellsPlayedThisGame - 1);
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

module.exports = {
    startNextTurn,
    checkGameOver,
    playCardCommon,
    handleSpellEffects,
    handleUnitEffects,
    addCombatLogMessage
};
