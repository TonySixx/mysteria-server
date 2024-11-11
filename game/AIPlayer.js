const { UnitCard, SpellCard } = require('./CardClasses');

class AIPlayer {
    constructor(gameState, playerIndex) {
        this.gameState = gameState;
        this.playerIndex = playerIndex;
        this.thinkingTime = 1500;
        
        // Určíme typ balíčku podle hrdiny
        this.deckType = this.determineDeckType();
    }

    determineDeckType() {
        const hero = this.gameState.players[this.playerIndex].hero;
        return hero.id; // 1 = Mage, 2 = Priest, 3 = Seer
    }

    async makeMove() {
        // Přidáme kontrolu na gameOver hned na začátku
        if (this.gameState.gameOver) {
            console.log('Hra je ukončena, AI již neprovádí žádné tahy');
            return null;
        }

        // Simulujeme "přemýšlení" AI
        await new Promise(resolve => setTimeout(resolve, this.thinkingTime));

        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];

        // Znovu kontrola gameOver po "přemýšlení"
        if (this.gameState.gameOver) {
            console.log('Hra byla ukončena během přemýšlení AI');
            return null;
        }

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

        // Seřadíme karty podle priority a many
        const playableCards = player.hand
            .filter(card => card.manaCost <= player.mana)
            .sort((a, b) => {
                const valueA = this.evaluateCard(a);
                const valueB = this.evaluateCard(b);
                
                // Pokud je jedna z karet The Coin, dáme jí nižší prioritu
                if (a.name === 'The Coin' && b.name !== 'The Coin') {
                    return 1;
                }
                if (b.name === 'The Coin' && a.name !== 'The Coin') {
                    return -1;
                }
                
                return valueB - valueA;
            });

        if (playableCards.length === 0) {
            return null;
        }

        // Pro The Coin zkontrolujeme, zda máme smysluplné využití extra many
        const bestCard = playableCards[0];
        if (bestCard.name === 'The Coin') {
            const potentialPlays = player.hand.filter(card => 
                card.name !== 'The Coin' && 
                card.manaCost <= player.mana + 1
            );
            
            if (potentialPlays.length === 0) {
                // Pokud nemáme co zahrát s extra manou, přeskočíme The Coin
                if (playableCards.length > 1) {
                    return {
                        type: 'playCard',
                        cardIndex: player.hand.indexOf(playableCards[1]),
                        destinationIndex: this.findBestPosition(player, playableCards[1])
                    };
                }
                return null;
            }
        }

        const cardIndex = player.hand.indexOf(bestCard);
        return {
            type: 'playCard',
            cardIndex: cardIndex,
            destinationIndex: this.findBestPosition(player, bestCard)
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
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];

        // Základní hodnota podle efektů
        if (card.hasTaunt) value += 2;
        if (card.hasDivineShield) value += 3;
        if (card.effect.includes('Draw')) value += 2;
        if (card.effect.includes('Freeze')) value += 2;
        if (card.effect.includes('Deal damage')) value += 2;

        // Speciální hodnocení podle typu balíčku
        switch (this.deckType) {
            case 2: // Priest
                // Vyšší hodnota pro obranné karty
                if (card.hasTaunt) value += 2;
                if (card.effect.includes('restore') || card.effect.includes('heal')) value += 3;
                if (card.health > 5) value += 2;
                
                // Speciální karty
                if (card.name === 'Crystal Guardian') value += 4;
                if (card.name === 'Spirit Healer') value += 3;
                if (card.name === 'Ancient Protector') value += 5;
                break;

            case 3: // Seer
                // Vyšší hodnota pro karty se synergií s kouzly
                if (card.effect.includes('cast a spell')) value += 3;
                if (card.effect.includes('mana')) value += 2;
                
                // Speciální karty
                if (card.name === 'Arcane Familiar') value += 3;
                if (card.name === 'Mana Wyrm') value += 3;
                if (card.name === 'Battle Mage') value += 4;
                if (card.name === 'Mana Collector') value += 4;
                break;

            default: // Mage
                // Vyšší hodnota pro agresivní karty
                if (card.attack > card.health) value += 1;
                if (card.effect.includes('damage')) value += 2;
                break;
        }

        // Situační hodnota
        if (player.hero.health < 15) {
            if (card.hasTaunt) value += 3;
            if (card.effect.includes('heal') || card.effect.includes('restore')) value += 3;
        }

        if (opponent.field.length > player.field.length) {
            value += card.attack;
        }

        return value;
    }

    evaluateSpell(card) {
        let value = card.manaCost * 1.5;
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];

        // Nejdřív zkontrolujeme, zda má kouzlo vůbec smysl použít
        switch (card.name) {
            case 'Inferno Wave':
                // Nepoužívat AoE pokud není na co
                if (opponent.field.length === 0) return -1;
                // Spočítáme kolik jednotek by zemřelo
                const killedUnits = opponent.field.filter(unit => unit && unit.health <= 4).length;
                value = killedUnits * 3;
                // Přidáme bonus pokud zabijeme něco důležitého
                if (opponent.field.some(unit => unit && 
                    (unit.attack >= 5 || unit.effect.includes('at the end of') || unit.hasTaunt))) {
                    value += 4;
                }
                break;

            case 'Arcane Explosion':
                if (opponent.field.length === 0) return -1;
                // Hodnotnější pokud zabije nějaké 1 HP jednotky
                const weakUnits = opponent.field.filter(unit => unit && unit.health === 1).length;
                value = weakUnits * 3;
                break;

            case 'Glacial Burst':
                if (opponent.field.length === 0) return -1;
                // Hodnotnější pokud zmrazí silné útočící jednotky
                const strongAttackers = opponent.field.filter(unit => unit && unit.attack >= 4).length;
                value = strongAttackers * 3;
                break;

            case 'Healing Touch':
                const missingHealth = 30 - player.hero.health;
                if (missingHealth < 5) return -1; // Neléčit pokud není potřeba
                value = missingHealth / 2;
                // Extra hodnota pokud jsme v ohrožení života
                if (player.hero.health < 10) value += 5;
                break;

            case 'Holy Nova':
                if (opponent.field.length === 0 && player.hero.health > 25) return -1;
                value = opponent.field.length * 2; // Hodnota za poškození
                // Přidáme hodnotu za léčení pokud je potřeba
                if (player.hero.health < 25) value += 2;
                if (player.field.some(unit => unit && unit.health < unit.maxHealth)) {
                    value += 3;
                }
                break;

            case 'Mass Fortification':
                const buffableUnits = player.field.filter(unit => !unit.hasTaunt).length;
                if (buffableUnits === 0) return -1;
                value = buffableUnits * 2;
                // Extra hodnota pokud máme málo životů a potřebujeme obranu
                if (player.hero.health < 15) value += 3;
                break;

            case 'Arcane Storm':
                const spellDamage = this.gameState.spellsPlayedThisGame || 0;
                if (spellDamage < 3) return -1; // Nepoužívat s malým poškozením
                // Hodnotit podle toho, kolik důležitých věcí zabije
                const totalKills = [...player.field, ...opponent.field].filter(
                    unit => unit && unit.health <= spellDamage
                ).length;
                value = totalKills * 2;
                // Přidat hodnotu pokud zabije protivníka
                if (opponent.hero.health <= spellDamage) value += 10;
                break;

            case 'Mirror Image':
                // Hodnotnější pokud potřebujeme obranu
                if (player.field.length >= 6) return -1; // Není místo
                if (opponent.field.some(unit => unit && unit.attack >= 4)) {
                    value += 4;
                }
                if (player.hero.health < 15) value += 3;
                break;

            case 'Arcane Intellect':
                // Hodnotnější s prázdnou rukou
                if (player.hand.length >= 8) return -1; // Neriskovat přeplnění ruky
                value = 7 - player.hand.length; // Čím méně karet, tím lepší
                break;

            case 'The Coin':
                // Zkontrolujeme, zda máme kartu, kterou díky coinu můžeme zahrát
                const playableWithCoin = player.hand.some(c => 
                    c.name !== 'The Coin' && 
                    c.manaCost === player.mana + 1 &&
                    this.evaluateCard(c) > 5 // Jen pro dobré karty
                );
                return playableWithCoin ? 5 : -1;
                break;

            case 'Mana Surge':
                const potentialMana = player.maxMana - player.mana;
                if (potentialMana < 3) return -1; // Nepoužívat pro málo many
                // Zkontrolujeme, zda máme v ruce drahé karty
                const hasExpensiveCards = player.hand.some(c => 
                    c.manaCost > player.mana && 
                    c.manaCost <= player.maxMana
                );
                value = hasExpensiveCards ? potentialMana * 2 : -1;
                break;
        }

        // Obecné modifikátory
        if (player.hand.length <= 1) value -= 2;
        if (player.field.some(unit => unit && unit.name === 'Arcane Familiar')) value += 2;
        if (player.field.some(unit => unit && unit.name === 'Mana Wyrm')) value += 2;
        if (player.field.some(unit => unit && unit.name === 'Battle Mage')) value += 2;

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
        if (card instanceof SpellCard) return null;

        const field = player.field;
        
        // Speciální umístění pro karty s efekty na sousední jednotky
        if (card.name === 'Ancient Protector' || card.name === 'Guardian Totem') {
            // Najdeme pozici, kde bude nejvíce sousedních jednotek
            let bestPosition = field.length;
            let maxNeighbors = 0;
            
            for (let i = 0; i <= field.length; i++) {
                let neighbors = 0;
                if (i > 0 && field[i-1]) neighbors++;
                if (i < field.length && field[i]) neighbors++;
                
                if (neighbors > maxNeighbors) {
                    maxNeighbors = neighbors;
                    bestPosition = i;
                }
            }
            return bestPosition;
        }

        // Pro Taunt jednotky preferujeme prostřední pozice
        if (card.hasTaunt) {
            return Math.floor(field.length / 2);
        }

        // Pro ostatní jednotky přidáváme na konec
        return field.length;
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