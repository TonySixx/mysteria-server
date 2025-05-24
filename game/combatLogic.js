const { checkGameOver, addCombatLogMessage } = require("./gameLogic");
const { UnitCard, SpellCard } = require('./CardClasses');

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

        // Kontrola, zda se má aktivovat tajná karta
        const { checkAndActivateSecrets } = require('./gameLogic');
        
        // Vytvoříme data pro aktivaci tajných karet
        const secretData = {
            playerIndex: attackerPlayerIndex,
            attackerIndex,
            targetIndex,
            attacker
        };
        
        var stateAfterSecrets;
        var shouldContinue;
        var attackerIsDead = false;
        // Kontrolujeme tajné karty před útokem
        if (isHeroAttack) {
            secretResult = checkAndActivateSecrets(newState, 'hero_attack', secretData);
            shouldContinue = secretResult.shouldContinue;
            stateAfterSecrets = secretResult.updatedState;
            attackerIsDead = secretResult.attackerIsDead;
        }
        else {
            secretResult = checkAndActivateSecrets(newState, 'attack', secretData);
            shouldContinue = secretResult.shouldContinue;
            stateAfterSecrets = secretResult.updatedState;
        }

        if (!shouldContinue) {
            return stateAfterSecrets;
        }
        
        // Pokud se hra skončila po aktivaci tajných karet, vrátíme nový stav
        if (stateAfterSecrets.gameOver) {
            return stateAfterSecrets;
        }
        
        // Pokračujeme s útokem po aktivaci tajných karet
        const updatedState = stateAfterSecrets;
        
        // Znovu získáme útočníka, protože mohl být změněn tajnými kartami
        const updatedAttacker = updatedState.players[attackerPlayerIndex].field[attackerIndex];
        
        // Pokud útočník už neexistuje nebo je zmražený, ukončíme útok
        if (!updatedAttacker || updatedAttacker.frozen || attackerIsDead) {
            return updatedState;
        }

        // Provedeme útok
        updatedAttacker.hasAttacked = true;
        updatedAttacker.canAttack = false;

        if (isHeroAttack) {
            const targetHero = updatedState.players[defenderPlayerIndex].hero;
            const oldHealth = targetHero.health;

            // Upravíme log zprávu s použitím skutečných jmen
            const attackerName = updatedState.players[attackerPlayerIndex].username;
            const defenderName = updatedState.players[defenderPlayerIndex].username;
            var blindnessLogged = false;

            if (updatedAttacker.isBlind && Math.random() < 0.5) {
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">${updatedAttacker.name}</span> missed the attack to ${defenderName}'s hero`);
                blindnessLogged = true;
            }

            if (!blindnessLogged) {
                if (updatedAttacker.name === 'Assassin Scout') {
                    targetHero.health = Math.max(0, targetHero.health - (updatedAttacker.attack + 2));
                    addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Assassin Scout</span> dealt <span class="damage">+2 bonus damage</span> to enemy hero`);
                } else if (updatedAttacker.name === 'Sneaky Infiltrator') {
                    targetHero.health = Math.max(0, targetHero.health - Math.max(0, updatedAttacker.attack - 2));
                    addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Sneaky Infiltrator</span> dealt reduced damage to enemy hero`);
                } else {
                    targetHero.health = Math.max(0, targetHero.health - updatedAttacker.attack);
                }
            }

            // V funkci attack, v části pro útok na hrdinu přidáme:
            if (updatedAttacker.name === 'Shadow Priest' && !blindnessLogged) {
                const damageDone = updatedAttacker.attack;
                const attackerPlayer = updatedState.players[attackerPlayerIndex];
                attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + damageDone);
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Shadow Priest</span> restored <span class="heal">${damageDone} health</span> to their hero`);
            }
            
            // Přidáme efekt Mana Leech při útoku na hrdinu
            if (updatedAttacker.name === 'Mana Leech') {
                const damageDone = oldHealth - targetHero.health;
                const attackerPlayer = updatedState.players[attackerPlayerIndex];
                attackerPlayer.mana = Math.min(10, attackerPlayer.mana + damageDone);
                
                updatedState.notification = {
                    message: `Mana Leech restored ${damageDone} mana!`,
                    forPlayer: attackerPlayerIndex
                };
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Mana Leech</span> restored <span class="mana">${damageDone} mana</span>`);
            }

            // Přidáme efekty pro útok na hrdinu
            if (updatedAttacker.name === 'Healing Wisp') {
                const attackerPlayer = updatedState.players[attackerPlayerIndex];
                const healAmount = 1;
                attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + healAmount);
                
                updatedState.notification = {
                    message: `Healing Wisp restored ${healAmount} health to your hero!`,
                    forPlayer: attackerPlayerIndex
                };
                
                // Přidáme zprávu do combat logu pro Healing Wisp
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Healing Wisp</span> restored <span class="heal">${healAmount} health to their hero</span>`);
            }

            // Přidáme efekt Mana Siphon při útoku na hrdinu
            if (updatedAttacker.name === 'Mana Siphon') {
                const attackerPlayer = updatedState.players[attackerPlayerIndex];
                attackerPlayer.mana = Math.min(10, attackerPlayer.mana + 1);
                
                updatedState.notification = {
                    message: 'Mana Siphon granted 1 temporary mana!',
                    forPlayer: attackerPlayerIndex
                };
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Mana Siphon</span> granted <span class="mana">1 temporary mana</span>`);
            }

            // Upravíme logiku pro Twin Blade při útoku na hrdinu
            if (updatedAttacker.canAttackTwice === true) {
                if (!updatedAttacker.attacksThisTurn) {
                    updatedAttacker.attacksThisTurn = 1;
                    updatedAttacker.hasAttacked = false;
                    updatedAttacker.canAttack = true;
                } else {
                    updatedAttacker.attacksThisTurn = 2;
                    updatedAttacker.hasAttacked = true;
                    updatedAttacker.canAttack = false;
                }
            } else {
                updatedAttacker.hasAttacked = true;
                updatedAttacker.canAttack = false;
            }
            
            if (!blindnessLogged) {
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}</span> attacked with <span class="spell-name">${updatedAttacker.name}</span> dealing <span class="damage">${updatedAttacker.attack} damage</span> to ${defenderName}'s hero`);
            }

            // V funkci attack, v části pro útok na hrdinu přidáme:
            if (updatedAttacker.name === 'Mana Vampire' && !blindnessLogged) {
                const damageDone = updatedAttacker.attack;
                const attackerPlayer = updatedState.players[attackerPlayerIndex];
                attackerPlayer.mana = Math.min(10, attackerPlayer.mana + damageDone);
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Mana Vampire</span> granted <span class="mana">${damageDone} temporary mana</span>`);
            }

            // Přidáme efekt Life Drainer při útoku na hrdinu
            if (updatedAttacker.name === 'Life Drainer' && !blindnessLogged) {
                const healAmount = 2;
                const attackerPlayer = updatedState.players[attackerPlayerIndex];
                attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + healAmount);
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Life Drainer</span> restored <span class="heal">${healAmount} health</span> to their hero`);
            }

            // V attack funkci, v části pro útok na hrdinu přidáme:
            if (updatedAttacker.name === 'Flame Warrior' && !blindnessLogged) {
                updatedAttacker.health = updatedAttacker.health - 2;
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Flame Warrior</span> took <span class="damage">2 damage</span> from attacking`);
            }

            // Před odstraněním mrtvých jednotek spočítáme jejich počet
            updatedState.players.forEach(player => {
                const deadUnits = player.field.filter(unit => unit && unit.health <= 0).length;
                updatedState.deadMinionsCount = (updatedState.deadMinionsCount || 0) + deadUnits;

                // Aktualizujeme cenu Ancient Colossus ve všech místech
                updatedState.players.forEach(p => {
                    // V ruce
                    p.hand.forEach(card => {
                        if (card.name === 'Ancient Colossus') {
                            card.manaCost = Math.max(1, 30 - updatedState.deadMinionsCount);
                        }
                    });
                    // V balíčku
                    p.deck.forEach(card => {
                        if (card.name === 'Ancient Colossus') {
                            card.manaCost = Math.max(1, 30 - updatedState.deadMinionsCount);
                        }
                    });
                });

                // Odstraníme mrtvé jednotky
                player.field = player.field.filter(card => card.health > 0);
            });

            return checkGameOver(updatedState);
        } else {
            const target = updatedState.players[defenderPlayerIndex].field[targetIndex];
            if (!target) {
                console.log('Chyba: Cíl útoku neexistuje');
                return updatedState;
            }

            console.log('Útok na jednotku:', {
                targetBefore: {
                    name: target.name,
                    health: target.health,
                    hasDivineShield: target.hasDivineShield
                },
                attackerBefore: {
                    name: updatedAttacker.name,
                    health: updatedAttacker.health,
                    hasDivineShield: updatedAttacker.hasDivineShield
                }
            });

            // Uložíme si informaci o tom, zda byl útok ovlivněn slepotou
            const wasBlindnessLogged = handleCombat(updatedAttacker, target, updatedState, attackerPlayerIndex);

            console.log('Po útoku:', {
                targetAfter: {
                    name: target.name,
                    health: target.health,
                    hasDivineShield: target.hasDivineShield
                },
                attackerAfter: {
                    name: updatedAttacker.name,
                    health: updatedAttacker.health,
                    hasDivineShield: updatedAttacker.hasDivineShield
                }
            });

            // Před odstraněním mrtvých jednotek spočítáme jejich počet
            updatedState.players.forEach(player => {
                const deadUnits = player.field.filter(unit => unit && unit.health <= 0).length;
                updatedState.deadMinionsCount = (updatedState.deadMinionsCount || 0) + deadUnits;

                // Aktualizujeme cenu Ancient Colossus ve všech místech
                updatedState.players.forEach(p => {
                    // V ruce
                    p.hand.forEach(card => {
                        if (card.name === 'Ancient Colossus') {
                            card.manaCost = Math.max(1, 30 - updatedState.deadMinionsCount);
                        }
                    });
                    // V balíčku
                    p.deck.forEach(card => {
                        if (card.name === 'Ancient Colossus') {
                            card.manaCost = Math.max(1, 30 - updatedState.deadMinionsCount);
                        }
                    });
                });

                // Odstraníme mrtvé jednotky
                player.field = player.field.filter(card => card.health > 0);
            });

            // Vypíšeme combat log pouze pokud útok nebyl ovlivněn slepotou
            if (!wasBlindnessLogged) {
                const attackerName = updatedState.players[attackerPlayerIndex].username;
                const defenderName = updatedState.players[defenderPlayerIndex].username;
                
                addCombatLogMessage(updatedState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}</span> attacked with <span class="spell-name">${updatedAttacker.name}</span> dealing <span class="damage">${updatedAttacker.attack} damage</span> to ${defenderName}'s <span class="spell-name">${target.name}</span>`);
            }

            return checkGameOver(updatedState);
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

    // Určíme, zda útočník mine svůj útok
    const attackerMissed = attacker.isBlind && Math.random() < 0.5;
    const defenderMissed = defender.isBlind && Math.random() < 0.5;


    let blindnessWasLogged = false;
    let attackerDivineShieldBrokenInThisCombat = false;
    let defenderDivineShieldBrokenInThisCombat = false;

    // Logování slepoty
    if (attackerMissed) {
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${state.players[attackerPlayerIndex].username}'s</span> <span class="spell-name">${attacker.name}</span> missed the attack due to blindness!`);
        blindnessWasLogged = true;
    }

    // Zpracování útoku - pouze pokud útočník neminul a obránce neuhnul
    if (!attackerMissed) {
        if (defender.hasDivineShield && attacker.attack > 0) {
            defender.hasDivineShield = false;
            defenderDivineShieldBrokenInThisCombat = true;
        } else {
            defender.health -= attacker.attack;
        }
    }

    // Obránce vždy provede protiútok, pokud není slepý nebo je slepý a má štěstí
    if (!defenderMissed) {
        if (attacker.hasDivineShield && defender.attack > 0) {
            attacker.hasDivineShield = false;
            attackerDivineShieldBrokenInThisCombat = true;
        } else {
            attacker.health -= defender.attack;
        }
    } else {
        addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${state.players[1 - attackerPlayerIndex].username}'s</span> <span class="spell-name">${defender.name}</span> missed their counter-attack due to blindness!`);
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
            
            // Přidáme zprvu do combat logu
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
    if (attacker.canAttackTwice === true) {
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

    // Pro Crystal Guardian - upravená implementace
    if (attacker.name === 'Crystal Guardian' && attacker.hasDivineShield === false && !attacker.divineShieldProcessed) {
        const attackerPlayer = state.players[attackerPlayerIndex];
        attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + 3);
        attacker.divineShieldProcessed = true; // Označíme, že efekt byl již zpracován
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Crystal Guardian</span> restored <span class="heal">3 health</span> to their hero`);
    }

    // Přidáme stejnou kontrolu i pro případ, kdy je Crystal Guardian obráncem
    if (defender.name === 'Crystal Guardian' && defender.hasDivineShield === false && !defender.divineShieldProcessed) {
        const defenderPlayer = state.players[1 - attackerPlayerIndex];
        defenderPlayer.hero.health = Math.min(30, defenderPlayer.hero.health + 3);
        defender.divineShieldProcessed = true; // Označíme, že efekt byl již zpracován
        addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Crystal Guardian</span> restored <span class="heal">3 health</span> to their hero`);
    }

    // Upravíme logiku pro Frost Giant a Frost Knight
    if ((attacker.name === 'Frost Giant' || attacker.name === 'Frost Knight' || defender.name === 'Frost Giant' || defender.name === 'Frost Knight') && !attackerMissed) {
        const attackerPlayer = state.players[attackerPlayerIndex];
        const defenderPlayer = state.players[1 - attackerPlayerIndex];

        if ((attacker.name === 'Frost Giant' || attacker.name === 'Frost Knight') && defender.health > 0) {
            defender.frozen = true;
            defender.frozenLastTurn = false;
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">${attacker.name}</span> <span class="freeze">froze</span> the enemy unit`);
        }
        if ((defender.name === 'Frost Giant' || defender.name === 'Frost Knight') && attacker.health > 0) {
            attacker.frozen = true;
            attacker.frozenLastTurn = false;
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">${defender.name}</span> <span class="freeze">froze</span> the enemy unit`);
        }
    }

    // Pro Shadow Priest
    if (attacker.name === 'Shadow Priest' && !attackerMissed) {
        const damageDone = Math.min(attacker.attack, defenderInitialHealth);
        const attackerPlayer = state.players[attackerPlayerIndex];
        attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + damageDone);
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Shadow Priest</span> restored <span class="heal">${damageDone} health</span> to their hero`);
    }

    // Pro Mana Vampire
    if (attacker.name === 'Mana Vampire' && !attackerMissed) {
        const attackerPlayer = state.players[attackerPlayerIndex];
        const damageDone = Math.min(attacker.attack, defenderInitialHealth - defender.health);
        if (damageDone > 0) {
            attackerPlayer.mana = Math.min(10, attackerPlayer.mana + damageDone);
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Mana Vampire</span> granted <span class="mana">${damageDone} temporary mana</span>`);
        }
    }

    // Upravíme logiku pro Cursed Warrior - aplikujeme dvojnásobné poškození vždy
    if (attacker.isCursed && !attackerDivineShieldBrokenInThisCombat) {
        attacker.health -= defender.attack; // Druhé poškození pro útočníka
        addCombatLogMessage(state, `<span class="spell-name">${attacker.name}</span> takes <span class="damage">double damage (${defender.attack * 2})</span> due to curse`);
    }
    if (defender.isCursed && !defenderDivineShieldBrokenInThisCombat) {
        defender.health -= attacker.attack; // Druhé poškození pro obránce
        addCombatLogMessage(state, `<span class="spell-name">${defender.name}</span> takes <span class="damage">double damage (${attacker.attack * 2})</span> due to curse`);
    }

    // Kontrola pro Life Drainer (podobná logika jako Healing Wisp)
    if (attacker.name === 'Life Drainer' && !attackerMissed) {
        const attackerPlayer = state.players[attackerPlayerIndex];
        const healAmount = 2;
        attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + healAmount);
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Life Drainer</span> restored <span class="heal">${healAmount} health</span> to their hero`);
    }

    // Kontrola pro Ice Revenant
    if (attacker.name === 'Ice Revenant' && attacker.health <= 0) {
        const opponent = state.players[1 - attackerPlayerIndex];
        const availableTargets = opponent.field.filter(unit => unit && unit.health > 0);
        
        if (availableTargets.length > 0) {
            const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
            randomTarget.frozen = true;
            randomTarget.frozenLastTurn = false;
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${state.players[attackerPlayerIndex].username}'s</span> <span class="spell-name">Ice Revenant</span> <span class="freeze">froze</span> enemy <span class="spell-name">${randomTarget.name}</span>`);
        }
    }

    // Stejná úprava pro obránce - odstraníme podmínku attacker.health > 0
    if (defender.name === 'Ice Revenant' && defender.health <= 0) {
        const opponent = state.players[attackerPlayerIndex];
        const availableTargets = opponent.field.filter(unit => unit && unit.health > 0);
        
        if (availableTargets.length > 0) {
            const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
            randomTarget.frozen = true;
            randomTarget.frozenLastTurn = false;
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${state.players[1 - attackerPlayerIndex].username}'s</span> <span class="spell-name">Ice Revenant</span> <span class="freeze">froze</span> enemy <span class="spell-name">${randomTarget.name}</span>`);
        }
    }


    // V handleCombat funkci přidáme zpracování efektů při smrti jednotek
    if (attacker.health <= 0) {
        // Frost Spirit efekt
        if (attacker.name === 'Frost Spirit') {
            const opponent = state.players[1 - attackerPlayerIndex];
            const availableTargets = opponent.field.filter(unit => unit && unit.health > 0);
            if (availableTargets.length > 0) {
                const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                randomTarget.frozen = true;
                randomTarget.frozenLastTurn = false;
                addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${state.players[attackerPlayerIndex].username}'s</span> <span class="spell-name">Frost Spirit</span> <span class="freeze">froze</span> enemy <span class="spell-name">${randomTarget.name}</span>`);
            }
        }

        // Bee Guardian efekt
        if (attacker.name === 'Bee Guardian') {
            const opponent = state.players[1 - attackerPlayerIndex];
            if (opponent.deck.length > 0 && opponent.hand.length < 10) {
                const drawnCard = opponent.deck.pop();
                opponent.hand.push(drawnCard);
                addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}</span> drew a card from <span class="spell-name">Bee Guardian's</span> death effect`);
            }
        }

        // Death Prophet efekt
        if (attacker.name === 'Death Prophet') {
            const attackerPlayer = state.players[attackerPlayerIndex];
            if (attackerPlayer.deck.length > 0 && attackerPlayer.hand.length < 10) {
                const drawnCard = attackerPlayer.deck.pop();
                attackerPlayer.hand.push(drawnCard);
                addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Death Prophet</span> <span class="draw">drew a card</span> on death`);
            }
        }

        // Přidáme efekt pro Phoenix
        if (attacker.name === 'Phoenix') {
            const player = state.players[attackerPlayerIndex];
            const fieldIndex = player.field.findIndex(card => card && card.id === attacker.id);
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
                addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Phoenix</span> was reborn as a Phoenix Hatchling`);
            }
        }

        // Přidáme efekt pro Cursed Imp
        if (attacker.name === 'Cursed Imp') {
            const player = state.players[attackerPlayerIndex];
            player.hero.health = Math.max(0, player.hero.health - 3);
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Cursed Imp</span> dealt <span class="damage">3 damage</span> to their hero`);
        }

        // Přidáme efekt pro Fire Dragon
        if (attacker.name === 'Fire Dragon') {
            const attackerPlayer = state.players[attackerPlayerIndex];
            const fireball = new SpellCard(
                `fireball-${Date.now()}`,
                'Fireball',
                4,
                'Deal 6 damage to enemy hero',
                'fireball',
                'uncommon'
            );
            
            // Vložíme Fireball na náhodnou pozici v balíčku
            const randomIndex = Math.floor(Math.random() * (attackerPlayer.deck.length + 1));
            attackerPlayer.deck.splice(randomIndex, 0, fireball);
            
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Fire Dragon</span> shuffled a <span class="spell-name">Fireball</span> into their deck`);
        }
        
        // Přidáme efekt pro Sacred Dragon
        if (attacker.name === 'Sacred Dragon') {
            const attackerPlayer = state.players[attackerPlayerIndex];
            attackerPlayer.hero.health = 30;
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Sacred Dragon</span> restored their hero to <span class="heal">full health</span>`);
        }

        // Přidáme efekt pro Arcane Summoner
        if (attacker.name === 'Arcane Summoner') {
            const attackerPlayer = state.players[attackerPlayerIndex];
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
                const randomIndex = Math.floor(Math.random() * (attackerPlayer.deck.length + 1));
                attackerPlayer.deck.splice(randomIndex, 0, arcaneWisp);
            }
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Arcane Summoner</span> shuffled two <span class="spell-name">Arcane Wisps</span> into their deck`);
        }

        // Přidáme efekt pro Eternal Wanderer
        if (attacker.name === 'Eternal Wanderer') {
            const attackerPlayer = state.players[attackerPlayerIndex];
            if (attackerPlayer.hand.length < 10) {
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
                attackerPlayer.hand.push(wanderer);
                addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Eternal Wanderer</span> returned to their hand`);
            }
        }
    }

    if (defender.health <= 0) {
        // Frost Spirit efekt
        if (defender.name === 'Frost Spirit') {
            const opponent = state.players[attackerPlayerIndex];
            const availableTargets = opponent.field.filter(unit => unit && unit.health > 0);
            if (availableTargets.length > 0) {
                const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
                randomTarget.frozen = true;
                randomTarget.frozenLastTurn = false;
                addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${state.players[attackerPlayerIndex].username}'s</span> <span class="spell-name">Frost Spirit</span> <span class="freeze">froze</span> enemy <span class="spell-name">${randomTarget.name}</span>`);
            }
        }

        // Bee Guardian efekt
        if (defender.name === 'Bee Guardian') {
            const opponent = state.players[attackerPlayerIndex];
            if (opponent.deck.length > 0 && opponent.hand.length < 10) {
                const drawnCard = opponent.deck.pop();
                opponent.hand.push(drawnCard);
                addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${opponent.username}</span> drew a card from <span class="spell-name">Bee Guardian's</span> death effect`);
            }
        }

        // Death Prophet efekt
        if (defender.name === 'Death Prophet') {
            const defenderPlayer = state.players[1 - attackerPlayerIndex];
            if (defenderPlayer.deck.length > 0 && defenderPlayer.hand.length < 10) {
                const drawnCard = defenderPlayer.deck.pop();
                defenderPlayer.hand.push(drawnCard);
                addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Death Prophet</span> <span class="draw">drew a card</span> on death`);
            }
        }

        // Přidáme efekt pro Phoenix
        if (defender.name === 'Phoenix') {
            const player = state.players[1 - attackerPlayerIndex];
            const fieldIndex = player.field.findIndex(card => card && card.id === defender.id);
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
                addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Phoenix</span> was reborn as a Phoenix Hatchling`);
            }
        }

        // Přidáme efekt pro Cursed Imp
        if (defender.name === 'Cursed Imp') {
            const player = state.players[1 - attackerPlayerIndex];
            player.hero.health = Math.max(0, player.hero.health - 3);
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">Cursed Imp</span> dealt <span class="damage">3 damage</span> to their hero`);
        }

        // Přidáme efekt pro Fire Dragon
        if (defender.name === 'Fire Dragon') {
            const defenderPlayer = state.players[1 - attackerPlayerIndex];
            const fireball = new SpellCard(
                `fireball-${Date.now()}`,
                'Fireball',
                4,
                'Deal 6 damage to enemy hero',
                'fireball',
                'uncommon'
            );
            
            // Vložíme Fireball na náhodnou pozici v balíčku
            const randomIndex = Math.floor(Math.random() * (defenderPlayer.deck.length + 1));
            defenderPlayer.deck.splice(randomIndex, 0, fireball);
            
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Fire Dragon</span> shuffled a <span class="spell-name">Fireball</span> into their deck`);
        }
        
        // Přidáme efekt pro Sacred Dragon
        if (defender.name === 'Sacred Dragon') {
            const defenderPlayer = state.players[1 - attackerPlayerIndex];
            defenderPlayer.hero.health = 30;
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Sacred Dragon</span> restored their hero to <span class="heal">full health</span>`);
        }

        // Přidáme efekt pro Arcane Summoner
        if (defender.name === 'Arcane Summoner') {
            const defenderPlayer = state.players[1 - attackerPlayerIndex];
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
                const randomIndex = Math.floor(Math.random() * (defenderPlayer.deck.length + 1));
                defenderPlayer.deck.splice(randomIndex, 0, arcaneWisp);
            }
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Arcane Summoner</span> shuffled two <span class="spell-name">Arcane Wisps</span> into their deck`);
        }

        // Přidáme efekt pro Eternal Wanderer
        if (defender.name === 'Eternal Wanderer') {
            const defenderPlayer = state.players[1 - attackerPlayerIndex];
            if (defenderPlayer.hand.length < 10) {
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
                defenderPlayer.hand.push(wanderer);
                addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Eternal Wanderer</span> returned to their hand`);
            }
        }
    }

    // Efekt gainAttackOnDeath pro Blood Cultist a Soul Harvester
    // Přidáme na začátek funkce handleCombat
    if (defender.health <= 0) {
        // Projdeme všechny jednotky na poli a aplikujeme efekt
        state.players.forEach((player, playerIndex) => {
            player.field.forEach(unit => {
                if (unit && unit.gainAttackOnDeath) {
                    unit.attack += 1;
                    addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">${unit.name}</span> gained <span class="attack">+1 attack</span>`);
                }
            });
        });
    }

    if (attacker.health <= 0) {
        // Stejný efekt aplikujeme i při smrti útočníka
        state.players.forEach((player, playerIndex) => {
            player.field.forEach(unit => {
                if (unit && unit.gainAttackOnDeath) {
                    unit.attack += 1;
                    addCombatLogMessage(state, `<span class="${playerIndex === 0 ? 'player-name' : 'enemy-name'}">${player.username}'s</span> <span class="spell-name">${unit.name}</span> gained <span class="attack">+1 attack</span>`);
                }
            });
        });
    }

    // Pro Spirit Guardian
    if (attacker.name === 'Spirit Guardian' && attacker.hasDivineShield === false && !attacker.divineShieldProcessed) {
        attacker.divineShieldProcessed = true;
        const attackerPlayer = state.players[attackerPlayerIndex];
        const availableTargets = attackerPlayer.field.filter(unit => 
            unit && !unit.hasDivineShield && unit.id !== attacker.id
        );
        
        if (availableTargets.length > 0) {
            const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
            randomTarget.divineShieldProcessed = false;
            randomTarget.hasDivineShield = true;
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Spirit Guardian</span> gave <span class="buff">Divine Shield</span> to <span class="spell-name">${randomTarget.name}</span>`);
        }
    }

    // Stejná kontrola pro obránce
    if (defender.name === 'Spirit Guardian' && defender.hasDivineShield === false && !defender.divineShieldProcessed) {
        defender.divineShieldProcessed = true;
        const defenderPlayer = state.players[1 - attackerPlayerIndex];
        const availableTargets = defenderPlayer.field.filter(unit => 
            unit && !unit.hasDivineShield && unit.id !== defender.id
        );
        
        if (availableTargets.length > 0) {
            const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
            randomTarget.divineShieldProcessed = false;
            randomTarget.hasDivineShield = true;
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Spirit Guardian</span> gave <span class="buff">Divine Shield</span> to <span class="spell-name">${randomTarget.name}</span>`);
        }
    }

    // Pro Arcane Wisp
    if (attacker.name === 'Arcane Wisp' && attacker.health <= 0) {
        const attackerPlayer = state.players[attackerPlayerIndex];
        if (attackerPlayer.hand.length < 10) {
            const coin = new SpellCard(`$coin-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 'The Coin', 0, 'Gain 1 Mana Crystal', 'coinImage');
            attackerPlayer.hand.push(coin);
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Arcane Wisp</span> added <span class="spell-name">The Coin</span> to their hand`);
        }
    }

    if (defender.name === 'Arcane Wisp' && defender.health <= 0) {
        const defenderPlayer = state.players[1 - attackerPlayerIndex];
        if (defenderPlayer.hand.length < 10) {
            const coin = new SpellCard(`$coin-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 'The Coin', 0, 'Gain 1 Mana Crystal', 'coinImage');
            defenderPlayer.hand.push(coin);
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Arcane Wisp</span> added <span class="spell-name">The Coin</span> to their hand`);
        }
    }

    // V handleCombat funkci přidáme efekt pro Flame Warrior
    if (attacker.name === 'Flame Warrior' && !attackerMissed) {
        attacker.health = attacker.health - 2;
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${state.players[attackerPlayerIndex].username}'s</span> <span class="spell-name">Flame Warrior</span> took <span class="damage">2 damage</span> from attacking`);
    }

    // Efekt Silence Assassin - odstranění Tauntu před útokem
    if (attacker.name === 'Silence Assassin' && defender.hasTaunt) {
        defender.hasTaunt = false;
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${state.players[attackerPlayerIndex].username}'s</span> <span class="spell-name">Silence Assassin</span> removed <span class="buff">Taunt</span> from <span class="spell-name">${defender.name}</span>`);
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

    return blindnessWasLogged;
}

module.exports = {
    attack,
    handleCombat
};
