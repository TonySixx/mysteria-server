const { playCardCommon, useHeroAbility } = require('./gameLogic');
const { attack } = require('./combatLogic');

class AIPlayer {
    constructor(gameState, playerIndex) {
        this.gameState = gameState;
        this.playerIndex = playerIndex;
        this.opponentIndex = 1 - playerIndex;
        
        // Určíme typ hrdiny a deck archetype pro strategické rozhodování
        this.heroType = this.determineHeroType();
        this.deckArchetype = this.determineDeckArchetype();
        this.gamePhase = this.determineGamePhase();
        
        // Analyzujeme balíček pro lepší strategické rozhodování
        this.deckAnalysis = this.analyzeDeck();
        
        // Konstanty pro hodnocení
        this.LETHAL_PRIORITY = 10000;
        this.THREAT_REMOVAL_PRIORITY = 1000;
        this.VALUE_TRADE_PRIORITY = 500;
        this.TEMPO_PLAY_PRIORITY = 300;
        this.FACE_DAMAGE_PRIORITY = 200;
        
        // Debugging
        this.debugMode = false;
    }

    /**
     * Hlavní metoda pro rozhodování AI - zachovává interface pro GameManager
     */
    async makeMove() {
        try {
            // Simulujeme "přemýšlení" AI
            await new Promise(resolve => setTimeout(resolve, 1300));

            const startTime = Date.now();
            const maxThinkTime = 3000; // 3 sekundy max
            
            this.log("=== AI TURN START ===");
            this.log(`Game phase: ${this.gamePhase}, Hero: ${this.heroType}, Archetype: ${this.deckArchetype}`);
            
            // 1. Kontrola lethal možností
            const lethalMove = this.findLethalSequence();
            if (lethalMove) {
                this.log("LETHAL FOUND!", lethalMove);
                return lethalMove;
            }
            
            // 2. Najdi nejlepší kombinaci akcí
            const bestMove = this.findOptimalMove(maxThinkTime - (Date.now() - startTime));
            
            this.log("Selected move:", bestMove);
            this.log("=== AI TURN END ===");
            
            return bestMove;
            
        } catch (error) {
            console.error("AI Error:", error);
            // Fallback na jednoduchý tah
            return this.makeSimpleFallbackMove();
        }
    }

    /**
     * Najde optimální kombinaci akcí pro tento tah
     */
    findOptimalMove(timeLimit) {
        const player = this.gameState.players[this.playerIndex];
        const possibleActions = this.generatePossibleActions();
        
        if (possibleActions.length === 0) {
            return { type: 'endTurn' };
        }
        
        let bestAction = null;
        let bestScore = -Infinity;
        
        // Hodnotíme každou možnou akci
        for (const action of possibleActions) {
            const score = this.evaluateAction(action);
            
            if (score > bestScore) {
                bestScore = score;
                bestAction = action;
            }
            
            // Kontrola časového limitu
            if (Date.now() > timeLimit) {
                break;
            }
        }
        
        return bestAction || { type: 'endTurn' };
    }

    /**
     * Generuje všechny možné akce pro tento tah
     */
    generatePossibleActions() {
        const actions = [];
        const player = this.gameState.players[this.playerIndex];
        
        // 1. Zahrání karet
        for (let i = 0; i < player.hand.length; i++) {
            const card = player.hand[i];
            if (card.manaCost <= player.mana) {
                if (card.type === 'unit') {
                    // Najdi možné pozice na boardu
                    for (let pos = 0; pos <= player.field.length && pos < 7; pos++) {
                        actions.push({
                            type: 'playCard',
                            cardIndex: i,
                            destinationIndex: pos,
                            priority: this.calculateCardPlayPriority(card)
                        });
                    }
                } else if (card.type === 'spell') {
                    // Pro kouzla určíme nejlepší target
                    const targets = this.findSpellTargets(card);
                    for (const target of targets) {
                        actions.push({
                            type: 'playCard',
                            cardIndex: i,
                            target: target,
                            priority: this.calculateSpellPriority(card, target)
                        });
                    }
                } else if (card.type === 'secret') {
                    actions.push({
                        type: 'playCard',
                        cardIndex: i,
                        priority: this.calculateSecretPriority(card)
                    });
                }
            }
        }
        
        // 2. Útoky jednotek
        for (let i = 0; i < player.field.length; i++) {
            const unit = player.field[i];
            if (unit && !unit.hasAttacked && !unit.frozen) {
                const attackTargets = this.findAttackTargets(unit, i);
                for (const target of attackTargets) {
                    actions.push({
                        type: 'attack',
                        attackerIndex: i,
                        targetIndex: target.index,
                        isHeroTarget: target.isHero,
                        priority: this.calculateAttackPriority(unit, target)
                    });
                }
            }
        }
        
        // 3. Hrdinská schopnost
        if (!player.hero.hasUsedAbility && player.mana >= player.hero.abilityCost) {
            actions.push({
                type: 'heroAbility',
                priority: this.calculateHeroAbilityPriority()
            });
        }
        
        // 4. Ukončení tahu
        actions.push({
            type: 'endTurn',
            priority: this.calculateEndTurnPriority()
        });
        
        // Seřadíme podle priority
        return actions.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Hledá lethal sekvenci akcí
     */
    findLethalSequence() {
        const opponent = this.gameState.players[this.opponentIndex];
        const player = this.gameState.players[this.playerIndex];
        
        // Spočítáme dostupný damage
        let totalDamage = 0;
        let requiredMana = 0;
        const actions = [];
        
        // Damage z jednotek na boardu
        for (let i = 0; i < player.field.length; i++) {
            const unit = player.field[i];
            if (unit && !unit.hasAttacked && !unit.frozen) {
                // Kontrola zda můžeme útočit na hrdinu (taunt check)
                if (this.canAttackHero(unit, i)) {
                    totalDamage += unit.attack;
                    actions.push({
                        type: 'attack',
                        attackerIndex: i,
                        targetIndex: 0,
                        isHeroTarget: true
                    });
                }
            }
        }
        
        // Damage z kouzel v ruce
        for (let i = 0; i < player.hand.length; i++) {
            const card = player.hand[i];
            if (card.type === 'spell') {
                const damage = this.getSpellDamageToHero(card);
                if (damage > 0 && requiredMana + card.manaCost <= player.mana) {
                    totalDamage += damage;
                    requiredMana += card.manaCost;
                    actions.push({
                        type: 'playCard',
                        cardIndex: i,
                        target: { isHero: true }
                    });
                }
            }
        }
        
        // Damage z hrdinské schopnosti
        if (!player.hero.hasUsedAbility && 
            requiredMana + player.hero.abilityCost <= player.mana) {
            const heroDamage = this.getHeroAbilityDamage();
            if (heroDamage > 0) {
                totalDamage += heroDamage;
                actions.push({ type: 'heroAbility' });
            }
        }
        
        // Kontrola zda máme lethal
        if (totalDamage >= opponent.hero.health) {
            this.log(`LETHAL DETECTED: ${totalDamage} damage vs ${opponent.hero.health} health`);
            return actions[0]; // Vrátíme první akci v sekvenci
        }
        
        return null;
    }

    /**
     * Hodnotí kvalitu akce
     */
    evaluateAction(action) {
        let score = action.priority || 0;
        
        // Simulujeme akci a hodnotíme výsledný stav
        const simulatedState = this.simulateAction(action);
        if (simulatedState) {
            const stateScore = this.evaluateGameState(simulatedState);
            score += stateScore;
        }
        
        return score;
    }

    /**
     * Simuluje provedení akce a vrátí nový stav hry
     */
    simulateAction(action) {
        try {
            // Vytvoříme kopii stavu hry
            const stateCopy = this.deepCopyGameState(this.gameState);
            
            switch (action.type) {
                case 'playCard':
                    return playCardCommon(stateCopy, this.playerIndex, action.cardIndex, action.target, action.destinationIndex);
                case 'attack':
                    return attack(action.attackerIndex, action.targetIndex, action.isHeroTarget, false)(stateCopy);
                case 'heroAbility':
                    return useHeroAbility(stateCopy, this.playerIndex);
                default:
                    return stateCopy;
            }
        } catch (error) {
            this.log("Simulation error:", error);
            return null;
        }
    }

    /**
     * Hodnotí celkový stav hry z pohledu AI
     */
    evaluateGameState(gameState) {
        const player = gameState.players[this.playerIndex];
        const opponent = gameState.players[this.opponentIndex];
        
        let score = 0;
        
        // 1. Health difference
        const healthDiff = player.hero.health - opponent.hero.health;
        score += healthDiff * 10;
        
        // 2. Board control
        const boardScore = this.calculateBoardControl(gameState);
        score += boardScore * 50;
        
        // 3. Hand advantage
        const handDiff = player.hand.length - opponent.hand.length;
        score += handDiff * 20;
        
        // 4. Mana efficiency
        const manaEfficiency = this.calculateManaEfficiency(player);
        score += manaEfficiency * 15;
        
        // 5. Threat assessment
        const threatScore = this.assessThreats(gameState);
        score += threatScore;
        
        // 6. Archetype-specific bonuses
        score += this.getArchetypeBonus(gameState);
        
        return score;
    }

    /**
     * Vypočítá kontrolu nad hrací plochou
     */
    calculateBoardControl(gameState) {
        const player = gameState.players[this.playerIndex];
        const opponent = gameState.players[this.opponentIndex];
        
        let playerValue = 0;
        let opponentValue = 0;
        
        // Hodnotíme jednotky na boardu
        for (const unit of player.field) {
            if (unit) {
                playerValue += this.calculateUnitValue(unit);
            }
        }
        
        for (const unit of opponent.field) {
            if (unit) {
                opponentValue += this.calculateUnitValue(unit);
            }
        }
        
        // Normalizujeme na škálu -100 až +100
        const totalValue = playerValue + opponentValue;
        if (totalValue === 0) return 0;
        
        return ((playerValue - opponentValue) / totalValue) * 100;
    }

    /**
     * Vypočítá hodnotu jednotky
     */
    calculateUnitValue(unit) {
        let value = unit.attack + unit.health;
        
        // Bonusy za speciální schopnosti - rozpoznáváme z effect textu
        if (unit.hasTaunt) value += 2;
        if (unit.hasDivineShield) value += 3;
        if (this.hasEffectKeyword(unit, 'Lifesteal') || this.hasEffectKeyword(unit, 'restore') || this.hasEffectKeyword(unit, 'heal')) value += 2;
        if (this.hasEffectKeyword(unit, 'Windfury') || (unit.effect && unit.effect.includes('attack twice'))) value += unit.attack * 0.5;
        
        // Bonusy za draw effects
        if (this.hasEffectKeyword(unit, 'draw')) value += 1.5;
        
        // Penalty za negative effects
        if (unit.frozen) value *= 0.5;
        if (unit.hasAttacked) value *= 0.8;
        
        return value;
    }

    /**
     * Hodnotí hrozby na boardu
     */
    assessThreats(gameState) {
        const opponent = gameState.players[this.opponentIndex];
        let threatScore = 0;
        
        for (const unit of opponent.field) {
            if (unit) {
                const threat = this.calculateThreatLevel(unit);
                threatScore -= threat; // Negative protože jsou to nepřátelské hrozby
            }
        }
        
        return threatScore;
    }

    /**
     * Vypočítá úroveň hrozby jednotky
     */
    calculateThreatLevel(unit) {
        let threat = unit.attack * 2; // Attack je důležitější než health pro threat
        
        // Vysoká hrozba pro jednotky které rostou
        if (unit.effect && unit.effect.includes('gain')) {
            threat += 10;
        }
        
        // Vysoká hrozba pro jednotky s immediate impact
        if (unit.effect && (unit.effect.includes('damage') || unit.effect.includes('draw'))) {
            threat += 5;
        }
        
        return threat;
    }

    /**
     * Najde možné cíle pro útok
     */
    findAttackTargets(attacker, attackerIndex) {
        const targets = [];
        const opponent = this.gameState.players[this.opponentIndex];
        
        // Kontrola taunt
        const hasTauntUnits = opponent.field.some(unit => unit && unit.hasTaunt);
        
        if (hasTauntUnits) {
            // Můžeme útočit pouze na taunt jednotky
            for (let i = 0; i < opponent.field.length; i++) {
                const unit = opponent.field[i];
                if (unit && unit.hasTaunt) {
                    targets.push({ index: i, isHero: false, unit: unit });
                }
            }
        } else {
            // Můžeme útočit na jakoukoliv jednotku nebo hrdinu
            for (let i = 0; i < opponent.field.length; i++) {
                const unit = opponent.field[i];
                if (unit) {
                    targets.push({ index: i, isHero: false, unit: unit });
                }
            }
            
            // Můžeme útočit na hrdinu
            targets.push({ index: 0, isHero: true, hero: opponent.hero });
        }
        
        return targets;
    }

    /**
     * Vypočítá prioritu útoku
     */
    calculateAttackPriority(attacker, target) {
        let priority = 0;
        
        if (target.isHero) {
            // Útok na hrdinu
            priority = this.FACE_DAMAGE_PRIORITY;
            
            // Bonus pro aggro decky
            if (this.deckArchetype === 'aggro') {
                priority += 100;
            }
            
            // Bonus pokud je protivník low health
            if (target.hero.health <= 10) {
                priority += 200;
            }
        } else {
            // Útok na jednotku - hodnotíme trade
            const tradeValue = this.evaluateTrade(attacker, target.unit);
            priority = this.VALUE_TRADE_PRIORITY + tradeValue;
            
            // Bonus za odstranění vysokých hrozeb
            const threatLevel = this.calculateThreatLevel(target.unit);
            priority += threatLevel;
        }
        
        return priority;
    }

    /**
     * Hodnotí kvalitu trade (výměny jednotek)
     */
    evaluateTrade(attacker, defender) {
        const attackerValue = this.calculateUnitValue(attacker);
        const defenderValue = this.calculateUnitValue(defender);
        
        // Základní trade value
        let tradeValue = defenderValue - attackerValue;
        
        // Pokud náš útočník přežije
        if (attacker.health > defender.attack) {
            tradeValue += attackerValue * 0.5; // Bonus za přežití
        }
        
        // Pokud zabijeme defender jedním útokem
        if (attacker.attack >= defender.health) {
            tradeValue += 20; // Bonus za clean kill
        }
        
        // Penalty za špatné trades
        if (tradeValue < -10) {
            tradeValue -= 50; // Velká penalty za velmi špatný trade
        }
        
        return tradeValue;
    }

    /**
     * Kontroluje zda můžeme útočit na hrdinu
     */
    canAttackHero(attacker, attackerIndex) {
        const opponent = this.gameState.players[this.opponentIndex];
        
        // Kontrola taunt
        return !opponent.field.some(unit => unit && unit.hasTaunt);
    }

    /**
     * Vypočítá damage kouzla na hrdinu
     */
    getSpellDamageToHero(spell) {
        return this.getSpellDamageValue(spell);
    }

    /**
     * Vypočítá damage hrdinské schopnosti
     */
    getHeroAbilityDamage() {
        if (this.heroType === 'mage') return 2; // Fireblast
        return 0;
    }

    /**
     * Vypočítá prioritu zahrání karty
     */
    calculateCardPlayPriority(card) {
        let priority = this.TEMPO_PLAY_PRIORITY;
        const situation = this.analyzeCurrentSituation();
        
        // Base mana efficiency
        const statSum = (card.attack || 0) + (card.health || 0);
        const efficiency = statSum / Math.max(1, card.manaCost);
        priority += efficiency * 20;
        
        // Curve considerations
        if (this.isOnCurve(card)) {
            priority += 50;
        }
        
        // Situational bonuses
        if (this.hasEffectKeyword(card, 'Taunt')) {
            if (situation.isPlayerLowHealth || situation.opponentBoardSize > situation.playerBoardSize) {
                priority += 100; // Taunt je dobrý pro obranu
            }
        }
        
        if (this.hasEffectKeyword(card, 'Divine Shield')) {
            priority += 30; // Divine Shield je obecně dobrý
        }
        
        if (this.hasEffectKeyword(card, 'draw')) {
            if (situation.handSize <= 3) {
                priority += 80; // Card draw při malé ruce
            }
        }
        
        // Archetype bonuses
        if (this.deckArchetype === 'aggro' && (card.attack || 0) > (card.health || 0)) {
            priority += 30;
        }
        
        if (this.deckArchetype === 'control' && this.hasEffectKeyword(card, 'Taunt')) {
            priority += 40;
        }
        
        return priority;
    }

    /**
     * Kontroluje zda je karta "on curve"
     */
    isOnCurve(card) {
        const turn = this.gameState.turn;
        return card.manaCost >= turn - 1 && card.manaCost <= turn + 1;
    }

    /**
     * Vypočítá prioritu hrdinské schopnosti
     */
    calculateHeroAbilityPriority() {
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[this.opponentIndex];
        let priority = 100;
        
        if (this.heroType === 'mage') {
            // Fireblast - 2 damage
            if (opponent.hero.health <= 10) {
                priority += 200; // Vysoká priorita pokud je protivník low
            }
            // Lethal check
            if (opponent.hero.health <= 2) {
                priority += this.LETHAL_PRIORITY;
            }
        } else if (this.heroType === 'priest') {
            // Lesser Heal - 2 health
            if (player.hero.health < player.hero.maxHealth - 2) {
                priority += 150; // Heal pokud potřebujeme
            } else {
                priority = -500; // Záporná priorita pro heal na full health - je to špatný tah
            }
        } else if (this.heroType === 'seer') {
            // Fortune Draw - draw card
            if (player.hand.length <= 3) {
                priority += 200; // Vysoká priorita s málo kartami
            } else if (player.hand.length >= 8) {
                priority = 10; // Nízká priorita s plnou rukou
            } else {
                priority += 100; // Střední priorita
            }
            
            // Bonus pokud máme dobrý balíček
            if (this.deckAnalysis && this.deckAnalysis.utilityCards > 3) {
                priority += 50;
            }
        }
        
        return priority;
    }

    /**
     * Vypočítá prioritu ukončení tahu
     */
    calculateEndTurnPriority() {
        const player = this.gameState.players[this.playerIndex];
        
        // Nízká priorita pokud máme ještě manu a karty k zahrání
        const playableCards = player.hand.filter(card => card.manaCost <= player.mana);
        if (player.mana > 0 && playableCards.length > 0) {
            return 10;
        }
        
        // Střední priorita pokud máme manu ale žádné karty k zahrání
        if (player.mana > 0 && playableCards.length === 0) {
            return 150;
        }
        
        // Vysoká priorita pokud nemáme co dělat
        return 200;
    }

    /**
     * Najde možné cíle pro kouzlo
     */
    findSpellTargets(spell) {
        const targets = [];
        const opponent = this.gameState.players[this.opponentIndex];
        const player = this.gameState.players[this.playerIndex];
        
        // Pro damage kouzla
        if (this.isDamageSpell(spell)) {
            // AoE kouzla nepotřebují specifický cíl
            if (this.isAOESpell(spell)) {
                targets.push({}); // Prázdný target pro AoE
            } else {
                // Single target damage - preferujeme hero pokud je low health
                if (opponent.hero.health <= this.getSpellDamageValue(spell) + 5) {
                    targets.push({ isHero: true, priority: 1000 });
                } else {
                    targets.push({ isHero: true, priority: 200 });
                }
                
                // Nebo vysoké threat jednotky
                for (let i = 0; i < opponent.field.length; i++) {
                    const unit = opponent.field[i];
                    if (unit) {
                        const threatLevel = this.calculateThreatLevel(unit);
                        targets.push({ 
                            isHero: false, 
                            unitIndex: i, 
                            priority: threatLevel + 100 
                        });
                    }
                }
            }
        }
        
        // Pro healing kouzla
        if (this.isHealingSpell(spell)) {
            if (player.hero.health < player.hero.maxHealth) {
                targets.push({ isHero: true, friendly: true });
            }
        }
        
        return targets.length > 0 ? targets : [{}];
    }

    /**
     * Vypočítá prioritu kouzla
     */
    calculateSpellPriority(spell, target) {
        // Základní kontrola zda kouzlo má smysl zahrát
        if (!this.shouldPlaySpell(spell)) {
            return -1000; // Velmi nízká priorita
        }
        
        let priority = this.TEMPO_PLAY_PRIORITY;
        
        // Damage spells
        if (this.isDamageSpell(spell)) {
            const damage = this.getSpellDamageValue(spell);
            
            if (target.isHero) {
                priority = this.FACE_DAMAGE_PRIORITY;
                const opponent = this.gameState.players[this.opponentIndex];
                
                // Lethal check
                if (opponent.hero.health <= damage) {
                    priority += this.LETHAL_PRIORITY;
                } else if (opponent.hero.health <= damage + 5) {
                    priority += 300; // Close to lethal
                }
                
                // Archetype bonus
                if (this.deckArchetype === 'aggro') {
                    priority += 100;
                }
            } else if (target.unitIndex !== undefined) {
                // Targeting enemy unit
                const opponent = this.gameState.players[this.opponentIndex];
                const targetUnit = opponent.field[target.unitIndex];
                if (targetUnit && targetUnit.health <= damage) {
                    priority += this.THREAT_REMOVAL_PRIORITY;
                    priority += this.calculateThreatLevel(targetUnit);
                }
            }
        }
        
        // AoE spells
        if (this.isAOESpell(spell)) {
            const opponent = this.gameState.players[this.opponentIndex];
            const enemyUnits = opponent.field.filter(unit => unit).length;
            if (enemyUnits >= 2) {
                priority += enemyUnits * 100; // Bonus za více cílů
            } else {
                priority -= 200; // Penalty za málo cílů
            }
        }
        
        // Healing spells
        if (this.isHealingSpell(spell)) {
            const player = this.gameState.players[this.playerIndex];
            const healthMissing = player.hero.maxHealth - player.hero.health;
            
            if (healthMissing <= 0) {
                priority = -500; // Velmi špatný tah na full health
            } else if (healthMissing <= 3) {
                priority = -200; // Stále špatný tah při malém damage
            } else {
                priority += healthMissing * 20; // Bonus podle potřeby healu
            }
        }
        
        // Card draw spells
        if (this.hasEffectKeyword(spell, 'draw')) {
            const player = this.gameState.players[this.playerIndex];
            
            if (player.hand.length >= 8) {
                priority = -300; // Špatný tah při plné ruce (overdraw)
            } else if (player.hand.length >= 6) {
                priority -= 100; // Penalty při skoro plné ruce
            } else if (player.hand.length <= 2) {
                priority += 150; // Bonus při malé ruce
            }
        }
        
        return priority;
    }

    /**
     * Vypočítá prioritu tajné karty
     */
    calculateSecretPriority(secret) {
        return this.TEMPO_PLAY_PRIORITY + 50; // Secrets jsou obecně dobré
    }

    /**
     * Vypočítá efektivitu využití many
     */
    calculateManaEfficiency(player) {
        if (player.mana === 0) return 100;
        
        const usedMana = player.maxMana - player.mana;
        return (usedMana / player.maxMana) * 100;
    }

    /**
     * Bonus podle archetypu balíčku
     */
    getArchetypeBonus(gameState) {
        const player = gameState.players[this.playerIndex];
        const opponent = gameState.players[this.opponentIndex];
        
        let bonus = 0;
        
        if (this.deckArchetype === 'aggro') {
            // Bonus za pressure na protivníka
            if (opponent.hero.health < 20) bonus += 50;
            if (player.field.length > opponent.field.length) bonus += 30;
        } else if (this.deckArchetype === 'control') {
            // Bonus za stabilní pozici
            if (player.hero.health > opponent.hero.health) bonus += 30;
            if (player.hand.length > opponent.hand.length) bonus += 40;
        }
        
        return bonus;
    }

    /**
     * Určí typ hrdiny
     */
    determineHeroType() {
        const hero = this.gameState.players[this.playerIndex].hero;
        if (hero.abilityName === 'Fireblast') return 'mage';
        if (hero.abilityName === 'Lesser Heal') return 'priest';
        if (hero.abilityName === 'Fortune Draw') return 'seer';
        return 'unknown';
    }

    /**
     * Určí archetyp balíčku
     */
    determineDeckArchetype() {
        if (!this.deckAnalysis) {
            this.deckAnalysis = this.analyzeDeck();
        }
        
        const analysis = this.deckAnalysis;
        
        // Aggro deck - více damage a agresivních jednotek
        const aggroScore = analysis.damageSpells + analysis.aggressiveUnits;
        
        // Control deck - více healingu, taunts a removal
        const controlScore = analysis.healingSpells + analysis.defensiveUnits + analysis.situationalSpells;
        
        // Utility/combo deck - více card draw a utility
        const utilityScore = analysis.utilityCards + analysis.aoeSpells;
        
        if (aggroScore > controlScore && aggroScore > utilityScore) {
            return 'aggro';
        } else if (controlScore > aggroScore && controlScore > utilityScore) {
            return 'control';
        } else if (utilityScore > aggroScore && utilityScore > controlScore) {
            return 'combo';
        } else {
            return 'midrange';
        }
    }

    /**
     * Určí fázi hry
     */
    determineGamePhase() {
        const turn = this.gameState.turn;
        if (turn <= 3) return 'early';
        if (turn <= 7) return 'mid';
        return 'late';
    }

    /**
     * Vytvoří hlubokou kopii stavu hry pro simulaci
     */
    deepCopyGameState(gameState) {
        return JSON.parse(JSON.stringify(gameState));
    }

    /**
     * Fallback na jednoduchý tah při chybě
     */
    makeSimpleFallbackMove() {
        const player = this.gameState.players[this.playerIndex];
        
        // Zkus zahrát první dostupnou kartu
        for (let i = 0; i < player.hand.length; i++) {
            const card = player.hand[i];
            if (card.manaCost <= player.mana) {
                if (card.type === 'unit') {
                    return {
                        type: 'playCard',
                        cardIndex: i,
                        destinationIndex: player.field.length
                    };
                } else {
                    return {
                        type: 'playCard',
                        cardIndex: i
                    };
                }
            }
        }
        
        // Zkus útočit první dostupnou jednotkou
        for (let i = 0; i < player.field.length; i++) {
            const unit = player.field[i];
            if (unit && !unit.hasAttacked && !unit.frozen) {
                return {
                    type: 'attack',
                    attackerIndex: i,
                    targetIndex: 0,
                    isHeroTarget: true
                };
            }
        }
        
        // Jinak ukonči tah
        return { type: 'endTurn' };
    }

    /**
     * Analyzuje balíček pro strategické rozhodování
     */
    analyzeDeck() {
        const player = this.gameState.players[this.playerIndex];
        const allCards = [...player.hand, ...player.deck];
        
        let analysis = {
            damageSpells: 0,
            healingSpells: 0,
            aoeSpells: 0,
            situationalSpells: 0,
            aggressiveUnits: 0,
            defensiveUnits: 0,
            utilityCards: 0
        };
        
        for (const card of allCards) {
            if (card.type === 'spell') {
                if (this.isDamageSpell(card)) analysis.damageSpells++;
                if (this.isHealingSpell(card)) analysis.healingSpells++;
                if (this.isAOESpell(card)) analysis.aoeSpells++;
                if (this.isSituationalSpell(card)) analysis.situationalSpells++;
            } else if (card.type === 'unit') {
                if ((card.attack || 0) > (card.health || 0)) analysis.aggressiveUnits++;
                if (this.hasEffectKeyword(card, 'Taunt')) analysis.defensiveUnits++;
                if (this.hasEffectKeyword(card, 'draw')) analysis.utilityCards++;
            }
        }
        
        return analysis;
    }

    /**
     * Analyzuje aktuální situaci na boardu
     */
    analyzeCurrentSituation() {
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[this.opponentIndex];
        
        return {
            // Health situation
            isOpponentLowHealth: opponent.hero.health <= 10,
            isPlayerLowHealth: player.hero.health <= 10,
            
            // Board control
            playerBoardSize: player.field.filter(unit => unit).length,
            opponentBoardSize: opponent.field.filter(unit => unit).length,
            
            // Threats
            hasOpponentTaunt: opponent.field.some(unit => unit && this.hasEffectKeyword(unit, 'Taunt')),
            hasOpponentDivineShield: opponent.field.some(unit => unit && this.hasEffectKeyword(unit, 'Divine Shield')),
            opponentThreats: opponent.field.filter(unit => unit && this.calculateThreatLevel(unit) > 10).length,
            
            // Resources
            handSize: player.hand.length,
            manaEfficiency: player.mana / Math.max(1, player.maxMana),
            
            // Game phase
            isEarlyGame: this.gameState.turn <= 3,
            isMidGame: this.gameState.turn > 3 && this.gameState.turn <= 7,
            isLateGame: this.gameState.turn > 7
        };
    }

    /**
     * Rozhoduje zda má smysl zahrát kouzlo v aktuální situaci
     */
    shouldPlaySpell(spell) {
        const situation = this.analyzeCurrentSituation();
        const player = this.gameState.players[this.playerIndex];
        
        switch(spell.name) {
            case 'Shield Breaker':
                return situation.hasOpponentDivineShield;
                
            case 'Mass Dispel':
                return situation.hasOpponentTaunt && situation.playerBoardSize > 0;
                
            case 'Glacial Burst':
                return situation.opponentThreats > 0 || situation.opponentBoardSize >= 2;
                
            case 'Healing Touch':
            case 'Holy Nova':
            case 'Source Healing':
            case 'Holy Strike':
                // Healing kouzla pouze pokud skutečně potřebujeme heal
                return player.hero.health < player.hero.maxHealth - 3;
                
            case 'Arcane Intellect':
                return situation.handSize <= 6; // Jen pokud nemáme skoro plnou ruku
                
            case 'Mirror Image':
                return situation.opponentBoardSize > situation.playerBoardSize || situation.isPlayerLowHealth;
                
            case 'Inferno Wave':
            case 'Arcane Explosion':
            case 'Arcane Storm':
                return situation.opponentBoardSize >= 2; // AoE jen pokud má více jednotek
                
            case 'Polymorph Wave':
                return situation.opponentBoardSize >= 3; // Transform all jen při hodně jednotkách
                
            case 'Fireball':
            case 'Lightning Bolt':
            case 'Magic Arrows':
            case 'Frostbolt':
                return true; // Damage spells jsou skoro vždy OK
                
            default:
                return true; // Neznámé kouzla necháme projít
        }
    }

    /**
     * Utility metody pro rozpoznávání efektů karet
     */
    hasEffectKeyword(card, keyword) {
        if (!card || !card.effect) return false;
        return card.effect.toLowerCase().includes(keyword.toLowerCase());
    }

    isDamageSpell(spell) {
        if (!spell.effect) return false;
        return this.hasEffectKeyword(spell, 'damage') || this.hasEffectKeyword(spell, 'deal');
    }

    isHealingSpell(spell) {
        return this.hasEffectKeyword(spell, 'heal') || this.hasEffectKeyword(spell, 'restore');
    }

    isAOESpell(spell) {
        return this.hasEffectKeyword(spell, 'all') || this.hasEffectKeyword(spell, 'enemies') || this.hasEffectKeyword(spell, 'minions');
    }

    isSituationalSpell(spell) {
        const situational = ['Shield Breaker', 'Mass Dispel', 'Glacial Burst', 'Soothing Return'];
        return situational.includes(spell.name);
    }

    /**
     * Získá damage value kouzla
     */
    getSpellDamageValue(spell) {
        // Pro jednotlivé známé kouzla
        const knownSpells = {
            'Fireball': 6,
            'Lightning Bolt': 3,
            'Magic Arrows': 3,
            'Frostbolt': 3,
            'Arcane Explosion': 1, // AoE
            'Inferno Wave': 4, // AoE
            'Arcane Storm': 8, // All characters
            'Holy Strike': 2
        };
        
        return knownSpells[spell.name] || this.parseDamageFromEffect(spell.effect);
    }

    /**
     * Parsuje damage z effect textu
     */
    parseDamageFromEffect(effect) {
        if (!effect) return 0;
        const match = effect.match(/Deal (\d+) damage/i);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Logging pro debugging
     */
    log(...args) {
        if (this.debugMode) {
            console.log("[AI]", ...args);
        }
    }

    logMove(move, reason) {
        if (this.debugMode) {
            console.log(`[AI MOVE] ${move.type}: ${reason}`);
            if (move.type === 'playCard') {
                const card = this.gameState.players[this.playerIndex].hand[move.cardIndex];
                console.log(`  Card: ${card?.name} (${card?.manaCost} mana)`);
            }
        }
    }

    logSituation() {
        if (this.debugMode) {
            const situation = this.analyzeCurrentSituation();
            console.log("[AI SITUATION]", situation);
        }
    }
}

module.exports = AIPlayer;
