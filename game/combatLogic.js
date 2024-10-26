const { checkGameOver } = require("./gameLogic");

function attack(attackerIndex, targetIndex, isHeroTarget, isAIAttack) {
    return (state) => {
        const newState = { ...state };
        const attackerPlayerIndex = state.currentPlayer;
        const defenderPlayerIndex = 1 - attackerPlayerIndex;
        const attacker = newState.players[attackerPlayerIndex].field[attackerIndex];

        // Kontrolujeme pouze skutečně neplatné útoky
        if (!attacker) {
            return { 
                ...newState, 
                notification: { 
                    message: 'Jednotka neexistuje!',
                    forPlayer: attackerPlayerIndex 
                }
            };
        }

        if (attacker.frozen) {
            return { 
                ...newState, 
                notification: { 
                    message: 'Zmražená jednotka nemůže útočit!',
                    forPlayer: attackerPlayerIndex 
                }
            };
        }

        if (attacker.hasAttacked) {
            return { 
                ...newState, 
                notification: { 
                    message: 'Tato jednotka již v tomto kole útočila!',
                    forPlayer: attackerPlayerIndex 
                }
            };
        }

        // Kontrola Taunt efektu
        const hasTauntMinion = newState.players[defenderPlayerIndex].field.some(unit => 
            unit && unit.effect && unit.effect.includes('Taunt')
        );
        
        if (hasTauntMinion) {
            if (isHeroTarget) {
                return { 
                    ...newState, 
                    notification: { 
                        message: 'Nemůžete útočit na hrdinu, dokud je na stole jednotka s Taunt efektem!',
                        forPlayer: attackerPlayerIndex 
                    }
                };
            }
            
            const target = newState.players[defenderPlayerIndex].field[targetIndex];
            if (!target?.effect?.includes('Taunt')) {
                return { 
                    ...newState, 
                    notification: { 
                        message: 'Musíte nejprve zaútočit na jednotku s Taunt efektem!',
                        forPlayer: attackerPlayerIndex 
                    }
                };
            }
        }

        // Provedeme útok
        attacker.hasAttacked = true;
        attacker.canAttack = false;

        if (isHeroTarget) {
            const targetHero = newState.players[defenderPlayerIndex].hero;
            targetHero.health -= attacker.attack;
            return checkGameOver(newState);
        } else {
            const target = newState.players[defenderPlayerIndex].field[targetIndex];
            if (!target) return newState;
            handleCombat(attacker, target);
            newState.players.forEach(player => {
                player.field = player.field.filter(card => card.health > 0);
            });
            return checkGameOver(newState);
        }
    };
}

function handleCombat(attacker, defender) {
    if (defender.hasDivineShield) {
        defender.hasDivineShield = false;
    } else {
        defender.health -= attacker.attack;
    }

    if (attacker.hasDivineShield) {
        attacker.hasDivineShield = false;
    } else {
        attacker.health -= defender.attack;
    }
}

module.exports = {
    attack,
    handleCombat
};
