const { UnitCard, SpellCard } = require('./CardClasses');

function startNextTurn(state, nextPlayer) {
    const newState = { ...state };
    newState.currentPlayer = nextPlayer;
    
    const player = newState.players[nextPlayer];
    player.maxMana = Math.min(10, player.maxMana + 1);
    player.mana = player.maxMana;

    // Reset útoků jednotek a kontrola zmražení
    player.field.forEach(card => {
        card.hasAttacked = false;
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
        }
    }

    newState.combatLogMessage = {
        message: `<span class="${nextPlayer === 0 ? 'player-name' : 'enemy-name'}">${nextPlayer === 0 ? 'Player' : 'Enemy'}'s</span> turn begins`,
        timestamp: Date.now()
    };

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

        // Deaktivujeme všechny karty
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
    
    // Přidáme efekt Arcane Familiar před zpracováním kouzla
    player.field.forEach(unit => {
        if (unit.name === 'Arcane Familiar') {
            unit.attack += 1;
            console.log('Arcane Familiar posílen:', {
                unitName: unit.name,
                newAttack: unit.attack
            });
            // Přidáme notifikaci o posílení
            if (!newState.notification) {
                newState.notification = {
                    message: 'Arcane Familiar gained +1 attack!',
                    forPlayer: playerIndex
                };
            }
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
                message: `Fireball dealt 6 damage to the enemy hero!`,
                forPlayer: playerIndex
            };
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> cast <span class="spell-name">Fireball</span> dealing <span class="damage">6 damage</span> to enemy hero`,
                timestamp: Date.now()
            };
            break;

        case 'Lightning Bolt':
            opponent.hero.health = Math.max(0, opponent.hero.health - 3);
            newState.notification = {
                message: 'Lightning Bolt dealt 3 damage to the enemy hero!',
                forPlayer: playerIndex
            };
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> cast <span class="spell-name">Lightning Bolt</span> dealing <span class="damage">3 damage</span> to enemy hero`,
                timestamp: Date.now()
            };
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
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> cast <span class="spell-name">Healing Touch</span> restoring <span class="heal">${healAmount} health</span>`,
                timestamp: Date.now()
            };
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
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> cast <span class="spell-name">Glacial Burst</span> and <span class="freeze">froze all enemy units</span>`,
                timestamp: Date.now()
            };
            break;

        case 'Inferno Wave':
            const damagedUnits = opponent.field.filter(unit => unit).length;
            opponent.field.forEach(unit => {
                if (unit) unit.health -= 4;
            });
            newState.notification = {
                message: 'Inferno Wave dealt 4 damage to all enemy units!',
                forPlayer: playerIndex
            };
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> cast <span class="spell-name">Inferno Wave</span> dealing <span class="damage">4 damage</span> to ${damagedUnits} enemy units`,
                timestamp: Date.now()
            };
            break;

        case 'The Coin':
            player.mana = Math.min(player.mana + 1, 10);
            newState.notification = {
                message: 'Gained 1 mana crystal!',
                forPlayer: playerIndex
            };
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> used <span class="spell-name">The Coin</span> and gained <span class="mana">1 mana crystal</span>`,
                timestamp: Date.now()
            };
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
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> cast <span class="spell-name">Arcane Intellect</span> and <span class="draw">drew ${cardsDrawn.length} cards</span>`,
                timestamp: Date.now()
            };
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

    switch (card.name) {
        case 'Fire Elemental':
            opponent.hero.health -= 2;
            newState.notification = {
                message: 'Fire Elemental dealt 2 damage to the enemy hero!',
                forPlayer: playerIndex
            };
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> played <span class="spell-name">Fire Elemental</span> dealing <span class="damage">2 damage</span> to enemy hero`,
                timestamp: Date.now()
            };
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
                newState.combatLogMessage = {
                    message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> played <span class="spell-name">Water Elemental</span> and <span class="freeze">froze</span> enemy <span class="spell-name">${targetUnit.name}</span>`,
                    timestamp: Date.now()
                };
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
                    newState.combatLogMessage = {
                        message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> played <span class="spell-name">Nimble Sprite</span> and <span class="draw">drew a card</span>`,
                        timestamp: Date.now()
                    };
                }
            }
            break;
    }

    return newState;
}

function playCardCommon(state, playerIndex, cardIndex, target = null) {
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

    player.mana -= card.manaCost;
    player.hand.splice(cardIndex, 1);

    if (card instanceof UnitCard) {
        if (player.field.length < 7) {
            card.canAttack = false;
            card.hasAttacked = false;
            player.field.push(card);
            
            // Přidáme log zprávu o vyložení jednotky
            newState.combatLogMessage = {
                message: `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${playerIndex === 0 ? 'Player' : 'Enemy'}</span> played <span class="spell-name">${card.name}</span> (${card.attack}/${card.health})`,
                timestamp: Date.now()
            };
            
            // Aplikujeme efekty jednotky při vyložení
            const stateWithEffects = handleUnitEffects(card, player, opponent, newState, playerIndex);
            return checkGameOver(stateWithEffects);
        }
        return { 
            ...newState, 
            notification: {
                message: 'No space on the field!',
                forPlayer: playerIndex
            }
        };
    } else if (card instanceof SpellCard) {
        card.target = target;
        return handleSpellEffects(card, player, opponent, newState, playerIndex);
    }

    return checkGameOver(newState);
}

module.exports = {
    startNextTurn,
    checkGameOver,
    playCardCommon,
    handleSpellEffects,
    handleUnitEffects
};
