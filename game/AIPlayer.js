const { UnitCard, SpellCard } = require('./CardClasses');

class AIPlayer {
    constructor(gameState, playerIndex) {
        this.gameState = gameState;
        this.playerIndex = playerIndex;
        this.thinkingTime = 1500;
        
        // Určíme typ balíčku podle hrdiny
        this.deckType = this.determineDeckType();
        
        // Přidáme nové vlastnosti pro strategické plánování
        this.gamePhase = this.determineGamePhase();
        this.strategy = this.determineStrategy();
        this.threatLevel = this.calculateThreatLevel();
    }

    determineDeckType() {
        const hero = this.gameState.players[this.playerIndex].hero;
        return hero.id; // 1 = Mage, 2 = Priest, 3 = Seer
    }

    // Nová metoda pro určení fáze hry
    determineGamePhase() {
        const turn = this.gameState.turn;
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];
        
        if (turn <= 3) return 'early';
        if (turn <= 6) return 'mid';
        if (player.hero.health <= 10 || opponent.hero.health <= 10) return 'late';
        return 'mid';
    }

    // Nová metoda pro určení strategie
    determineStrategy() {
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];
        
        // Pokud máme výraznou převahu na poli, hraj agresivně
        const fieldAdvantage = this.calculateFieldAdvantage();
        if (fieldAdvantage > 3) return 'aggressive';
        
        // Pokud jsme v ohrožení, hraj defenzivně
        if (player.hero.health < 15) return 'defensive';
        
        // Pokud soupeř má převahu, hraj kontrolně
        if (fieldAdvantage < -2) return 'control';
        
        // Jinak hraj tempo
        return 'tempo';
    }

    // Nová metoda pro výpočet úrovně hrozby
    calculateThreatLevel() {
        const opponent = this.gameState.players[1 - this.playerIndex];
        
        let threatLevel = 0;
        
        // Hrozba z nepřátelského pole
        opponent.field.forEach(unit => {
            if (unit) {
                threatLevel += unit.attack;
                if (unit.effect.includes('at the end of your turn')) threatLevel += 3;
                if (unit.effect.includes('when you cast a spell')) threatLevel += 2;
            }
        });
        
        // Hrozba z karet v ruce (odhadneme)
        threatLevel += opponent.hand.length * 1.5;
        
        return threatLevel;
    }

    // Nová metoda pro výpočet převahy na poli
    calculateFieldAdvantage() {
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];
        
        let playerStrength = 0;
        let opponentStrength = 0;
        
        player.field.forEach(unit => {
            if (unit) {
                playerStrength += unit.attack + unit.health;
                if (unit.hasTaunt) playerStrength += 2;
                if (unit.hasDivineShield) playerStrength += 3;
            }
        });
        
        opponent.field.forEach(unit => {
            if (unit) {
                opponentStrength += unit.attack + unit.health;
                if (unit.hasTaunt) opponentStrength += 2;
                if (unit.hasDivineShield) opponentStrength += 3;
            }
        });
        
        return playerStrength - opponentStrength;
    }

    async makeMove() {
        // Přidáme kontrolu na gameOver hned na začátku
        if (this.gameState.gameOver) {
            console.log('Hra je ukončena, AI již neprovádí žádné tahy');
            return null;
        }

        // Aktualizujeme strategické informace na začátku tahu
        this.gamePhase = this.determineGamePhase();
        this.strategy = this.determineStrategy();
        this.threatLevel = this.calculateThreatLevel();

        // Simulujeme "přemýšlení" AI
        await new Promise(resolve => setTimeout(resolve, this.thinkingTime));

        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];

        // Znovu kontrola gameOver po "přemýšlení"
        if (this.gameState.gameOver) {
            console.log('Hra byla ukončena během přemýšlení AI');
            return null;
        }

        console.log(`AI Strategy: ${this.strategy}, Game Phase: ${this.gamePhase}, Threat Level: ${this.threatLevel}`);

        // 1. Použít hrdinskou schopnost, pokud je to výhodné
        if (this.shouldUseHeroAbility(player, opponent)) {
            return {
                type: 'heroAbility'
            };
        }

        // 2. Zahrát karty podle strategie (může hrát více karet za tah)
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
                // Použít schopnost pokud:
                // 1. Můžeme zabít hrdinu
                if (opponent.hero.health <= 2) return true;
                              
                // 3. Máme přebytek many a není lepší využití
                if (player.mana >= 8 && player.hand.every(card => card.manaCost > player.mana || this.evaluateCard(card) < 5)) {
                    return true;
                }
                
                return false;

            case 2: // Priest
                // Neléčit pokud máme plné životy
                if (player.hero.health >= 29) return false;
                
                // Spočítáme potenciální léčení z ruky
                const healingPotential = player.hand.reduce((total, card) => {
                    if (card.effect && card.effect.includes('Restore') && card.manaCost <= player.mana) {
                        const healAmount = parseInt(card.effect.match(/\d+/)[0]) || 0;
                        return total + healAmount;
                    }
                    return total;
                }, 0);

                // Použít schopnost pokud:
                // 1. Jsme v kritickém stavu (pod 10 HP)
                if (player.hero.health <= 10) return true;
                
                
                // 3. Jsme pod 25 HP, nemáme léčení v ruce a pole je stabilní
                if (player.hero.health <= 25 && 
                    healingPotential === 0 && 
                    !opponent.field.some(unit => unit && unit.attack >= 4)) {
                    return true;
                }
                
                // 4. Máme přebytek many a není lepší využití
                if (player.mana >= 8 && 
                    player.hero.health < 25 && 
                    player.hand.every(card => card.manaCost > player.mana || this.evaluateCard(card) < 5)) {
                    return true;
                }
                
                return false;

            case 3: // Seer
                // Použít schopnost pokud:
                // 1. Máme málo karet a žádné lízání v ruce
                if (player.hand.length <= 2 && 
                    !player.hand.some(card => card.effect && card.effect.includes('Draw'))) {
                    return true;
                }
                
                // 2. Máme karty se synergií s kouzly a volnou manu
                const spellSynergyUnits = player.field.filter(unit => 
                    unit && unit.effect && unit.effect.includes('cast a spell')
                ).length;
                if (spellSynergyUnits >= 2 && player.mana >= 4) {
                    return true;
                }
                
                // 3. Potřebujeme konkrétní odpověď (např. Taunt nebo removal)
                const needsAnswer = opponent.field.some(unit => unit && unit.attack >= 5) &&
                    !player.hand.some(card => card.hasTaunt || card.effect.includes('Deal damage'));
                if (needsAnswer && player.hand.length < 5) {
                    return true;
                }
                
                // 4. Máme přebytek many a málo karet
                if (player.mana >= 6 && player.hand.length < 4) {
                    return true;
                }
                
                return false;

            case 4: // Defender
                // Použít schopnost pokud:
                // 1. Máme jednotky bez Tauntu a soupeř má silné jednotky
                if (player.field.length > 0 && 
                    !player.field.some(unit => unit.hasTaunt) &&
                    opponent.field.some(unit => unit && unit.attack >= 4)) {
                    return true;
                }
                
                // 2. Máme důležité jednotky, které potřebují ochranu
                const hasImportantUnit = player.field.some(unit => 
                    unit && !unit.hasTaunt && (
                        unit.attack >= 4 ||
                        unit.effect.includes('at the end of your turn') ||
                        unit.effect.includes('when you cast a spell')
                    )
                );
                if (hasImportantUnit && opponent.field.some(unit => unit)) {
                    return true;
                }
                
                return false;

            default:
                return false;
        }
    }

    findBestCardPlay(player, opponent) {
        if (player.hand.length === 0) {
            return null;
        }

        // Najdeme nejlepší kombinaci karet k zahrání
        const bestCombination = this.findBestCardCombination(player, opponent);
        
        if (bestCombination && bestCombination.length > 0) {
            // Vrátíme první kartu z kombinace
            const cardToPlay = bestCombination[0];
            const cardIndex = player.hand.findIndex(card => card.id === cardToPlay.id);
            
            if (cardIndex !== -1) {
                console.log(`Hraju kartu: ${cardToPlay.name} (kombinace ${bestCombination.length} karet)`);
                
                return {
                    type: 'playCard',
                    cardIndex: cardIndex,
                    position: this.findBestPosition(player, cardToPlay)
                };
            }
        }

        return null;
    }

    // Nová metoda pro hledání nejlepší kombinace karet
    findBestCardCombination(player, opponent) {
        const playableCards = player.hand.filter(card => card.manaCost <= player.mana);
        
        if (playableCards.length === 0) {
            return null;
        }

        // Generujeme možné kombinace karet podle dostupné many
        const combinations = this.generateCardCombinations(playableCards, player.mana);
        
        // Hodnotíme každou kombinaci
        let bestCombination = null;
        let bestValue = -1;
        
        combinations.forEach(combination => {
            const value = this.evaluateCardCombination(combination, player, opponent);
            if (value > bestValue) {
                bestValue = value;
                bestCombination = combination;
            }
        });
        
        return bestCombination;
    }

    // Nová metoda pro generování kombinací karet
    generateCardCombinations(playableCards, availableMana) {
        const combinations = [];
        
        // Seřadíme karty podle priority
        const sortedCards = playableCards.sort((a, b) => {
            const valueA = this.evaluateCard(a);
            const valueB = this.evaluateCard(b);
            
            // The Coin má nižší prioritu
            if (a.name === 'The Coin' && b.name !== 'The Coin') return 1;
            if (b.name === 'The Coin' && a.name !== 'The Coin') return -1;
            
            return valueB - valueA;
        });

        // Generujeme kombinace (jednoduchý greedy algoritmus)
        for (let i = 0; i < sortedCards.length; i++) {
            const combination = [];
            let remainingMana = availableMana;
            
            // Začneme s kartou i
            if (sortedCards[i].manaCost <= remainingMana) {
                combination.push(sortedCards[i]);
                remainingMana -= sortedCards[i].manaCost;
                
                // Přidáme další karty pokud se vejdou
                for (let j = 0; j < sortedCards.length; j++) {
                    if (j !== i && sortedCards[j].manaCost <= remainingMana) {
                        // Kontrola field space pro jednotky
                        const unitsInCombination = combination.filter(card => card.type === 'unit').length;
                        const currentFieldSize = this.gameState.players[this.playerIndex].field.filter(unit => unit).length;
                        
                        if (sortedCards[j].type === 'unit' && currentFieldSize + unitsInCombination >= 7) {
                            continue; // Přeskočíme pokud by se nevešla na pole
                        }
                        
                        combination.push(sortedCards[j]);
                        remainingMana -= sortedCards[j].manaCost;
                    }
                }
            }
            
            if (combination.length > 0) {
                combinations.push(combination);
            }
        }
        
        // Přidáme také jednotlivé karty
        sortedCards.forEach(card => {
            if (card.manaCost <= availableMana) {
                const currentFieldSize = this.gameState.players[this.playerIndex].field.filter(unit => unit).length;
                if (card.type === 'spell' || currentFieldSize < 7) {
                    combinations.push([card]);
                }
            }
        });
        
        return combinations;
    }

    // Nová metoda pro hodnocení kombinace karet
    evaluateCardCombination(combination, player, opponent) {
        let totalValue = 0;
        let manaEfficiency = 0;
        const totalManaCost = combination.reduce((sum, card) => sum + card.manaCost, 0);
        
        // Základní hodnota karet
        combination.forEach(card => {
            totalValue += this.evaluateCard(card);
        });
        
        // Bonus za efektivní využití many
        manaEfficiency = totalManaCost / Math.max(player.mana, 1);
        totalValue += manaEfficiency * 2;
        
        // Strategické bonusy
        totalValue += this.evaluateCombinationStrategy(combination, player, opponent);
        
        // Synergické bonusy
        totalValue += this.evaluateCombinationSynergies(combination, player);
        
        return totalValue;
    }

    // Nová metoda pro strategické hodnocení kombinace
    evaluateCombinationStrategy(combination, player, opponent) {
        let bonus = 0;
        
        switch (this.strategy) {
            case 'aggressive':
                // Agresivní: preferuj rychlé jednotky a damage
                combination.forEach(card => {
                    if (card.type === 'unit' && card.attack > card.health) bonus += 2;
                    if (card.effect && card.effect.includes('damage')) bonus += 3;
                });
                break;
                
            case 'defensive':
                // Defenzivní: preferuj Taunt a léčení
                combination.forEach(card => {
                    if (card.hasTaunt) bonus += 3;
                    if (card.effect && (card.effect.includes('restore') || card.effect.includes('heal'))) bonus += 3;
                });
                break;
                
            case 'control':
                // Kontrolní: preferuj removal a card draw
                combination.forEach(card => {
                    if (card.effect && card.effect.includes('Deal damage to all')) bonus += 4;
                    if (card.effect && card.effect.includes('Draw')) bonus += 3;
                });
                break;
                
            case 'tempo':
                // Tempo: preferuj efektivní stats
                combination.forEach(card => {
                    if (card.type === 'unit' && card.attack + card.health >= card.manaCost * 2) bonus += 2;
                });
                break;
        }
        
        return bonus;
    }

    // Nová metoda pro hodnocení synergií v kombinaci
    evaluateCombinationSynergies(combination, player) {
        let bonus = 0;
        
        // Spell synergies
        const spellsInCombination = combination.filter(card => card instanceof SpellCard).length;
        const spellSynergyUnits = combination.filter(card => 
            card.type === 'unit' && card.effect && card.effect.includes('cast a spell')
        ).length;
        
        bonus += spellsInCombination * spellSynergyUnits * 2;
        
        // Taunt synergies
        const tauntUnits = combination.filter(card => card.hasTaunt).length;
        if (tauntUnits >= 2) bonus += 3; // Bonus za více Taunt jednotek
        
        // Healing synergies pro Priest
        if (this.deckType === 2) {
            const healingCards = combination.filter(card => 
                card.effect && (card.effect.includes('restore') || card.effect.includes('heal'))
            ).length;
            if (healingCards >= 2) bonus += 4;
        }
        
        return bonus;
    }

    // Upravená původní metoda (pro zpětnou kompatibilitu)
    findBestCardPlayOld(player, opponent) {
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
            const availableAttackers = player.field.filter(unit => {
                if (!unit || unit.hasAttacked || unit.frozen) return false;
                
                // Pro čistě obranné jednotky (0 útok)
                if (unit.attack === 0) {
                    return this.hasDeathEffectSynergy(player);
                }
                
                // Pro Taunt jednotky s nízkým útokem
                if (unit.hasTaunt && unit.attack <= 1) {
                    // Povolíme útok pokud:
                    // 1. Máme death effect synergii
                    if (this.hasDeathEffectSynergy(player)) return true;
                    
                    // 2. Můžeme útočit na hrdinu
                    if (!opponent.field.some(u => u && u.hasTaunt)) return true;
                    
                    // 3. Můžeme zabít nepřátelskou jednotku s 1 životem
                    if (opponent.field.some(u => u && u.health <= unit.attack)) return true;
                    
                    return false;
                }
                
                return true;
            });

            if (availableAttackers.length === 0) {
                console.log('Žádní dostupní útočníci');
                return null;
            }

            // Nejdřív zkontrolujeme lethal možnosti
            const lethalAttack = this.findLethalAttack(availableAttackers, opponent);
            if (lethalAttack) {
                console.log('Nalezen lethal útok!');
                return lethalAttack;
            }

            // Strategické rozhodnutí o útoku podle aktuální strategie
            return this.findStrategicAttack(availableAttackers, player, opponent);

        } catch (error) {
            console.error('Chyba při hledání nejlepšího útoku:', error);
            return null;
        }
    }

    // Nová metoda pro hledání lethal útoků
    findLethalAttack(availableAttackers, opponent) {
        const canAttackHero = !opponent.field.some(unit => unit && unit.hasTaunt);
        
        if (!canAttackHero) return null;
        
        // Spočítáme celkový damage na hrdinu
        const totalDamage = availableAttackers.reduce((total, unit) => total + unit.attack, 0);
        
        if (totalDamage >= opponent.hero.health) {
            // Vrátíme první útočník pro lethal sekvenci
            const attackerIndex = this.gameState.players[this.playerIndex].field.findIndex(
                unit => unit && unit.id === availableAttackers[0].id
            );
            
            return {
                type: 'attack',
                attackerIndex,
                targetIndex: null,
                isHeroTarget: true
            };
        }
        
        return null;
    }

    // Nová metoda pro strategické útoky
    findStrategicAttack(availableAttackers, player, opponent) {
        const bestAttacker = this.findBestStrategicAttacker(availableAttackers, opponent);
        if (!bestAttacker) {
            console.log('Nenalezen vhodný útočník');
            return null;
        }

        const attackerIndex = player.field.findIndex(unit => unit && unit.id === bestAttacker.id);
        if (attackerIndex === -1) {
            console.log('Útočník již není na poli');
            return null;
        }

        // Kontrola Taunt jednotek
        const tauntTargets = opponent.field.filter(unit => unit && unit.hasTaunt);
        
        // Pokud jsou Taunt jednotky, musíme na ně útočit
        if (tauntTargets.length > 0) {
            const bestTauntTarget = this.findBestStrategicTarget(bestAttacker, tauntTargets);
            if (bestTauntTarget) {
                const targetIndex = opponent.field.findIndex(unit => 
                    unit && unit.id === bestTauntTarget.id);
                
                if (targetIndex !== -1) {
                    console.log(`Strategický útok na Taunt: ${bestTauntTarget.name}`);
                    return {
                        type: 'attack',
                        attackerIndex,
                        targetIndex,
                        isHeroTarget: false
                    };
                }
            }
            return null;
        }

        // Rozhodnutí podle strategie
        const attackDecision = this.makeStrategicAttackDecision(bestAttacker, opponent);
        
        if (attackDecision.isHeroTarget) {
            console.log(`Strategický útok na hrdinu (${this.strategy})`);
            return {
                type: 'attack',
                attackerIndex,
                targetIndex: null,
                isHeroTarget: true
            };
        } else if (attackDecision.target) {
            const targetIndex = opponent.field.findIndex(unit => 
                unit && unit.id === attackDecision.target.id);
            
            if (targetIndex !== -1) {
                console.log(`Strategický útok na jednotku: ${attackDecision.target.name}`);
                return {
                    type: 'attack',
                    attackerIndex,
                    targetIndex,
                    isHeroTarget: false
                };
            }
        }

        console.log('Nenalezen žádný vhodný útok');
        return null;
    }

    // Nová metoda pro výběr nejlepšího strategického útočníka
    findBestStrategicAttacker(availableAttackers, opponent) {
        return availableAttackers.reduce((best, current) => {
            if (!best) return current;

            const bestValue = this.evaluateAttackerStrategically(best, opponent);
            const currentValue = this.evaluateAttackerStrategically(current, opponent);

            return currentValue > bestValue ? current : best;
        }, null);
    }

    // Nová metoda pro strategické hodnocení útočníka
    evaluateAttackerStrategically(attacker, opponent) {
        let value = attacker.attack;
        
        // Bonus podle strategie
        switch (this.strategy) {
            case 'aggressive':
                value += attacker.attack * 0.5;
                // Preferuj rychlé jednotky
                if (attacker.attack > attacker.health) value += 2;
                break;
                
            case 'defensive':
                // V defenzivě útočíme jen když musíme
                value -= 2;
                if (attacker.hasTaunt) value -= 1; // Taunt jednotky raději necháváme
                break;
                
            case 'control':
                // Kontrolní útok - odstraň hrozby
                const threateningTargets = opponent.field.filter(unit => 
                    unit && (unit.attack >= 4 || unit.effect.includes('at the end of your turn'))
                );
                if (threateningTargets.some(target => attacker.attack >= target.health)) {
                    value += 5;
                }
                break;
                
            case 'tempo':
                // Tempo - efektivní výměny
                value += this.calculateTempoValue(attacker, opponent);
                break;
        }
        
        return value;
    }

    // Pomocná metoda pro výpočet tempo hodnoty
    calculateTempoValue(attacker, opponent) {
        let tempoValue = 0;
        
        opponent.field.forEach(target => {
            if (target && attacker.attack >= target.health) {
                // Můžeme zabít cíl
                const tradeCost = attacker.health <= target.attack ? attacker.attack + attacker.health : 0;
                const tradeGain = target.attack + target.health;
                tempoValue += Math.max(0, tradeGain - tradeCost);
            }
        });
        
        return tempoValue;
    }

    // Nová metoda pro strategické rozhodnutí o útoku
    makeStrategicAttackDecision(attacker, opponent) {
        const validTargets = opponent.field.filter(unit => unit !== null);
        const canAttackHero = !opponent.field.some(unit => unit && unit.hasTaunt);
        
        // Podle strategie rozhodni
        switch (this.strategy) {
            case 'aggressive':
                // Agresivní: útočit na hrdinu pokud možno
                if (canAttackHero) {
                    return { isHeroTarget: true };
                }
                break;
                
            case 'defensive':
                // Defenzivní: útočit jen na hrozby
                const threats = validTargets.filter(target => 
                    target.attack >= 4 || target.effect.includes('at the end of your turn')
                );
                if (threats.length > 0) {
                    const bestThreat = this.findBestStrategicTarget(attacker, threats);
                    if (bestThreat && this.isGoodTrade(attacker, bestThreat)) {
                        return { target: bestThreat };
                    }
                }
                return { isHeroTarget: false }; // Neútočit
                
            case 'control':
                // Kontrolní: odstraň největší hrozby
                if (validTargets.length > 0) {
                    const bestTarget = this.findBestStrategicTarget(attacker, validTargets);
                    if (bestTarget && this.isGoodTrade(attacker, bestTarget)) {
                        return { target: bestTarget };
                    }
                }
                break;
                
            case 'tempo':
                // Tempo: nejefektivnější výměna nebo face damage
                if (validTargets.length > 0) {
                    const bestTarget = this.findBestStrategicTarget(attacker, validTargets);
                    if (bestTarget && this.isGoodTrade(attacker, bestTarget)) {
                        return { target: bestTarget };
                    }
                }
                if (canAttackHero) {
                    return { isHeroTarget: true };
                }
                break;
        }
        
        // Fallback: útok na hrdinu pokud možno
        return canAttackHero ? { isHeroTarget: true } : { isHeroTarget: false };
    }

    // Vylepšená metoda pro hledání nejlepšího strategického cíle
    findBestStrategicTarget(attacker, targets) {
        if (!targets || targets.length === 0) return null;
        
        return targets.reduce((best, current) => {
            if (!best) return current;
            if (!current) return best;
            
            const bestScore = this.calculateTargetScore(attacker, best);
            const currentScore = this.calculateTargetScore(attacker, current);
            
            return currentScore > bestScore ? current : best;
        }, null);
    }

    // Nová metoda pro výpočet skóre cíle
    calculateTargetScore(attacker, target) {
        let score = 0;
        
        // Základní skóre podle stats
        score += target.attack + target.health;
        
        // Bonus za zabití cíle
        if (attacker.attack >= target.health) {
            score += 5;
            
            // Extra bonus pokud přežijeme
            if (attacker.health > target.attack) {
                score += 3;
            }
        }
        
        // Bonus za důležité efekty
        if (target.effect.includes('at the end of your turn')) score += 4;
        if (target.effect.includes('when you cast a spell')) score += 3;
        if (target.hasTaunt) score += 2;
        if (target.hasDivineShield) score += 2;
        
        // Strategické bonusy
        switch (this.strategy) {
            case 'aggressive':
                // Preferuj slabší cíle pro rychlé zabití
                if (target.health <= 3) score += 2;
                break;
                
            case 'control':
                // Preferuj silné hrozby
                if (target.attack >= 4) score += 3;
                break;
        }
        
        return score;
    }

    evaluateCard(card) {
        if (card instanceof SpellCard) {
            return this.evaluateSpell(card);
        }

        // Základní hodnota stats
        let value = card.attack + card.health;
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];

        // Kontextové hodnocení podle fáze hry
        value += this.evaluateCardByGamePhase(card);
        
        // Strategické hodnocení
        value += this.evaluateCardByStrategy(card);
        
        // Hodnocení synergií
        value += this.evaluateCardSynergies(card);
        
        // Speciální taktiky pro konkrétní karty
        value += this.evaluateSpecialCardTactics(card);

        // Základní hodnota podle efektů (snížené bonusy pro lepší balance)
        if (card.hasTaunt) value += this.strategy === 'defensive' ? 3 : 1;
        if (card.hasDivineShield) value += 2;
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
                if (card.name === 'Armored Elephant') value += 3;
                if (card.name === 'Holy Elemental') value += 2;
                if (card.name === 'Divine Healer') value += 4;
                if (card.name === 'Friendly Spirit') value += 2;
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

    // Nová metoda pro hodnocení podle fáze hry
    evaluateCardByGamePhase(card) {
        let bonus = 0;
        
        switch (this.gamePhase) {
            case 'early':
                // V raných fázích preferujeme nízko-cost karty s dobrými stats
                if (card.manaCost <= 3) bonus += 2;
                if (card.attack >= card.manaCost) bonus += 1;
                if (card.effect.includes('Draw')) bonus += 2;
                break;
                
            case 'mid':
                // Ve střední fázi preferujeme tempo a value
                if (card.manaCost >= 3 && card.manaCost <= 6) bonus += 1;
                if (card.attack + card.health >= card.manaCost * 2) bonus += 2;
                if (card.hasTaunt) bonus += 1;
                break;
                
            case 'late':
                // V pozdní fázi preferujeme immediate impact a léčení
                if (card.effect.includes('Deal damage')) bonus += 3;
                if (card.effect.includes('restore') || card.effect.includes('heal')) bonus += 3;
                if (card.hasTaunt && card.health >= 5) bonus += 2;
                if (card.manaCost >= 6) bonus += 1;
                break;
        }
        
        return bonus;
    }
    
    // Nová metoda pro hodnocení podle strategie
    evaluateCardByStrategy(card) {
        let bonus = 0;
        
        switch (this.strategy) {
            case 'aggressive':
                bonus += card.attack * 0.5;
                if (card.attack > card.health) bonus += 1;
                if (card.effect.includes('damage')) bonus += 2;
                if (card.hasTaunt) bonus -= 1; // Taunt není pro agro
                break;
                
            case 'defensive':
                bonus += card.health * 0.3;
                if (card.hasTaunt) bonus += 3;
                if (card.effect.includes('restore') || card.effect.includes('heal')) bonus += 3;
                if (card.hasDivineShield) bonus += 2;
                break;
                
            case 'control':
                if (card.effect.includes('Deal damage to all')) bonus += 4;
                if (card.effect.includes('Draw')) bonus += 3;
                if (card.manaCost >= 5) bonus += 1;
                if (card.effect.includes('remove') || card.effect.includes('destroy')) bonus += 3;
                break;
                
            case 'tempo':
                if (card.attack + card.health >= card.manaCost * 2) bonus += 2;
                if (card.effect.includes('when played')) bonus += 1;
                if (card.manaCost >= 2 && card.manaCost <= 5) bonus += 1;
                break;
        }
        
        return bonus;
    }
    
    // Nová metoda pro hodnocení synergií
    evaluateCardSynergies(card) {
        let bonus = 0;
        const player = this.gameState.players[this.playerIndex];
        
        // Synergies se jménem karet na poli
        const fieldNames = player.field.filter(unit => unit).map(unit => unit.name);
        
        // Spell synergies
        if (card.effect.includes('cast a spell')) {
            const spellsInHand = player.hand.filter(c => c instanceof SpellCard).length;
            bonus += spellsInHand * 1.5;
        }
        
        // Death synergies
        if (card.effect.includes('any minion dies') || card.name === 'Soul Harvester') {
            // Více jednotek = více úmrtí = větší hodnota
            bonus += (player.field.filter(unit => unit).length + 
                     this.gameState.players[1 - this.playerIndex].field.filter(unit => unit).length) * 0.5;
        }
        
        // Healing synergies pro Priest
        if (this.deckType === 2 && card.effect.includes('restore')) {
            if (fieldNames.includes('Spirit Healer')) bonus += 2;
        }
        
        // Mana synergies pro Seer
        if (this.deckType === 3) {
            if (card.name === 'Mana Wyrm' && player.hand.some(c => c instanceof SpellCard)) bonus += 2;
            if (card.name === 'Arcane Familiar' && player.hand.some(c => c instanceof SpellCard)) bonus += 2;
        }
        
        // Taunt synergies
        if (card.name === 'Guardian Totem') {
            const adjacentUnits = this.countPotentialAdjacentUnits(player);
            bonus += adjacentUnits * 1.5;
        }
        
        return bonus;
    }
    
    // Pomocná metoda pro počítání sousedních jednotek
    countPotentialAdjacentUnits(player) {
        const unitsOnField = player.field.filter(unit => unit).length;
        // Maximálně 2 sousedi (vlevo a vpravo)
        return Math.min(unitsOnField, 2);
    }
    
    // Speciální taktiky pro konkrétní karty
    evaluateSpecialCardTactics(card) {
        let bonus = 0;
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[1 - this.playerIndex];
        const playerHealth = player.hero.health;
        const opponentHealth = opponent.hero.health;
        const spellsInHand = player.hand.filter(c => c instanceof SpellCard).length;
        const unitsOnField = player.field.filter(unit => unit).length;
        const opponentUnits = opponent.field.filter(unit => unit).length;
        
        switch (card.name) {
            // === SPELL SYNERGY KARTY ===
            case 'Arcane Familiar':
            case 'Mana Wyrm':
                // Vyšší hodnota pokud máme kouzla v ruce
                bonus += spellsInHand * 2;
                // Bonus pokud plánujeme hrát kouzla tento tah
                if (spellsInHand > 0 && player.mana >= card.manaCost + 2) bonus += 3;
                break;
                
            case 'Battle Mage':
                // Velmi vysoká hodnota pokud máme levná kouzla
                const cheapSpells = player.hand.filter(c => c instanceof SpellCard && c.manaCost <= 3).length;
                bonus += cheapSpells * 3;
                if (cheapSpells >= 2) bonus += 5; // Extra bonus za combo potenciál
                break;
                
            case 'Spell Weaver':
                // Hodnota roste s počtem kouzel v ruce
                bonus += spellsInHand * 1.5;
                if (spellsInHand >= 3) bonus += 4; // Bonus za silný efekt
                break;
                
            // === DEFENSIVE KARTY ===
            case 'Shield Bearer':
            case 'Stone Guardian':
            case 'Sacred Defender':
                // Vyšší hodnota pokud potřebujeme obranu
                if (playerHealth < 20) bonus += 2;
                if (playerHealth < 15) bonus += 3;
                if (opponent.field.some(unit => unit && unit.attack >= 4)) bonus += 3;
                break;
                
            case 'Crystal Guardian':
                // Extra bonus za Divine Shield + Taunt kombinaci
                bonus += 3;
                if (playerHealth < 15) bonus += 4; // Healing efekt je cenný
                break;
                
            // === HEALING KARTY ===
            case 'Spirit Healer':
            case 'Life Drainer':
            case 'Healing Sentinel':
                // Vyšší hodnota pokud máme nízké zdraví
                if (playerHealth < 20) bonus += 3;
                if (playerHealth < 15) bonus += 5;
                if (playerHealth < 10) bonus += 8;
                break;
                
            case 'Holy Elemental':
            case 'Divine Healer':
                // Immediate healing je cenné při nízkém zdraví
                if (playerHealth < 15) bonus += 4;
                if (playerHealth < 10) bonus += 6;
                break;
                
            // === CARD DRAW KARTY ===
            case 'Nimble Sprite':
            case 'Wise Oracle':
            case 'Spell Seeker':
                // Vyšší hodnota pokud máme málo karet
                if (player.hand.length <= 3) bonus += 4;
                if (player.hand.length <= 2) bonus += 6;
                if (player.hand.length <= 1) bonus += 8;
                break;
                
            // === MANA MANIPULATION ===
            case 'Mana Crystal':
            case 'Mana Collector':
            case 'Mana Siphon':
                // Vyšší hodnota v early/mid game pro ramp
                if (this.gamePhase === 'early' || this.gamePhase === 'mid') bonus += 3;
                if (player.maxMana < 7) bonus += 2; // Ramp je důležitý před late game
                break;
                
            case 'Mana Leech':
                // Silná karta pro late game
                if (this.gamePhase === 'late') bonus += 4;
                if (player.mana >= 6) bonus += 3;
                break;
                
            // === FREEZE KARTY ===
            case 'Water Elemental':
            case 'Frost Knight':
            case 'Freezing Dragon':
                // Vyšší hodnota proti silným jednotkám
                const strongEnemies = opponent.field.filter(unit => unit && unit.attack >= 4).length;
                bonus += strongEnemies * 2;
                if (opponent.field.some(unit => unit && unit.attack >= 6)) bonus += 3;
                break;
                
            // === DIVINE SHIELD SYNERGY ===
            case 'Divine Squire':
            case 'Spirit Guardian':
                // Bonus pokud máme Divine Shield support
                if (player.hand.some(c => c.name === 'Divine Formation')) bonus += 3;
                if (player.field.some(unit => unit && unit.hasDivineShield)) bonus += 2;
                break;
                
            case 'Twilight Guardian':
                // Vyšší hodnota pokud máme jednotky bez Divine Shield
                const unitsWithoutDS = player.field.filter(unit => unit && !unit.hasDivineShield).length;
                bonus += unitsWithoutDS * 1.5;
                break;
                
            // === COMBO KARTY ===
            case 'Mind Mimic':
            case 'Mirror Entity':
                // Vyšší hodnota pokud má soupeř dobré karty
                if (opponent.hand.length >= 3) bonus += 2;
                if (opponent.field.some(unit => unit && unit.attack + unit.health >= 8)) bonus += 3;
                break;
                
            case 'Legion Commander':
                // Finisher karta - vyšší hodnota v late game
                if (this.gamePhase === 'late') bonus += 5;
                if (player.field.length <= 2) bonus += 4; // Potřebujeme místo na poli
                break;
                
            // === SITUAČNÍ KARTY ===
            case 'Elendralis':
                // Bonus pokud máme nízké zdraví (aktivuje efekt)
                if (playerHealth < 10) bonus += 6;
                if (playerHealth < 15) bonus += 3;
                break;
                
            case 'Divine Protector':
                // Bonus pokud máme plné zdraví
                if (playerHealth >= 30) bonus += 4;
                break;
                
            case 'Pride Hunter':
                // Bonus pokud má soupeř plné zdraví
                if (opponentHealth >= 30) bonus += 3;
                break;
                
            case 'Silence Assassin':
                // Vyšší hodnota proti Taunt jednotkám
                if (opponent.field.some(unit => unit && unit.hasTaunt)) bonus += 5;
                break;
                
            // === REMOVAL SPELLS ===
            case 'Death Touch':
            case 'Polymorph Wave':
                // Vyšší hodnota pokud má soupeř silné jednotky
                if (opponent.field.some(unit => unit && unit.attack + unit.health >= 8)) bonus += 5;
                if (opponentUnits >= 3) bonus += 3; // AoE je lepší proti více jednotkám
                break;
                
            case 'Mass Dispel':
                // Vyšší hodnota pokud má soupeř Taunt jednotky
                const tauntUnits = opponent.field.filter(unit => unit && unit.hasTaunt).length;
                bonus += tauntUnits * 3;
                break;
                
            // === LEGENDARY FINISHERS ===
            case 'Ancient Colossus':
                // Hodnota klesá s cenou (více mrtvých jednotek = levnější)
                const deadMinions = this.gameState.deadMinionsCount || 0;
                const actualCost = Math.max(1, 20 - deadMinions);
                if (actualCost <= player.mana) bonus += 8;
                if (actualCost <= 10) bonus += 4;
                break;
                
            case 'Time Weaver':
                // Silný late game finisher
                if (this.gamePhase === 'late') bonus += 6;
                if (playerHealth < 20) bonus += 3; // Healing efekt
                break;
                
            case 'Sacred Dragon':
                // Ultimate healing finisher
                if (playerHealth < 15) bonus += 10;
                if (this.gamePhase === 'late') bonus += 5;
                break;
        }
        
        return bonus;
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
                const damage = 8;
                
                // Nejdřív zkontrolujeme, zda bychom nezabili sami sebe
                if (player.hero.health <= damage) {
                    return -999; // Nikdy nechceme zahrát kouzlo, které nás zabije
                }

                // Zkontrolujeme, zda zabijeme protivníka
                if (opponent.hero.health <= damage) {
                    return 100; // Vysoká hodnota pro vítězný tah
                }

                // Spočítáme kolik našich jednotek by zemřelo
                const ourDeadUnits = player.field.filter(unit => 
                    unit && unit.health <= damage && !unit.hasDivineShield
                ).length;

                // Spočítáme kolik nepřátelských jednotek by zemřelo
                const enemyDeadUnits = opponent.field.filter(unit => 
                    unit && unit.health <= damage && !unit.hasDivineShield
                ).length;

                // Základní hodnota podle rozdílu zabitých jednotek
                value = (enemyDeadUnits - ourDeadUnits) * 5;

                // Přidáme bonus pokud máme výrazně více životů než soupeř
                if (player.hero.health - damage > opponent.hero.health - damage + 10) {
                    value += 5;
                }

                // Snížíme hodnotu pokud bychom ztratili moc životů
                if (player.hero.health - damage < 10) {
                    value -= 10;
                }

                // Snížíme hodnotu pokud bychom ztratili důležité jednotky
                const losingImportantUnits = player.field.some(unit => 
                    unit && unit.health <= damage && !unit.hasDivineShield && (
                        unit.attack >= 4 ||
                        unit.effect.includes('at the end of your turn') ||
                        unit.name === 'Time Weaver' ||
                        unit.name === 'Mana Collector'
                    )
                );
                if (losingImportantUnits) {
                    value -= 15;
                }

                // Zvýšíme hodnotu pokud jsme v nevýhodné pozici na poli
                if (enemyDeadUnits > 2 && ourDeadUnits <= 1) {
                    value += 10;
                }

                // Pokud je výsledná hodnota příliš nízká, raději kouzlo nehrajeme
                return value < -5 ? -999 : value;
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

            case 'Magic Arrows':
                // Hodnota kouzla závisí na stavu hry
                value = 3; // Základní hodnota za 3 poškození

                // Vyšší hodnota pokud může zabít nějaké jednotky
                weakUnits = opponent.field.filter(unit => 
                    unit && unit.health <= 1
                ).length;
                value += weakUnits * 2;

                // Vyšší hodnota pokud může zabít protivníka
                if (opponent.hero.health <= 3) {
                    value += 5;
                }

                // Nižší hodnota v pozdní hře
                if (player.maxMana >= 7) {
                    value -= 2;
                }

                return value;

            case 'Divine Formation':
                const divineShieldUnits = player.field.filter(unit => 
                    unit && unit.hasDivineShield && !unit.hasTaunt
                ).length;
                value = divineShieldUnits * 2;
                // Extra hodnota pokud máme málo životů a potřebujeme obranu
                if (player.hero.health < 15) value += 2;
                break;

            case 'Mass Dispel':
                const totalTaunts = [...player.field, ...opponent.field].filter(
                    unit => unit && unit.hasTaunt
                ).length;
                value = totalTaunts * 2;
                // Extra hodnota pokud jsme blokováni Tauntem
                if (opponent.field.some(unit => unit && unit.hasTaunt)) {
                    value += 3;
                }
                break;
                
            case 'Frostbolt':
                // Hodnotnější pokud může zmrazit silnou jednotku
                const strongTargets = opponent.field.filter(unit => 
                    unit && unit.attack >= 4
                ).length;
                value = strongTargets > 0 ? 4 : 2;
                // Bonus pokud může zabít jednotku
                if (opponent.field.some(unit => unit && unit.health <= 3)) {
                    value += 2;
                }
                break;
                
            case 'Shield Breaker':
                // Hodnotnější pokud má soupeř Divine Shield jednotky
                const divineShieldEnemies = opponent.field.filter(unit => 
                    unit && unit.hasDivineShield
                ).length;
                if (divineShieldEnemies === 0) return -1;
                value = divineShieldEnemies * 3;
                // Bonus za healing
                if (player.hero.health < 20) value += 2;
                break;
                
            case 'Mind Theft':
            case 'Mind Copy':
                // Hodnotnější pokud má soupeř více karet
                if (opponent.hand.length < 2) return -1;
                value = opponent.hand.length;
                // Bonus v late game kdy karty jsou cennější
                if (this.gamePhase === 'late') value += 2;
                break;
                
            case 'Holy Strike':
                // Kombinuje damage a healing
                value = 3; // Základní hodnota
                // Bonus pokud může zabít jednotku
                if (opponent.field.some(unit => unit && unit.health <= 2)) {
                    value += 2;
                }
                // Bonus pokud potřebujeme healing
                if (player.hero.health < 20) value += 2;
                break;
                
            case 'Source Healing':
                // Healing podle počtu jednotek na poli
                const totalUnits = player.field.filter(unit => unit).length + 
                                 opponent.field.filter(unit => unit).length;
                const missingHP = 30 - player.hero.health;
                if (missingHP < 3) return -1; // Neléčit pokud není potřeba
                value = Math.min(totalUnits, missingHP) * 0.5;
                // Bonus pokud jsme v ohrožení
                if (player.hero.health < 15) value += 3;
                break;
                
            case 'Unity Strike':
                // Damage podle počtu našich jednotek
                const friendlyUnits = player.field.filter(unit => unit).length;
                if (friendlyUnits === 0) return -1;
                value = friendlyUnits * 1.5;
                // Bonus pokud může zabít protivníka
                if (opponent.hero.health <= friendlyUnits) {
                    value += 10;
                }
                break;
                
            case 'Battle Cry':
                // Buff všech jednotek
                const buffableUnitsCount = player.field.filter(unit => unit).length;
                if (buffableUnitsCount === 0) return -1;
                value = buffableUnitsCount * 2;
                // Bonus pokud plánujeme útočit
                if (this.strategy === 'aggressive') value += 2;
                break;
                
            case 'Polymorph Wave':
                // AoE transform - hodnotnější proti silným jednotkám
                const strongEnemyUnits = opponent.field.filter(unit => 
                    unit && unit.attack + unit.health >= 6
                ).length;
                if (strongEnemyUnits === 0) return -1;
                value = strongEnemyUnits * 4;
                // Malus pokud máme silné jednotky
                const ourStrongUnits = player.field.filter(unit => 
                    unit && unit.attack + unit.health >= 6
                ).length;
                value -= ourStrongUnits * 2;
                break;
                
            case 'Mana Fusion':
                // Overload kouzlo - použít jen pokud máme drahé karty
                const expensiveCards = player.hand.filter(c => 
                    c.manaCost > player.mana + 2
                ).length;
                if (expensiveCards === 0) return -1;
                value = expensiveCards * 2;
                // Malus pokud už máme overload
                if (player.overload && player.overload > 0) value -= 5;
                break;
                
            case 'Soothing Return':
                // Return + healing
                if (opponent.field.length === 0) return -1;
                // Prioritizovat silné jednotky
                const strongestEnemy = Math.max(...opponent.field
                    .filter(unit => unit)
                    .map(unit => unit.attack + unit.health));
                value = strongestEnemy >= 6 ? 4 : 2;
                // Bonus za healing
                if (player.hero.health < 20) value += 2;
                break;
                
            case 'Death Touch':
                // Destroy spell - hodnotnější proti silným jednotkám
                if (opponent.field.length === 0) return -1;
                const strongestEnemyUnit = Math.max(...opponent.field
                    .filter(unit => unit)
                    .map(unit => unit.attack + unit.health));
                value = strongestEnemyUnit >= 6 ? 6 : 3;
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
        // Pro čistě obranné jednotky (0 útok)
        if (attacker.attack === 0) {
            return this.hasDeathEffectSynergy(this.gameState.players[this.playerIndex]);
        }
        
        // Pro Taunt jednotky s nízkým útokem
        if (attacker.hasTaunt && attacker.attack <= 1) {
            // Povolíme výměnu pokud:
            // 1. Máme death effect synergii
            if (this.hasDeathEffectSynergy(this.gameState.players[this.playerIndex])) return true;
            
            // 2. Můžeme zabít jednotku a přežít
            if (attacker.attack >= target.health && attacker.health > target.attack) return true;
            
            // 3. Cíl má 1 život (můžeme ho zabít)
            if (target.health <= attacker.attack) return true;
            
            return false;
        }

        // Původní logika pro ostatní jednotky
        // 1. Zabijeme jednotku a přežijeme
        if (attacker.attack >= target.health && attacker.health > target.attack) {
            return true;
        }

        // 2. Zabijeme silnější nebo stejně silnou jednotku
        if (attacker.attack >= target.health && 
            (target.attack + target.health >= attacker.attack + attacker.health)) {
            return true;
        }

        // 3. Zabijeme jednotku s důležitým efektem
        if (attacker.attack >= target.health && (
            target.hasTaunt || 
            target.effect.includes('at the end of your turn') ||
            target.effect.includes('when you cast a spell') ||
            target.attack >= 4 ||
            target.effect.includes('Divine Shield')
        )) {
            return true;
        }

        // 4. Máme Divine Shield a je výhodné ho použít
        if (attacker.hasDivineShield && (
            target.attack >= 2 || // Stojí za to použít Divine Shield
            target.health <= attacker.attack // Můžeme zabít cíl
        )) {
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

            // Seřadíme cíle podle priority
            return targets.reduce((best, current) => {
                if (!best) return current;
                if (!current) return best;

                // Pokud je útočník obranná jednotka, vracíme null
                if (attacker.attack === 0 || (attacker.hasTaunt && attacker.attack <= 1)) {
                    const hasDeathEffectSynergy = this.gameState.players[this.playerIndex].field.some(unit => 
                        unit && unit.effect && (
                            unit.effect.includes('any minion dies') ||
                            unit.name === 'Soul Harvester' ||
                            unit.name === 'Blood Cultist'
                        )
                    );
                    
                    if (!hasDeathEffectSynergy) {
                        return null;
                    }
                }
                
                // Prioritizujeme cíle, které můžeme zabít
                const canKillCurrent = attacker.attack >= current.health;
                const canKillBest = attacker.attack >= best.health;
                
                if (canKillCurrent !== canKillBest) {
                    return canKillCurrent ? current : best;
                }
                
                // Prioritizujeme nebezpečnější jednotky
                const currentThreat = this.evaluateUnitThreat(current);
                const bestThreat = this.evaluateUnitThreat(best);
                
                if (currentThreat !== bestThreat) {
                    return currentThreat > bestThreat ? current : best;
                }

                // Při stejné hodnotě hrozby preferujeme slabší jednotky
                return current.health < best.health ? current : best;
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

    // Přidáme novou metodu pro hodnocení hrozby jednotky
    evaluateUnitThreat(unit) {
        let threat = unit.attack;
        
        // Přidáme hodnotu za speciální efekty
        if (unit.effect.includes('at the end of your turn')) threat += 3;
        if (unit.effect.includes('when you cast a spell')) threat += 2;
        if (unit.hasDivineShield) threat += 2;
        if (unit.hasTaunt) threat += 1;
        if (unit.effect.includes('Draw')) threat += 2;
        
        return threat;
    }

    // Přidáme novou pomocnou metodu pro kontrolu death efektů
    hasDeathEffectSynergy(player) {
        return player.field.some(unit => 
            unit && unit.effect && (
                unit.effect.includes('any minion dies') ||
                unit.name === 'Soul Harvester' ||
                unit.name === 'Blood Cultist'
            )
        );
    }
}

module.exports = AIPlayer; 