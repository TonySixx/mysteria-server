const { UnitCard, SpellCard } = require('./CardClasses');

class AIPlayer {
    constructor(gameState, playerIndex) {
        this.gameState = gameState;
        this.playerIndex = playerIndex;
        this.thinkingTime = 1500; // 1.5 sekundy "přemýšlení"
    }

    async makeMove() {
        // Simulujeme "přemýšlení" AI
        await new Promise(resolve => setTimeout(resolve, this.thinkingTime));

        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];

        // 1. Použít hrdinskou schopnost, pokud je to výhodné
        if (this.shouldUseHeroAbility(player, opponent)) {
            return {
                type: 'heroAbility'
            };
        }

        // 2. Zahrát kartu, pokud je to možné
        const cardPlay = this.findBestCardPlay(player, opponent);
        if (cardPlay) {
            return cardPlay;
        }

        // 3. Zaútočit jednotkami
        const attack = this.findBestAttack(player, opponent);
        if (attack) {
            return attack;
        }

        // 4. Ukončit tah, pokud není co dělat
        return {
            type: 'endTurn'
        };
    }

    shouldUseHeroAbility(player, opponent) {
        if (player.hero.hasUsedAbility || player.mana < player.hero.abilityCost) {
            return false;
        }

        switch (player.hero.id) {
            case 1: // Mage
                return opponent.hero.health <= 2 || player.mana >= 8;
            case 2: // Priest
                return player.hero.health <= 25;
            case 3: // Seer
                return player.hand.length < 4;
            case 4: // Defender
                return player.field.length > 0 && !player.field.some(unit => unit.hasTaunt);
            default:
                return false;
        }
    }

    findBestCardPlay(player, opponent) {
        if (player.hand.length === 0 || player.field.length >= 7) {
            return null;
        }

        // Seřadíme karty podle priority
        const playableCards = player.hand
            .filter(card => card.manaCost <= player.mana)
            .sort((a, b) => this.evaluateCard(b) - this.evaluateCard(a));

        if (playableCards.length === 0) {
            return null;
        }

        const cardToPlay = playableCards[0];
        const cardIndex = player.hand.indexOf(cardToPlay);

        return {
            type: 'playCard',
            cardIndex: cardIndex,
            destinationIndex: this.findBestPosition(player, cardToPlay)
        };
    }

    findBestAttack(player, opponent) {
        try {
            // Kontrola, zda máme vůbec nějaké útočníky
            const availableAttackers = player.field.filter(unit => 
                unit && !unit.hasAttacked && !unit.frozen);

            if (availableAttackers.length === 0) {
                console.log('Žádní dostupní útočníci');
                return null;
            }

            // Vrátíme JEDEN nejlepší útok místo procházení všech útočníků
            // Tím zajistíme, že stav hry bude aktuální pro každý další útok
            const bestAttacker = this.findBestAttacker(availableAttackers);
            if (!bestAttacker) {
                console.log('Nenalezen vhodný útočník');
                return null;
            }

            const attackerIndex = player.field.findIndex(unit => unit && unit.id === bestAttacker.id);
            if (attackerIndex === -1) {
                console.log('Útočník již není na poli');
                return null;
            }

            // Nejdřív zkontrolujeme, zda můžeme útočit na hrdinu
            const canAttackHero = !opponent.field.some(unit => unit && unit.hasTaunt);

            // Kontrola Taunt jednotek
            const tauntTargets = opponent.field.filter(unit => unit && unit.hasTaunt);
            
            // Pokud jsou Taunt jednotky, musíme na ně útočit
            if (tauntTargets.length > 0) {
                const bestTauntTarget = this.findBestTarget(bestAttacker, tauntTargets);
                if (bestTauntTarget) {
                    const targetIndex = opponent.field.findIndex(unit => 
                        unit && unit.id === bestTauntTarget.id);
                    
                    if (targetIndex !== -1) {
                        console.log(`Útok na Taunt jednotku: ${bestTauntTarget.name} na indexu ${targetIndex}`);
                        return {
                            type: 'attack',
                            attackerIndex,
                            targetIndex,
                            isHeroTarget: false
                        };
                    }
                }
                return null; // Pokud nemůžeme zaútočit na Taunt, končíme
            }

            // Pokud můžeme zabít hrdinu, uděláme to
            if (canAttackHero && bestAttacker.attack >= opponent.hero.health) {
                console.log('Smrtící útok na hrdinu');
                return {
                    type: 'attack',
                    attackerIndex,
                    targetIndex: null,
                    isHeroTarget: true
                };
            }

            // Hledáme nejvýhodnější výměnu
            const validTargets = opponent.field.filter(unit => unit !== null);
            if (validTargets.length > 0) {
                const bestTarget = this.findBestTarget(bestAttacker, validTargets);
                if (bestTarget && this.isGoodTrade(bestAttacker, bestTarget)) {
                    const targetIndex = opponent.field.findIndex(unit => 
                        unit && unit.id === bestTarget.id);
                    
                    if (targetIndex !== -1) {
                        console.log(`Výhodný útok: ${bestAttacker.name} -> ${bestTarget.name}`);
                        return {
                            type: 'attack',
                            attackerIndex,
                            targetIndex,
                            isHeroTarget: false
                        };
                    }
                }
            }

            // Pokud nemáme lepší možnost a můžeme útočit na hrdinu
            if (canAttackHero) {
                console.log('Útok na hrdinu (žádný lepší cíl)');
                return {
                    type: 'attack',
                    attackerIndex,
                    targetIndex: null,
                    isHeroTarget: true
                };
            }

            console.log('Nenalezen žádný vhodný útok');
            return null;

        } catch (error) {
            console.error('Chyba při hledání nejlepšího útoku:', error);
            return null;
        }
    }

    evaluateCard(card) {
        if (card instanceof SpellCard) {
            return this.evaluateSpell(card);
        }

        let value = card.attack + card.health;

        // Bonus pro karty s efekty
        if (card.hasTaunt) value += 2;
        if (card.hasDivineShield) value += 3;
        if (card.effect.includes('Draw')) value += 2;
        if (card.effect.includes('Freeze')) value += 2;
        if (card.effect.includes('Deal damage')) value += 2;

        // Přizpůsobení hodnoty podle stavu hry
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];

        // Preferujeme Taunt jednotky když máme málo životů
        if (card.hasTaunt && player.hero.health < 15) {
            value += 3;
        }

        // Preferujeme léčivé efekty když máme málo životů
        if (card.effect.includes('Restore') && player.hero.health < 15) {
            value += 3;
        }

        // Preferujeme silnější jednotky když prohráváme na poli
        if (opponent.field.length > player.field.length) {
            value += card.attack;
        }

        return value;
    }

    evaluateSpell(card) {
        let value = card.manaCost * 1.5;
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];

        switch (card.name) {
            case 'Fireball':
                value += opponent.hero.health <= 6 ? 10 : 4;
                break;
            case 'Healing Touch':
                value += (30 - player.hero.health) / 2;
                break;
            case 'Arcane Intellect':
                value += player.hand.length < 3 ? 6 : 3;
                break;
            case 'The Coin':
                value += player.hand.some(c => c.manaCost === player.mana + 1) ? 5 : 1;
                break;
            case 'Glacial Burst':
                value += opponent.field.length * 2;
                break;
            case 'Inferno Wave':
                value += opponent.field.filter(unit => unit.health <= 4).length * 3;
                break;
        }

        return value;
    }

    evaluateAttacker(unit) {
        let value = unit.attack;
        
        // Preferujeme útok jednotkami s Divine Shield
        if (unit.hasDivineShield) value += 3;
        
        // Preferujeme útok jednotkami s efekty při útoku
        if (unit.effect.includes('when this attacks')) value += 2;
        
        return value;
    }

    findBestAttackMove(attacker, opponent) {
        const player = this.gameState.players[this.playerIndex];
        
        // Kontrola Taunt jednotek
        const tauntTargets = opponent.field.filter(unit => unit && unit.hasTaunt);
        if (tauntTargets.length > 0) {
            const bestTauntTarget = this.findBestTarget(attacker, tauntTargets);
            if (bestTauntTarget) {
                const targetIndex = opponent.field.findIndex(unit => unit && unit.id === bestTauntTarget.id);
                if (targetIndex !== -1) {
                    return {
                        targetIndex,
                        isHeroTarget: false
                    };
                }
            }
        }

        // Pokud můžeme zabít hrdinu, uděláme to
        if (attacker.attack >= opponent.hero.health) {
            return { isHeroTarget: true };
        }

        // Pokud nejsou žádné jednotky na poli protivníka, útočíme na hrdinu
        if (!opponent.field.some(unit => unit !== null)) {
            return { isHeroTarget: true };
        }

        // Najdeme nejvýhodnější výměnu na poli
        const fieldTargets = opponent.field.filter(unit => unit !== null);
        if (fieldTargets.length > 0) {
            const target = this.findBestTarget(attacker, fieldTargets);
            if (target && this.isGoodTrade(attacker, target)) {
                const targetIndex = opponent.field.findIndex(unit => unit && unit.id === target.id);
                if (targetIndex !== -1) {
                    return {
                        targetIndex,
                        isHeroTarget: false
                    };
                }
            }
        }

        // Pokud nemáme dobrou výměnu a máme převahu na poli, útočíme na hrdinu
        const playerFieldUnits = player.field.filter(unit => unit !== null).length;
        const opponentFieldUnits = opponent.field.filter(unit => unit !== null).length;
        if (playerFieldUnits > opponentFieldUnits) {
            return { isHeroTarget: true };
        }

        // Pokud není nic lepšího, útočíme na hrdinu
        return { isHeroTarget: true };
    }

    isGoodTrade(attacker, target) {
        // Výměna je dobrá pokud:
        // 1. Zabijeme jednotku a přežijeme
        if (attacker.attack >= target.health && attacker.health > target.attack) {
            return true;
        }

        // 2. Zabijeme silnější jednotku
        if (attacker.attack >= target.health && 
            (target.attack + target.health > attacker.attack + attacker.health)) {
            return true;
        }

        // 3. Zabijeme jednotku s důležitým efektem
        if (attacker.attack >= target.health && 
            (target.hasTaunt || target.effect.includes('at the end of your turn'))) {
            return true;
        }

        return false;
    }

    findBestTarget(attacker, targets) {
        try {
            if (!targets || targets.length === 0) {
                console.log('Žádné cíle k dispozici');
                return null;
            }

            return targets.reduce((best, current) => {
                if (!best) return current;
                if (!current) return best;
                
                // Preferujeme cíle, které můžeme zničit
                if (attacker.attack >= current.health && 
                    (best.health > current.health || attacker.attack < best.health)) {
                    return current;
                }
                
                // Jinak preferujeme nebezpečnější jednotky
                if (current.attack > best.attack) {
                    return current;
                }

                return best;
            }, null);
        } catch (error) {
            console.error('Chyba při hledání nejlepšího cíle:', error);
            return null;
        }
    }

    findBestPosition(player, card) {
        if (card instanceof SpellCard) {
            return null;
        }

        // Pro jednotky s Taunt preferujeme prostřední pozice
        if (card.hasTaunt) {
            return Math.floor(player.field.length / 2);
        }

        // Pro ostatní jednotky přidáváme na konec
        return player.field.length;
    }

    // Přidáme novou metodu pro výběr nejlepšího útočníka
    findBestAttacker(availableAttackers) {
        return availableAttackers.reduce((best, current) => {
            if (!best) return current;

            const bestValue = this.evaluateAttacker(best);
            const currentValue = this.evaluateAttacker(current);

            return currentValue > bestValue ? current : best;
        }, null);
    }
}

module.exports = AIPlayer; 