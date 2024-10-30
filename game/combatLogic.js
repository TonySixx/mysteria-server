const { checkGameOver, addCombatLogMessage } = require("./gameLogic");

// Helper funkce pro bezpečnou kopii herního stavu
function cloneGameState(state) {
    const newState = {
        ...state,
        players: state.players.map(player => ({
            ...player,
            field: [...player.field],
            hand: [...player.hand],
            hero: { ...player.hero },
            deck: [...player.deck]
        }))
    };
    return newState;
}

function attack(attackerIndex, targetIndex, isHeroAttack) {
    return (state) => {
        console.log('Začátek útoku:', {
            attackerIndex,
            targetIndex,
            isHeroAttack,
            currentPlayer: state.currentPlayer
        });

        const newState = cloneGameState(state); // Použijeme vlastní funkci pro kopírování
        const attackerPlayerIndex = state.currentPlayer;
        const defenderPlayerIndex = 1 - attackerPlayerIndex;
        
        // Najdeme útočníka
        const attacker = newState.players[attackerPlayerIndex].field[attackerIndex];
        
        console.log('Útočník:', {
            name: attacker?.name,
            attack: attacker?.attack,
            hasAttacked: attacker?.hasAttacked,
            frozen: attacker?.frozen
        });

        // Kontroly
        if (!attacker) {
            console.log('Chyba: Útočník neexistuje');
            return { 
                ...newState, 
                notification: { 
                    message: 'Unit does not exist!',
                    forPlayer: attackerPlayerIndex 
                }
            };
        }

        if (attacker.frozen) {
            console.log('Chyba: Útočník je zmražený');
            return { 
                ...newState, 
                notification: { 
                    message: 'Frozen unit cannot attack!',
                    forPlayer: attackerPlayerIndex 
                }
            };
        }

        if (attacker.hasAttacked) {
            console.log('Chyba: Útočník již útočil');
            return { 
                ...newState, 
                notification: { 
                    message: 'This unit has already attacked this turn!',
                    forPlayer: attackerPlayerIndex 
                }
            };
        }

        // Kontrola Taunt efektu
        const hasTauntMinion = newState.players[defenderPlayerIndex].field.some(unit => 
            unit && unit.hasTaunt
        );
        
        console.log('Kontrola Taunt:', {
            hasTauntMinion,
            defenderField: newState.players[defenderPlayerIndex].field.map(unit => ({
                name: unit?.name,
                hasTaunt: unit?.hasTaunt
            }))
        });

        if (hasTauntMinion) {
            if (isHeroAttack) {
                console.log('Chyba: Pokus o útok na hrdinu přes Taunt');
                return { 
                    ...newState, 
                    notification: { 
                        message: 'Cannot attack hero while there is a Taunt unit on the field!',
                        forPlayer: attackerPlayerIndex 
                    }
                };
            }
            
            const target = newState.players[defenderPlayerIndex].field[targetIndex];
            if (!target?.hasTaunt) {
                console.log('Chyba: Pokus o útok na jednotku bez Taunt, když je na poli Taunt');
                return { 
                    ...newState, 
                    notification: { 
                        message: 'You must attack the Taunt unit first!',
                        forPlayer: attackerPlayerIndex 
                    }
                };
            }
        }

        // Provedeme útok
        attacker.hasAttacked = true;
        attacker.canAttack = false;

        if (isHeroAttack) {
            const targetHero = newState.players[defenderPlayerIndex].hero;
            const oldHealth = targetHero.health;
            targetHero.health = Math.max(0, targetHero.health - attacker.attack);
            
            // Přidáme efekty pro útok na hrdinu
            if (attacker.name === 'Healing Wisp') {
                const attackerPlayer = newState.players[attackerPlayerIndex];
                const healAmount = 1;
                attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + healAmount);
                
                newState.notification = {
                    message: `Healing Wisp restored ${healAmount} health to your hero!`,
                    forPlayer: attackerPlayerIndex
                };
                
                // Přidáme zprávu do combat logu pro Healing Wisp
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Healing Wisp</span> restored <span class="heal">${healAmount} health to their hero</span>`);
            }

            // Přidáme efekt Mana Siphon při útoku na hrdinu
            if (attacker.name === 'Mana Siphon') {
                const attackerPlayer = newState.players[attackerPlayerIndex];
                attackerPlayer.mana = Math.min(10, attackerPlayer.mana + 1);
                
                newState.notification = {
                    message: 'Mana Siphon granted 1 temporary mana!',
                    forPlayer: attackerPlayerIndex
                };
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Mana Siphon</span> granted <span class="mana">1 temporary mana</span>`);
            }

            // Upravíme logiku pro Twin Blade při útoku na hrdinu
            if (attacker.name === 'Twin Blade') {
                if (!attacker.attacksThisTurn) {
                    attacker.attacksThisTurn = 1;
                    attacker.hasAttacked = false;
                    attacker.canAttack = true;
                } else {
                    attacker.attacksThisTurn = 2;
                    attacker.hasAttacked = true;
                    attacker.canAttack = false;
                }
            } else {
                attacker.hasAttacked = true;
                attacker.canAttack = false;
            }
            
            // Upravíme log zprávu s použitím skutečných jmen
            const attackerName = newState.players[attackerPlayerIndex].username;
            const defenderName = newState.players[defenderPlayerIndex].username;
            
            addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}</span> attacked with <span class="spell-name">${attacker.name}</span> dealing <span class="damage">${attacker.attack} damage</span> to ${defenderName}'s hero`);

            return checkGameOver(newState);
        } else {
            const target = newState.players[defenderPlayerIndex].field[targetIndex];
            if (!target) {
                console.log('Chyba: Cíl útoku neexistuje');
                return newState;
            }

            console.log('Útok na jednotku:', {
                targetBefore: {
                    name: target.name,
                    health: target.health,
                    hasDivineShield: target.hasDivineShield
                },
                attackerBefore: {
                    name: attacker.name,
                    health: attacker.health,
                    hasDivineShield: attacker.hasDivineShield
                }
            });

            handleCombat(attacker, target, newState, attackerPlayerIndex);

            console.log('Po útoku:', {
                targetAfter: {
                    name: target.name,
                    health: target.health,
                    hasDivineShield: target.hasDivineShield
                },
                attackerAfter: {
                    name: attacker.name,
                    health: attacker.health,
                    hasDivineShield: attacker.hasDivineShield
                }
            });

            // Odstraníme mrtvé jednotky
            newState.players.forEach(player => {
                player.field = player.field.filter(card => card.health > 0);
            });

            // Upravíme log zprávu s použitím skutečných jmen
            const attackerName = newState.players[attackerPlayerIndex].username;
            const defenderName = newState.players[defenderPlayerIndex].username;
            
            addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}</span> attacked with <span class="spell-name">${attacker.name}</span> dealing <span class="damage">${attacker.attack} damage</span> to ${defenderName}'s <span class="spell-name">${target.name}</span>`);

            return checkGameOver(newState);
        }
    };
}

function handleCombat(attacker, defender, state, attackerPlayerIndex) {
    console.log('Začátek souboje:', {
        attacker: {
            name: attacker.name,
            attack: attacker.attack,
            health: attacker.health,
            hasDivineShield: attacker.hasDivineShield
        },
        defender: {
            name: defender.name,
            attack: defender.attack,
            health: defender.health,
            hasDivineShield: defender.hasDivineShield
        }
    });

    const defenderInitialHealth = defender.health;

    // Zpracování útoku
    if (defender.hasDivineShield) {
        defender.hasDivineShield = false;
    } else {
        defender.health -= attacker.attack;
    }

    // Pokud má útočník Divine Shield, zruší se mu, jinak dostane poškození
    if (attacker.hasDivineShield) {
        attacker.hasDivineShield = false;
    } else {
        attacker.health -= defender.attack;
    }

    // Kontrola a odstranění startTurnEffects pro zničené jednotky
    if (defender.health <= 0 && defender.name === 'Mana Collector') {
        state.startTurnEffects = state.startTurnEffects?.filter(effect => 
            !(effect.type === 'mana' && effect.unitId === defender.id)
        ) || [];
    }

    if (attacker.health <= 0 && attacker.name === 'Mana Collector') {
        state.startTurnEffects = state.startTurnEffects?.filter(effect => 
            !(effect.type === 'mana' && effect.unitId === attacker.id)
        ) || [];
    }

    // Efekt Mana Crystal při smrti - přesunut před filtrování mrtvých jednotek
    if (attacker.name === 'Mana Crystal' && attacker.health <= 0) {
        const attackerPlayer = state.players[attackerPlayerIndex];
        attackerPlayer.mana = Math.min(10, attackerPlayer.mana + 1);
        
        state.notification = {
            message: 'Mana Crystal death granted 1 mana crystal!',
            forPlayer: attackerPlayerIndex
        };
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Mana Crystal</span> granted <span class="mana">1 mana crystal</span> on death`);
    }

    // Kontrola efektu Soul Collector
    if (attacker.name === 'Soul Collector' && defenderInitialHealth > 0 && defender.health <= 0) {
        const attackerPlayer = state.players[attackerPlayerIndex];
        
        // Pokud má hráč karty v balíčku a místo v ruce
        if (attackerPlayer.deck.length > 0 && attackerPlayer.hand.length < 10) {
            const drawnCard = attackerPlayer.deck.pop();
            attackerPlayer.hand.push(drawnCard);
            
            // Přidáme notifikaci o efektu
            state.notification = {
                message: 'Soul Collector drew a card!',
                forPlayer: attackerPlayerIndex
            };
            
            // Přidáme zprávu do combat logu
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}</span>'s <span class="spell-name">Soul Collector</span> <span class="draw">drew a card</span> after killing an enemy`);
        }
    }

    // V handleCombat funkci přidáme zpracování efektu Mana Leech
    if (attacker.name === 'Mana Leech' && defenderInitialHealth > defender.health) {
        const damageDone = defenderInitialHealth - defender.health;
        const attackerPlayer = state.players[attackerPlayerIndex];
        attackerPlayer.mana = Math.min(10, attackerPlayer.mana + damageDone);
        
        state.notification = {
            message: `Mana Leech restored ${damageDone} mana!`,
            forPlayer: attackerPlayerIndex
        };
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Mana Leech</span> restored <span class="mana">${damageDone} mana</span>`);
    }

    // Efekt Healing Wisp
    if (attacker.name === 'Healing Wisp') {
        const attackerPlayer = state.players[attackerPlayerIndex];
        const healAmount = 1;
        attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + healAmount);
        
        state.notification = {
            message: `Healing Wisp restored ${healAmount} health to your hero!`,
            forPlayer: attackerPlayerIndex
        };
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Healing Wisp</span> restored <span class="heal">${healAmount} health</span>`);
    }

    // Efekt Mana Siphon
    if (attacker.name === 'Mana Siphon') {
        const attackerPlayer = state.players[attackerPlayerIndex];
        attackerPlayer.mana = Math.min(10, attackerPlayer.mana + 1);
        
        state.notification = {
            message: 'Mana Siphon granted 1 temporary mana!',
            forPlayer: attackerPlayerIndex
        };
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Mana Siphon</span> granted <span class="mana">1 temporary mana</span>`);
    }

    // Efekt Defensive Scout
    if (defender.name === 'Defensive Scout' && defenderInitialHealth > defender.health) {
        const defenderPlayer = state.players[1 - attackerPlayerIndex];
        if (defenderPlayer.deck.length > 0 && defenderPlayer.hand.length < 10) {
            const drawnCard = defenderPlayer.deck.pop();
            defenderPlayer.hand.push(drawnCard);
            
            state.notification = {
                message: 'Defensive Scout drew a card!',
                forPlayer: 1 - attackerPlayerIndex
            };
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Defensive Scout</span> <span class="draw">drew a card</span>`);
        }
    }

    // Upravíme logiku pro Twin Blade
    if (attacker.name === 'Twin Blade') {
        if (!attacker.attacksThisTurn) {
            attacker.attacksThisTurn = 1;
            attacker.hasAttacked = false;
            attacker.canAttack = true;
        } else {
            attacker.attacksThisTurn = 2;
            attacker.hasAttacked = true;
            attacker.canAttack = false;
        }
    }

    console.log('Konec souboje:', {
        attacker: {
            name: attacker.name,
            health: attacker.health,
            hasDivineShield: attacker.hasDivineShield
        },
        defender: {
            name: defender.name,
            health: defender.health,
            hasDivineShield: defender.hasDivineShield
        }
    });

    // addCombatLogMessage(state, /* zpráva */);
}

module.exports = {
    attack,
    handleCombat
};
