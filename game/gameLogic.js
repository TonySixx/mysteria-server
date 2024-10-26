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
    const newState = { ...state };
    
    switch (card.name) {
        case 'Fireball':
            if (!card.target) {
                return { ...newState, notification: 'Musíte vybrat cíl pro Fireball!' };
            }
            if (card.target.type === 'hero') {
                opponent.hero.health -= 6;
                newState.notification = `Fireball způsobil 6 poškození nepřátelskému hrdinovi!`;
            } else if (card.target.type === 'unit') {
                const targetUnit = opponent.field[card.target.index];
                if (targetUnit) {
                    targetUnit.health -= 6;
                    newState.notification = `Fireball způsobil 6 poškození jednotce ${targetUnit.name}!`;
                }
            }
            break;

        case 'Lightning Bolt':
            if (!card.target) {
                return { ...newState, notification: 'Musíte vybrat cíl pro Lightning Bolt!' };
            }
            if (card.target.type === 'hero') {
                opponent.hero.health -= 3;
                newState.notification = 'Lightning Bolt způsobil 3 poškození nepřátelskému hrdinovi!';
            } else if (card.target.type === 'unit') {
                const targetUnit = opponent.field[card.target.index];
                if (targetUnit) {
                    targetUnit.health -= 3;
                    newState.notification = `Lightning Bolt způsobil 3 poškození jednotce ${targetUnit.name}!`;
                }
            }
            break;

        case 'Glacial Burst':
            opponent.field.forEach(unit => {
                if (unit) {
                    unit.frozen = true;
                    unit.frozenLastTurn = false; // Přidáme nový flag
                }
            });
            newState.notification = 'Všechny nepřátelské jednotky byly zmraženy!';
            break;

        case 'Inferno Wave':
            opponent.field.forEach(unit => {
                if (unit) unit.health -= 4;
            });
            newState.notification = 'Inferno Wave způsobila 4 poškození všem nepřátelským jednotkám!';
            break;

        case 'The Coin':
            player.mana = Math.min(player.mana + 1, 10);
            newState.notification = 'Získali jste 1 mana crystal!';
            break;

        case 'Healing Touch':
            if (!card.target) {
                return { ...newState, notification: 'Musíte vybrat cíl pro Healing Touch!' };
            }
            if (card.target.type === 'hero') {
                player.hero.health = Math.min(player.hero.health + 8, 30);
                newState.notification = 'Vyléčili jste svého hrdinu o 8 životů!';
            } else if (card.target.type === 'unit') {
                const targetUnit = player.field[card.target.index];
                if (targetUnit) {
                    targetUnit.health += 8;
                    newState.notification = `Vyléčili jste jednotku ${targetUnit.name} o 8 životů!`;
                }
            }
            break;

        case 'Arcane Intellect':
            for (let i = 0; i < 2; i++) {
                if (player.deck.length > 0) {
                    const drawnCard = player.deck.pop();
                    if (player.hand.length < 10) {
                        player.hand.push(drawnCard);
                    }
                }
            }
            return {
                ...newState,
                notification: 'Líznuli jste 2 karty!',
                notificationForPlayer: playerIndex
            };
    }

    // Odstranění mrtvých jednotek
    newState.players.forEach(player => {
        player.field = player.field.filter(unit => unit.health > 0);
    });

    return checkGameOver(newState);
}

function handleUnitEffects(card, player, opponent, state, playerIndex) {
    const newState = { ...state };

    switch (card.name) {
        case 'Fire Elemental':
            // Způsobí 2 poškození nepřátelskému hrdinovi
            opponent.hero.health -= 2;
            newState.notification = `Fire Elemental způsobil 2 poškození nepřátelskému hrdinovi!`;
            break;

        case 'Water Elemental':
            if (opponent.field.length > 0) {
                const randomIndex = Math.floor(Math.random() * opponent.field.length);
                opponent.field[randomIndex].frozen = true;
                opponent.field[randomIndex].frozenLastTurn = false; // Přidáme nový flag
                newState.notification = `Water Elemental zmrazil nepřátelskou jednotku ${opponent.field[randomIndex].name}!`;
            }
            break;

        case 'Nimble Sprite':
            if (player.deck.length > 0) {
                const drawnCard = player.deck.pop();
                if (player.hand.length < 10) {
                    player.hand.push(drawnCard);
                    newState.notification = 'Nimble Sprite vám umožnil líznout kartu!';
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
            notification: 'Nemáte dostatek many!',
            notificationForPlayer: playerIndex // Pouze pro hráče, který se pokusil zahrát kartu
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
            notification: 'Nemáte místo na poli!',
            notificationForPlayer: playerIndex
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
