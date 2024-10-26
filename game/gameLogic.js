const { UnitCard, SpellCard } = require('./CardClasses');

function startNextTurn(state, nextPlayer) {
    const newState = { ...state };
    newState.currentPlayer = nextPlayer;
    
    const player = newState.players[nextPlayer];
    player.maxMana = Math.min(10, player.maxMana + 1);
    player.mana = player.maxMana;

    // Reset útoků jednotek
    player.field.forEach(card => {
        card.hasAttacked = false;
        card.canAttack = !card.frozen; // Může útočit pouze pokud není zmražená
    });

    // Rozmrazíme jednotky, které byly zmraženy v předchozím kole
    player.field.forEach(card => {
        if (card.frozenLastTurn) {
            card.frozen = false;
            delete card.frozenLastTurn;
        } else if (card.frozen) {
            card.frozenLastTurn = true;
        }
    });

    if (player.deck.length > 0) {
        const drawnCard = player.deck.pop();
        if (player.hand.length < 10) {
            player.hand.push(drawnCard);
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
    
    switch (card.name) {
        case 'Fireball':
            // Fireball nyní působí pouze 6 poškození nepřátelskému hrdinovi
            opponent.hero.health = Math.max(0, opponent.hero.health - 6);
            console.log('Fireball zasáhl hrdinu:', {
                damage: 6,
                newHealth: opponent.hero.health
            });
            newState.notification = {
                message: `Fireball způsobil 6 poškození nepřátelskému hrdinovi!`,
                forPlayer: playerIndex
            };
            break;

        case 'Lightning Bolt':
            // Lightning Bolt nyní působí pouze 3 poškození nepřátelskému hrdinovi
            opponent.hero.health = Math.max(0, opponent.hero.health - 3);
            console.log('Lightning Bolt zasáhl hrdinu:', {
                damage: 3,
                newHealth: opponent.hero.health
            });
            newState.notification = {
                message: 'Lightning Bolt způsobil 3 poškození nepřátelskému hrdinovi!',
                forPlayer: playerIndex
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
                message: `Healing Touch vyléčil vašeho hrdinu o ${healAmount} životů!`,
                forPlayer: playerIndex
            };
            break;

        case 'Glacial Burst':
            opponent.field.forEach(unit => {
                if (unit) {
                    unit.frozen = true;
                    unit.frozenLastTurn = false;
                }
            });
            console.log('Glacial Burst zmrazil jednotky:', {
                frozenUnits: opponent.field.filter(unit => unit?.frozen).length
            });
            newState.notification = {
                message: 'Všechny nepřátelské jednotky byly zmraženy!',
                forPlayer: playerIndex
            };
            break;

        case 'Inferno Wave':
            opponent.field.forEach(unit => {
                if (unit) unit.health -= 4;
            });
            console.log('Inferno Wave zasáhla jednotky:', {
                affectedUnits: opponent.field.map(unit => ({
                    name: unit?.name,
                    newHealth: unit?.health
                }))
            });
            newState.notification = {
                message: 'Inferno Wave způsobila 4 poškození všem nepřátelským jednotkám!',
                forPlayer: playerIndex
            };
            break;

        case 'The Coin':
            player.mana = Math.min(player.mana + 1, 10);
            console.log('The Coin použit:', {
                oldMana: player.mana - 1,
                newMana: player.mana
            });
            newState.notification = {
                message: 'Získali jste 1 mana crystal!',
                forPlayer: playerIndex
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
            console.log('Arcane Intellect líznul karty:', {
                cardsDrawn,
                newHandSize: player.hand.length
            });
            newState.notification = {
                message: `Líznuli jste ${cardsDrawn.length} karty!`,
                forPlayer: playerIndex
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
                message: 'Fire Elemental způsobil 2 poškození nepřátelskému hrdinovi!',
                forPlayer: playerIndex
            };
            break;

        case 'Water Elemental':
            if (opponent.field.length > 0) {
                const randomIndex = Math.floor(Math.random() * opponent.field.length);
                opponent.field[randomIndex].frozen = true;
                opponent.field[randomIndex].frozenLastTurn = false;
                newState.notification = {
                    message: `Water Elemental zmrazil nepřátelskou jednotku ${opponent.field[randomIndex].name}!`,
                    forPlayer: playerIndex
                };
            }
            break;

        case 'Nimble Sprite':
            if (player.deck.length > 0) {
                const drawnCard = player.deck.pop();
                if (player.hand.length < 10) {
                    player.hand.push(drawnCard);
                    newState.notification = {
                        message: 'Nimble Sprite vám umožnil líznout kartu!',
                        forPlayer: playerIndex
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
                message: 'Nemáte dostatek many!',
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
            
            // Aplikujeme efekty jednotky při vyložení
            const stateWithEffects = handleUnitEffects(card, player, opponent, newState, playerIndex);
            return checkGameOver(stateWithEffects);
        }
        return { 
            ...newState, 
            notification: {
                message: 'Nemáte místo na poli!',
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
