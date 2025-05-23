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

            // Vrátíme JEDEN nejlepší útok místo procházení všech útočníků
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