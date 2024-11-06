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

            // Upravíme log zprávu s použitím skutečných jmen
            const attackerName = newState.players[attackerPlayerIndex].username;
            const defenderName = newState.players[defenderPlayerIndex].username;
            var blindnessLogged = false;

            if (attacker.isBlind && Math.random() < 0.5) {
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">${attacker.name}</span> missed the attack to ${defenderName}'s hero`);
                blindnessLogged = true;
            }

            if (!blindnessLogged) targetHero.health = Math.max(0, targetHero.health - attacker.attack);

            // V funkci attack, v části pro útok na hrdinu přidáme:
            if (attacker.name === 'Shadow Priest' && !blindnessLogged) {
                const damageDone = attacker.attack;
                const attackerPlayer = newState.players[attackerPlayerIndex];
                attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + damageDone);
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Shadow Priest</span> restored <span class="heal">${damageDone} health</span> to their hero`);
            }

            
            // Přidáme efekt Mana Leech při útoku na hrdinu
            if (attacker.name === 'Mana Leech') {
                const damageDone = oldHealth - targetHero.health;
                const attackerPlayer = newState.players[attackerPlayerIndex];
                attackerPlayer.mana = Math.min(10, attackerPlayer.mana + damageDone);
                
                newState.notification = {
                    message: `Mana Leech restored ${damageDone} mana!`,
                    forPlayer: attackerPlayerIndex
                };
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Mana Leech</span> restored <span class="mana">${damageDone} mana</span>`);
            }

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
            
            if (!blindnessLogged) {
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}</span> attacked with <span class="spell-name">${attacker.name}</span> dealing <span class="damage">${attacker.attack} damage</span> to ${defenderName}'s hero`);
            }

            // V funkci attack, v části pro útok na hrdinu přidáme:
            if (attacker.name === 'Mana Vampire' && !blindnessLogged) {
                const damageDone = attacker.attack;
                const attackerPlayer = newState.players[attackerPlayerIndex];
                attackerPlayer.mana = Math.min(10, attackerPlayer.mana + damageDone);
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Mana Vampire</span> granted <span class="mana">${damageDone} temporary mana</span>`);
            }

            // Přidáme efekt Life Drainer při útoku na hrdinu
            if (attacker.name === 'Life Drainer' && !blindnessLogged) {
                const healAmount = 2;
                const attackerPlayer = newState.players[attackerPlayerIndex];
                attackerPlayer.hero.health = Math.min(30, attackerPlayer.hero.health + healAmount);
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}'s</span> <span class="spell-name">Life Drainer</span> restored <span class="heal">${healAmount} health</span> to their hero`);
            }

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

            // Uložíme si informaci o tom, zda byl útok ovlivněn slepotou
            const wasBlindnessLogged = handleCombat(attacker, target, newState, attackerPlayerIndex);

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

            // Vypíšeme combat log pouze pokud útok nebyl ovlivněn slepotou
            if (!wasBlindnessLogged) {
                const attackerName = newState.players[attackerPlayerIndex].username;
                const defenderName = newState.players[defenderPlayerIndex].username;
                
                addCombatLogMessage(newState, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerName}</span> attacked with <span class="spell-name">${attacker.name}</span> dealing <span class="damage">${attacker.attack} damage</span> to ${defenderName}'s <span class="spell-name">${target.name}</span>`);
            }

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

    // Určíme, zda útočník mine svůj útok
    const attackerMissed = attacker.isBlind && Math.random() < 0.5;
    const defenderMissed = defender.isBlind && Math.random() < 0.5;


    let blindnessWasLogged = false;

    // Logování slepoty
    if (attackerMissed) {
        addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${state.players[attackerPlayerIndex].username}'s</span> <span class="spell-name">${attacker.name}</span> missed the attack due to blindness!`);
        blindnessWasLogged = true;
    }

    // Zpracování útoku - pouze pokud útočník neminul a obránce neuhnul
    if (!attackerMissed) {
        if (defender.hasDivineShield && attacker.attack > 0) {
            defender.hasDivineShield = false;
        } else {
            defender.health -= attacker.attack;
        }
    }

    // Obránce vždy provede protiútok, pokud není slepý nebo je slepý a má štěstí
    if (!defenderMissed) {
        if (attacker.hasDivineShield && defender.attack > 0) {
            attacker.hasDivineShield = false;
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

    // Upravíme logiku pro Frost Giant
    if ((attacker.name === 'Frost Giant' || defender.name === 'Frost Giant') && !attackerMissed) {
        const attackerPlayer = state.players[attackerPlayerIndex];
        const defenderPlayer = state.players[1 - attackerPlayerIndex];


        if (attacker.name === 'Frost Giant' && defender.health > 0) {
            defender.frozen = true;
            defender.frozenLastTurn = false;
            addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Frost Giant</span> <span class="freeze">froze</span> the enemy unit`);
        }
        if (defender.name === 'Frost Giant' && attacker.health > 0) {
            attacker.frozen = true;
            attacker.frozenLastTurn = false;
            addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Frost Giant</span> <span class="freeze">froze</span> the enemy unit`);
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
    if (attacker.isCursed) {
        attacker.health -= defender.attack; // Druhé poškození pro útočníka
        addCombatLogMessage(state, `<span class="spell-name">${attacker.name}</span> takes <span class="damage">double damage (${defender.attack * 2})</span> due to curse`);
    }
    if (defender.isCursed) {
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
        // Death Prophet efekt
        if (attacker.name === 'Death Prophet') {
            const attackerPlayer = state.players[attackerPlayerIndex];
            if (attackerPlayer.deck.length > 0 && attackerPlayer.hand.length < 10) {
                const drawnCard = attackerPlayer.deck.pop();
                attackerPlayer.hand.push(drawnCard);
                addCombatLogMessage(state, `<span class="${attackerPlayerIndex === 0 ? 'player-name' : 'enemy-name'}">${attackerPlayer.username}'s</span> <span class="spell-name">Death Prophet</span> <span class="draw">drew a card</span> on death`);
            }
        }
    }

    if (defender.health <= 0) {
        // Death Prophet efekt pro obránce
        if (defender.name === 'Death Prophet') {
            const defenderPlayer = state.players[1 - attackerPlayerIndex];
            if (defenderPlayer.deck.length > 0 && defenderPlayer.hand.length < 10) {
                const drawnCard = defenderPlayer.deck.pop();
                defenderPlayer.hand.push(drawnCard);
                addCombatLogMessage(state, `<span class="${(1 - attackerPlayerIndex) === 0 ? 'player-name' : 'enemy-name'}">${defenderPlayer.username}'s</span> <span class="spell-name">Death Prophet</span> <span class="draw">drew a card</span> on death`);
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
