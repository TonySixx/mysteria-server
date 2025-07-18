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
        
        // Debugging - zapnuto pro lepší sledování chování
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
            const maxThinkTime = 5000; // Zvýšeno na 5 sekund pro lepší plánování
            
            this.log("=== AI TURN START ===");
            this.log(`Game phase: ${this.gamePhase}, Hero: ${this.heroType}, Archetype: ${this.deckArchetype}`);
            
            // 1. Kontrola lethal možností
            const lethalMove = this.findLethalSequence();
            if (lethalMove) {
                this.log("LETHAL FOUND!", lethalMove);
                return lethalMove;
            }
            
            // 2. Kontrola kritických hrozeb které musíme řešit
            const urgentMove = this.findUrgentResponse();
            if (urgentMove) {
                this.log("URGENT RESPONSE NEEDED:", urgentMove);
                return urgentMove;
            }
            
            // 3. Hledání combo možností
            const comboMove = this.findComboOpportunity();
            if (comboMove && comboMove.priority > 800) {
                this.log("HIGH VALUE COMBO FOUND:", comboMove);
                return comboMove;
            }
            
            // 4. Look-ahead search pro nejlepší tah
            const bestMove = this.findOptimalMoveWithLookahead(maxThinkTime - (Date.now() - startTime));
            
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
     * Najde optimální kombinaci akcí s look-ahead search
     */
    findOptimalMoveWithLookahead(timeLimit) {
        const startTime = Date.now();
        const possibleActions = this.generatePossibleActions();
        
        if (possibleActions.length === 0) {
            return { type: 'endTurn' };
        }
        
        let bestAction = null;
        let bestScore = -Infinity;
        
        // Pro kritické situace použijeme look-ahead search
        const needsDeepSearch = this.shouldUseDeepSearch();
        
        for (const action of possibleActions) {
            let score;
            
            if (needsDeepSearch && (Date.now() - startTime) < timeLimit * 0.7) {
                // Použijeme minimax s look-ahead pro důležité rozhodnutí
                score = this.minimaxSearch(action, 2, true, -Infinity, Infinity);
            } else {
                // Rychlé vyhodnocení pro běžné tahy
                score = this.evaluateActionEnhanced(action);
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestAction = action;
            }
            
            // Kontrola časového limitu
            if (Date.now() - startTime > timeLimit) {
                break;
            }
        }
        
        return bestAction || { type: 'endTurn' };
    }

    /**
     * Najde optimální kombinaci akcí pro tento tah (původní metoda)
     */
    findOptimalMove(timeLimit) {
        const possibleActions = this.generatePossibleActions();
        
        if (possibleActions.length === 0) {
            return { type: 'endTurn' };
        }
        
        let bestAction = null;
        let bestScore = -Infinity;
        
        // Hodnotíme každou možnou akci
        for (const action of possibleActions) {
            const score = this.evaluateActionEnhanced(action);
            
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
                    // Kontrola zda má kouzlo smysl zahrát
                    if (this.shouldPlaySpell(card)) {
                        // Pro kouzla určíme nejlepší target
                        const targets = this.findSpellTargets(card);
                        for (const target of targets) {
                            let priority = this.calculateSpellPriority(card, target);
                            
                            // Speciální bonus pro combo actions
                            if (card.name === 'The Coin') {
                                priority = this.calculateCoinPriority();
                                // Pokud coin má negativní prioritu, přeskočíme
                                if (priority <= 0) {
                                    this.log(`ACTIONS: Skipping ${card.name} - negative priority (${priority})`);
                                    continue;
                                }
                            }
                            
                            actions.push({
                                type: 'playCard',
                                cardIndex: i,
                                target: target,
                                priority: priority
                            });
                        }
                    } else {
                        this.log(`ACTIONS: Skipping ${card.name} - failed shouldPlaySpell check`);
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
            if (unit && !unit.hasAttacked && !unit.frozen && this.shouldUnitAttack(unit)) {
                const attackTargets = this.findAttackTargets(unit, i);
                for (const target of attackTargets) {
                    const attackPriority = this.calculateAttackPriority(unit, target);
                    // Přeskočíme útoky s velmi nízkou prioritou
                    if (attackPriority > -500) {
                        actions.push({
                            type: 'attack',
                            attackerIndex: i,
                            targetIndex: target.index,
                            isHeroTarget: target.isHero,
                            priority: attackPriority
                        });
                    }
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
        const sortedActions = actions.sort((a, b) => b.priority - a.priority);
        this.log(`ACTIONS: Generated ${sortedActions.length} possible actions`);
        
        // Debug top 3 actions
        if (sortedActions.length > 0) {
            this.log(`TOP ACTIONS:`);
            for (let i = 0; i < Math.min(3, sortedActions.length); i++) {
                const action = sortedActions[i];
                this.log(`  ${i+1}. ${action.type} (priority: ${action.priority})`);
            }
        }
        
        return sortedActions;
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
        // Kontrola základní logiky útoku
        if (attacker.attack <= 0) {
            this.log(`ATTACK: ${attacker.name || 'Unit'} has 0 attack - useless attack`);
            return -1000; // Velmi nízká priorita pro 0 attack
        }
        
        let priority = 0;
        
        if (target.isHero) {
            // Útok na hrdinu
            priority = this.FACE_DAMAGE_PRIORITY;
            
            // Škálujeme podle damage
            priority += attacker.attack * 20;
            
            // Bonus pro aggro decky
            if (this.deckArchetype === 'aggro') {
                priority += 100;
            }
            
            // Bonus pokud je protivník low health
            if (target.hero && target.hero.health <= 10) {
                priority += 200;
            }
            
            // Penalty pro slabé útoky na zdravého protivníka
            if (attacker.attack <= 2 && target.hero && target.hero.health > 20) {
                priority -= 100;
                this.log(`ATTACK: Weak attack (${attacker.attack}) on healthy hero - reduced priority`);
            }
        } else {
            // Útok na jednotku - hodnotíme trade
            const tradeValue = this.evaluateTradeEnhanced(attacker, target.unit);
            priority = this.VALUE_TRADE_PRIORITY + tradeValue;
            
            // Speciální Divine Shield logic
            priority += this.calculateDivineShieldStrategy(attacker, target.unit);
            
            // Bonus za odstranění vysokých hrozeb
            const threatLevel = this.calculateThreatLevel(target.unit);
            priority += threatLevel;
            
            // Penalty pro velmi špatné trades
            if (tradeValue < -200) {
                this.log(`ATTACK: Very bad trade (${tradeValue}) - strongly discouraged`);
                priority -= 300;
            }
        }
        
        // Archetype-specific adjustments
        priority += this.getAttackArchetypeBonus(attacker, target);
        
        return priority;
    }

    /**
     * Hodnotí kvalitu trade (výměny jednotek) - původní metoda
     */
    evaluateTrade(attacker, defender) {
        // Delegujeme na vylepšenou verzi
        return this.evaluateTradeEnhanced(attacker, defender);
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
     * Vypočítá prioritu zahrání karty (vylepšeno)
     */
    calculateCardPlayPriority(card) {
        let priority = this.TEMPO_PLAY_PRIORITY;
        const situation = this.analyzeCurrentSituation();
        
        // Enhanced mana efficiency s archetype awareness
        const statSum = (card.attack || 0) + (card.health || 0);
        const efficiency = statSum / Math.max(1, card.manaCost);
        priority += efficiency * 25;
        
        // Curve considerations s game phase awareness
        if (this.isOnCurve(card)) {
            priority += this.gamePhase === 'early' ? 70 : 40;
        }
        
        // Enhanced archetype-specific priorities
        if (this.deckArchetype === 'aggro') {
            priority += this.calculateAggroCardPriority(card, situation);
        } else if (this.deckArchetype === 'control') {
            priority += this.calculateControlCardPriority(card, situation);
        } else if (this.deckArchetype === 'combo') {
            priority += this.calculateComboCardPriority(card, situation);
        }
        
        // Enhanced situational bonuses
        priority += this.calculateSituationalBonus(card, situation);
        
        // Game phase adjustments
        priority += this.calculateGamePhaseBonus(card);
        
        return priority;
    }

    /**
     * Aggro deck card priorities
     */
    calculateAggroCardPriority(card, situation) {
        let priority = 0;
        
        // Vysoká priorita pro agresivní jednotky
        if (card.type === 'unit' && (card.attack || 0) > (card.health || 0)) {
            priority += 80;
        }
        
        // Damage spells mají vysokou prioritu pokud protivník je low health
        if (card.type === 'spell' && this.isDamageSpell(card)) {
            if (situation.isOpponentLowHealth) {
                priority += 150;
            } else {
                priority += 60;
            }
        }
        
        // Rychlé jednotky v early game
        if (this.gamePhase === 'early' && card.manaCost <= 3) {
            priority += 50;
        }
        
        // Penalty za pomalé karty v aggro decku
        if (card.manaCost >= 6) {
            priority -= 40;
        }
        
        return priority;
    }

    /**
     * Control deck card priorities
     */
    calculateControlCardPriority(card, situation) {
        let priority = 0;
        
        // Vysoká priorita pro defensive tools
        if (this.hasEffectKeyword(card, 'Taunt')) {
            if (situation.isPlayerLowHealth || situation.opponentBoardSize > 2) {
                priority += 120;
            } else {
                priority += 60;
            }
        }
        
        // Removal spells podle hrozeb
        if (this.isRemovalSpell(card)) {
            priority += situation.opponentThreats * 40;
        }
        
        // AoE při plném boardu protivníka
        if (this.isAOESpell(card) && situation.opponentBoardSize >= 2) {
            priority += situation.opponentBoardSize * 50;
        }
        
        // Healing když potřebujeme
        if (this.isHealingSpell(card) && situation.isPlayerLowHealth) {
            priority += 100;
        }
        
        // Card draw pro value
        if (this.hasEffectKeyword(card, 'draw') && situation.handSize <= 5) {
            priority += 70;
        }
        
        return priority;
    }

    /**
     * Combo deck card priorities
     */
    calculateComboCardPriority(card, situation) {
        let priority = 0;
        
        // Combo pieces mají vysokou prioritu
        if (this.isComboCard(card)) {
            priority += 90;
        }
        
        // Card draw je kritický pro combo decky
        if (this.hasEffectKeyword(card, 'draw')) {
            priority += 100;
        }
        
        // Stalling tools dokud nemáme combo
        if ((this.hasEffectKeyword(card, 'Taunt') || this.isHealingSpell(card)) && 
            !this.hasComboInHand()) {
            priority += 80;
        }
        
        // Combo execution
        if (this.hasComboInHand() && this.enablesCombo(card)) {
            priority += 200;
        }
        
        return priority;
    }

    /**
     * Situační bonusy pro karty
     */
    calculateSituationalBonus(card, situation) {
        let bonus = 0;
        
        // Divine Shield synergy
        if (this.hasEffectKeyword(card, 'Divine Shield')) {
            bonus += 40;
            
            // Extra bonus v divine shield deck
            if (this.deckAnalysis.divineShieldCards > 3) {
                bonus += 30;
            }
        }
        
        // Spell synergy
        if (card.type === 'spell' && situation.playerBoardSize > 0) {
            const spellSynergyUnits = this.gameState.players[this.playerIndex].field.filter(unit => 
                unit && (unit.name === 'Arcane Familiar' || 
                       unit.name === 'Mana Wyrm' || 
                       unit.name === 'Battle Mage')
            );
            bonus += spellSynergyUnits.length * 40;
        }
        
        // Resource management
        if (this.hasEffectKeyword(card, 'draw') && situation.handSize <= 3) {
            bonus += 90; // Urgent card draw
        }
        
        // Emergency response
        if (situation.isPlayerLowHealth) {
            if (this.hasEffectKeyword(card, 'Taunt') || this.isHealingSpell(card)) {
                bonus += 120;
            }
        }
        
        return bonus;
    }

    /**
     * Game phase bonusy
     */
    calculateGamePhaseBonus(card) {
        let bonus = 0;
        
        if (this.gamePhase === 'early') {
            // Early game preferuje levné karty
            if (card.manaCost <= 3) {
                bonus += 40;
            } else if (card.manaCost >= 6) {
                bonus -= 60;
            }
        } else if (this.gamePhase === 'mid') {
            // Mid game preferuje value plays
            if (card.manaCost >= 4 && card.manaCost <= 6) {
                bonus += 30;
            }
        } else if (this.gamePhase === 'late') {
            // Late game preferuje vysoké value karty
            if (card.manaCost >= 6) {
                bonus += 50;
            }
            if (this.hasEffectKeyword(card, 'draw') || this.hasEffectKeyword(card, 'damage')) {
                bonus += 40;
            }
        }
        
        return bonus;
    }

    /**
     * Helper metody pro combo detection
     */
    isComboCard(card) {
        // Identifikuje combo pieces
        const comboCards = [
            'Mind Theft', 'Legion Commander', 'Ancient Colossus',
            'Time Weaver', 'Arcane Storm', 'Polymorph Wave'
        ];
        return comboCards.includes(card.name) || 
               (card.effect && (card.effect.includes('all') || card.effect.includes('copy')));
    }

    hasComboInHand() {
        const player = this.gameState.players[this.playerIndex];
        return player.hand.some(card => card && this.isComboCard(card));
    }

    enablesCombo(card) {
        // Kontroluje zda karta umožňuje combo
        return this.hasEffectKeyword(card, 'draw') || 
               this.hasEffectKeyword(card, 'mana') ||
               card.name === 'Mana Surge';
    }

    /**
     * Vypočítá prioritu pro The Coin - hraje jen pokud má plán
     */
    calculateCoinPriority() {
        const player = this.gameState.players[this.playerIndex];
        const currentMana = player.mana;
        const extraMana = currentMana + 1; // Mana po zahrání coinu
        
        // Hledáme karty které můžeme zahrát s extra manou
        const playableWithCoin = [];
        const playableWithoutCoin = [];
        
        for (let i = 0; i < player.hand.length; i++) {
            const card = player.hand[i];
            if (!card || card.name === 'The Coin') continue;
            
            // Dodatečná kontrola že kartu vůbec má smysl hrát
            if (card.type === 'spell' && !this.shouldPlaySpell(card)) {
                continue;
            }
            
            if (card.manaCost <= extraMana && card.manaCost > currentMana) {
                playableWithCoin.push({card, index: i});
            } else if (card.manaCost <= currentMana) {
                playableWithoutCoin.push({card, index: i});
            }
        }
        
        // Také kontrolujeme hero ability
        const canUseHeroAbilityWithCoin = !player.hero.hasUsedAbility && 
                                         player.hero.abilityCost <= extraMana && 
                                         player.hero.abilityCost > currentMana &&
                                         this.calculateHeroAbilityPriority() > 100; // Jen pokud je užitečná
        
        // Pokud nemáme žádné karty ani hero ability které by využily extra manu, coin je zbytečný
        if (playableWithCoin.length === 0 && !canUseHeroAbilityWithCoin) {
            this.log("COIN: No cards or abilities benefit from extra mana - very low priority");
            return -500; // Velmi nízká priorita
        }
        
        // Double-check že karty v playableWithCoin skutečně stojí za to
        const valuableCards = playableWithCoin.filter(({card}) => {
            const cardValue = this.calculateCardValue(card);
            return cardValue >= 3; // Minimální threshold pro value
        });
        
        if (valuableCards.length === 0 && !canUseHeroAbilityWithCoin) {
            this.log("COIN: No valuable cards to enable - saving for later");
            return -300;
        }
        
        // Vyhodnotíme value karet které můžeme zahrát s coinem
        let coinValue = 0;
        for (const {card} of valuableCards) {
            coinValue += this.calculateCardValue(card);
        }
        
        // Bonus za hero ability
        if (canUseHeroAbilityWithCoin) {
            const abilityValue = this.calculateHeroAbilityPriority();
            coinValue += abilityValue / 50; // Převedeme priority na value
        }
        
        // Pokud máme dobré karty k zahrání i bez coinu, není to tak urgentní
        let alternativeValue = 0;
        for (const {card} of playableWithoutCoin) {
            if (card.type !== 'spell' || this.shouldPlaySpell(card)) {
                alternativeValue += this.calculateCardValue(card);
            }
        }
        
        // Speciální bonus pro curve plays
        const perfectCurveCard = valuableCards.find(({card}) => 
            card.manaCost === extraMana && this.isOnCurve(card)
        );
        
        if (perfectCurveCard) {
            this.log(`COIN: Perfect curve play with ${perfectCurveCard.card.name}`);
            return this.TEMPO_PLAY_PRIORITY + 150;
        }
        
        // Kontrola že skutečně budeme mít follow-up
        const hasGoodFollowUp = coinValue > 5 || canUseHeroAbilityWithCoin;
        if (!hasGoodFollowUp) {
            this.log("COIN: No good follow-up plays available");
            return -400;
        }
        
        // Archetype-specific coin evaluation
        let archetypeBonus = 0;
        if (this.deckArchetype === 'aggro') {
            // Aggro chce coin pro early tempo nebo burn damage
            const aggressiveCards = valuableCards.filter(({card}) => 
                (card.type === 'unit' && (card.attack || 0) > (card.health || 0)) ||
                (card.type === 'spell' && this.isDamageSpell(card))
            );
            if (aggressiveCards.length > 0) {
                archetypeBonus += 80;
                this.log(`COIN: Aggro bonus for ${aggressiveCards.length} aggressive cards`);
            }
        } else if (this.deckArchetype === 'control') {
            // Control chce coin pro defensive tools nebo value plays
            const defensiveCards = valuableCards.filter(({card}) => 
                this.hasEffectKeyword(card, 'Taunt') || 
                this.isHealingSpell(card) || 
                this.hasEffectKeyword(card, 'draw')
            );
            if (defensiveCards.length > 0) {
                archetypeBonus += 60;
                this.log(`COIN: Control bonus for ${defensiveCards.length} defensive cards`);
            }
        }
        
        // Coin má smysl pouze pokud nám umožní zahrát hodnot ější karty
        if (coinValue > alternativeValue * 1.3) { // Zvýšil threshold
            this.log(`COIN: Good value - enables ${valuableCards.length} better cards (value: ${coinValue} vs ${alternativeValue})`);
            return this.TEMPO_PLAY_PRIORITY + 100 + archetypeBonus;
        } else if ((valuableCards.length > 0 || canUseHeroAbilityWithCoin) && this.gamePhase === 'early') {
            // V early game je tempo důležité
            this.log("COIN: Early game tempo play");
            return this.TEMPO_PLAY_PRIORITY + 50 + archetypeBonus;
        } else if (coinValue > 6 && archetypeBonus > 0) { // Vyšší threshold
            // Máme nějaké karty které pasují k archetypu
            this.log("COIN: Strong archetype synergy makes it worthwhile");
            return this.TEMPO_PLAY_PRIORITY + archetypeBonus - 20;
        } else {
            this.log("COIN: Better to save for later - insufficient value");
            return -200; // Raději ušetříme na později
        }
    }

    /**
     * Vypočítá hodnotu karty pro planning
     */
    calculateCardValue(card) {
        let value = (card.attack || 0) + (card.health || 0);
        
        // Bonusy za effects
        if (this.hasEffectKeyword(card, 'draw')) value += 3;
        if (this.hasEffectKeyword(card, 'damage')) value += 2;
        if (this.hasEffectKeyword(card, 'Taunt')) value += 2;
        if (this.hasEffectKeyword(card, 'Divine Shield')) value += 2;
        
        // Archetype bonuses
        if (this.deckArchetype === 'aggro' && (card.attack || 0) > (card.health || 0)) {
            value *= 1.3;
        }
        if (this.deckArchetype === 'control' && this.hasEffectKeyword(card, 'Taunt')) {
            value *= 1.3;
        }
        
        // Mana efficiency bonus
        const efficiency = value / Math.max(1, card.manaCost);
        if (efficiency > 2) value += 2;
        
        return value;
    }

    /**
     * Vylepšená kontrola zda má smysl zahrát utility karty
     */
    shouldPlayUtilityCard(card) {
        // Speciální logika pro utility karty
        if (card.name === 'The Coin') {
            return this.calculateCoinPriority() > 0;
        }
        
        if (card.name === 'Mana Surge') {
            return this.shouldPlayManaSurge();
        }
        
        if (card.name === 'Mana Fusion') {
            return this.shouldPlayManaFusion();
        }
        
        return true; // Ostatní karty projdou normální kontrolou
    }

    /**
     * Kontrola pro Mana Surge
     */
    shouldPlayManaSurge() {
        const player = this.gameState.players[this.playerIndex];
        const availableMana = player.maxMana;
        
        // Hledáme karty které můžeme zahrát s restored manou
        const expensiveCards = player.hand.filter(card => 
            card && card.manaCost > player.mana && card.manaCost <= availableMana
        );
        
        if (expensiveCards.length > 0) {
            this.log("MANA SURGE: Can enable expensive cards");
            return true;
        }
        
        // Nebo pokud potřebujeme hero ability
        if (!player.hero.hasUsedAbility && player.mana < player.hero.abilityCost) {
            this.log("MANA SURGE: Can enable hero ability");
            return true;
        }
        
        this.log("MANA SURGE: No immediate benefit");
        return false;
    }

    /**
     * Kontrola pro Mana Fusion
     */
    shouldPlayManaFusion() {
        const player = this.gameState.players[this.playerIndex];
        
        // Mana Fusion má overload, takže je risky
        // Hraj pouze pokud máme velmi dobré karty k zahrání
        const expensiveCards = player.hand.filter(card => 
            card && card.manaCost > player.mana + 2 && card.manaCost <= player.mana + 4
        );
        
        const highValueCards = expensiveCards.filter(card => 
            this.calculateCardValue(card) > 8
        );
        
        if (highValueCards.length > 0) {
            this.log("MANA FUSION: Can enable high-value cards");
            return true;
        }
        
        this.log("MANA FUSION: Too risky without high-value targets");
        return false;
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
        
        // Kontrola zda máme karty k zahrání
        const playableCards = player.hand.filter(card => 
            card && card.manaCost <= player.mana && this.shouldPlaySpell(card)
        );
        
        // Speciální kontrola pro The Coin
        const hasCoin = player.hand.some(card => card && card.name === 'The Coin');
        if (hasCoin && this.calculateCoinPriority() > 0) {
            this.log("END TURN: Have coin with good targets - low priority to end");
            return 5; // Velmi nízká priorita ukončit tah
        }
        
        // Kontrola hero ability
        const canUseHeroAbility = !player.hero.hasUsedAbility && 
                                 player.mana >= player.hero.abilityCost &&
                                 this.calculateHeroAbilityPriority() > 100;
        
        // Nízká priorita pokud máme ještě manu a karty k zahrání
        if (player.mana > 0 && (playableCards.length > 0 || canUseHeroAbility)) {
            this.log(`END TURN: Still have ${player.mana} mana and ${playableCards.length} playable cards`);
            return 10;
        }
        
        // Střední priorita pokud máme manu ale žádné smysluplné karty k zahrání
        if (player.mana > 0 && playableCards.length === 0 && !canUseHeroAbility) {
            // Ale ještě zkontrolujme zda nemáme nějaké utility karty které by mohly mít smysl později
            const utilityCards = player.hand.filter(card => 
                card && (card.name === 'The Coin' || card.name === 'Mana Surge' || card.name === 'Mana Fusion')
            );
            
            if (utilityCards.length > 0) {
                this.log("END TURN: Have utility cards but not beneficial now");
                return 120;
            } else {
                this.log("END TURN: Have mana but no beneficial cards");
                return 150;
            }
        }
        
        // Vysoká priorita pokud nemáme co dělat
        this.log("END TURN: Nothing useful to do");
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
        // Speciální handling pro The Coin
        if (spell.name === 'The Coin') {
            return this.calculateCoinPriority();
        }
        
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
        
        // Buff spells (targetují friendly miniony)
        if (this.isBuffSpell(spell)) {
            const player = this.gameState.players[this.playerIndex];
            const friendlyUnits = player.field.filter(unit => unit).length;
            
            if (friendlyUnits === 0) {
                priority = -400; // Velmi špatný tah bez cílů
            } else {
                priority += friendlyUnits * 50; // Bonus za více cílů
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
        // Nejprve kontrola utility karet
        if (!this.shouldPlayUtilityCard(spell)) {
            return false;
        }
        
        const situation = this.analyzeCurrentSituation();
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[this.opponentIndex];
        
        switch(spell.name) {
            case 'The Coin':
                // Coin má svou vlastní logiku
                const coinPriority = this.calculateCoinPriority();
                this.log(`COIN CHECK: Priority ${coinPriority}`);
                return coinPriority > 0;
                
            case 'Shield Breaker':
                return situation.hasOpponentDivineShield;
                
            case 'Mass Dispel':
                return situation.hasOpponentTaunt && situation.playerBoardSize > 0;
                
            case 'Glacial Burst':
                return situation.opponentThreats > 0 || situation.opponentBoardSize >= 2;
                
            case 'Divine Formation':
                // Jen pokud máme jednotky s Divine Shield
                const divineShieldUnits = player.field.filter(unit => 
                    unit && unit.hasDivineShield
                );
                if (divineShieldUnits.length === 0) {
                    this.log(`DIVINE FORMATION: No Divine Shield units - useless spell`);
                    return false;
                }
                return true;
                
            case 'Mass Fortification':
                // Jen pokud máme alespoň 2 jednotky na boardu
                if (situation.playerBoardSize < 2) {
                    this.log(`MASS FORTIFICATION: Only ${situation.playerBoardSize} units - not worth it`);
                    return false;
                }
                return true;
                
            case 'Mass Dispel':
                // Jen pokud protivník má Taunt a my máme jednotky k útoku
                const opponentTaunts = opponent.field.filter(unit => unit && unit.hasTaunt);
                if (opponentTaunts.length === 0) {
                    this.log(`MASS DISPEL: No enemy taunts - useless spell`);
                    return false;
                }
                if (situation.playerBoardSize === 0) {
                    this.log(`MASS DISPEL: No units to attack - useless spell`);
                    return false;
                }
                return true;
                
            case 'Shield Breaker':
                // Jen pokud protivník má Divine Shield jednotky
                const opponentDivineShields = opponent.field.filter(unit => unit && unit.hasDivineShield);
                if (opponentDivineShields.length === 0) {
                    this.log(`SHIELD BREAKER: No enemy divine shields - useless spell`);
                    return false;
                }
                return true;
                
            case 'Healing Touch':
            case 'Holy Nova':
            case 'Source Healing':
            case 'Holy Strike':
                // Healing kouzla pouze pokud skutečně potřebujeme heal
                const healthMissing = player.hero.maxHealth - player.hero.health;
                if (healthMissing <= 2) {
                    this.log(`HEALING: Only ${healthMissing} health missing - not worth it`);
                    return false;
                }
                return true;
                
            case 'Arcane Intellect':
                // Kontrola overdraw
                if (situation.handSize >= 8) {
                    this.log(`ARCANE INTELLECT: Hand too full (${situation.handSize}) - risk overdraw`);
                    return false;
                }
                return situation.handSize <= 6;
                
            case 'Mirror Image':
                return situation.opponentBoardSize > situation.playerBoardSize || situation.isPlayerLowHealth;
                
            case 'Inferno Wave':
            case 'Arcane Explosion':
            case 'Arcane Storm':
                if (situation.opponentBoardSize < 2) {
                    this.log(`AOE SPELL: Only ${situation.opponentBoardSize} enemy units - not efficient`);
                    return false;
                }
                return true;
                
            case 'Polymorph Wave':
                if (situation.opponentBoardSize < 3) {
                    this.log(`POLYMORPH WAVE: Only ${situation.opponentBoardSize} enemy units - not worth it`);
                    return false;
                }
                return true;
                
            case 'Fireball':
            case 'Lightning Bolt':
            case 'Magic Arrows':
            case 'Frostbolt':
                return true; // Damage spells jsou skoro vždy OK
                
            default:
                // Pro neznámé spells kontrolujeme basic requirements
                return this.checkBasicSpellRequirements(spell);
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

    isBuffSpell(spell) {
        const buffSpells = ['Mass Fortification', 'Divine Formation'];
        return buffSpells.includes(spell.name) || 
               (spell.effect && (
                   spell.effect.includes('Give all friendly') || 
                   spell.effect.includes('all friendly minions')
               ));
    }

    /**
     * Získá damage value kouzla
     */
    getSpellDamageValue(spell) {
        // Pro jednotlivé známé kouzla
        const knownSpells = {
            'Hellfire':10,
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
     * Vylepšené vyhodnocení akce s archetype awareness
     */
    evaluateActionEnhanced(action) {
        let score = action.priority || 0;
        
        // Simulujeme akci a hodnotíme výsledný stav
        const simulatedState = this.simulateAction(action);
        if (simulatedState) {
            const stateScore = this.evaluateGameStateEnhanced(simulatedState);
            score += stateScore;
        }
        
        // Archetype-specific bonuses
        score += this.getArchetypeActionBonus(action);
        
        // Combo bonuses
        score += this.getComboBonus(action);
        
        // Threat response bonuses
        score += this.getThreatResponseBonus(action);
        
        return score;
    }

    /**
     * Vylepšené hodnocení stavu hry
     */
    evaluateGameStateEnhanced(gameState) {
        const player = gameState.players[this.playerIndex];
        const opponent = gameState.players[this.opponentIndex];
        
        let score = 0;
        
        // 1. Health difference s archetype modifiers
        const healthDiff = player.hero.health - opponent.hero.health;
        if (this.deckArchetype === 'aggro') {
            score += (opponent.hero.health <= 15 ? healthDiff * 15 : healthDiff * 8);
        } else if (this.deckArchetype === 'control') {
            score += (player.hero.health >= 20 ? healthDiff * 12 : healthDiff * 20);
        } else {
            score += healthDiff * 10;
        }
        
        // 2. Enhanced board control
        const boardScore = this.calculateEnhancedBoardControl(gameState);
        score += boardScore * 60;
        
        // 3. Hand advantage s card quality
        const handScore = this.calculateHandAdvantage(gameState);
        score += handScore * 25;
        
        // 4. Tempo evaluation
        const tempoScore = this.calculateTempoScore(gameState);
        score += tempoScore * 30;
        
        // 5. Threat assessment
        const threatScore = this.assessThreatsEnhanced(gameState);
        score += threatScore;
        
        // 6. Win condition progress
        const winConScore = this.calculateWinConditionProgress(gameState);
        score += winConScore;
        
        // 7. Resource efficiency
        const resourceScore = this.calculateResourceEfficiency(gameState);
        score += resourceScore * 20;
        
        return score;
    }

    /**
     * Minimax search s alpha-beta pruning
     */
    minimaxSearch(action, depth, isMaximizing, alpha, beta) {
        if (depth === 0) {
            const simState = this.simulateAction(action);
            return simState ? this.evaluateGameStateEnhanced(simState) : -1000;
        }
        
        const simState = this.simulateAction(action);
        if (!simState) return -1000;
        
        if (isMaximizing) {
            let maxEval = -Infinity;
            const possibleMoves = this.generatePossibleActions(simState);
            
            for (const move of possibleMoves.slice(0, 8)) { // Limit pro performance
                const evaluation = this.minimaxSearch(move, depth - 1, false, alpha, beta);
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                
                if (beta <= alpha) break; // Alpha-beta pruning
            }
            return maxEval;
        } else {
            // Simulujeme protihráčův tah (zjednodušeno)
            let minEval = Infinity;
            const opponentMoves = this.generateOpponentMoves(simState);
            
            for (const move of opponentMoves.slice(0, 6)) {
                const evaluation = this.minimaxSearch(move, depth - 1, true, alpha, beta);
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    /**
     * Kontroluje zda použít deep search
     */
    shouldUseDeepSearch() {
        const situation = this.analyzeCurrentSituation();
        
        // Použijeme deep search v kritických situacích
        return situation.isOpponentLowHealth || 
               situation.isPlayerLowHealth || 
               situation.opponentThreats > 2 ||
               this.gamePhase === 'late' ||
               (this.deckArchetype === 'combo' && situation.handSize >= 6);
    }

    /**
     * Hledá naléhavé odpovědi na hrozby
     */
    findUrgentResponse() {
        const opponent = this.gameState.players[this.opponentIndex];
        const player = this.gameState.players[this.playerIndex];
        
        // Kontrola lethal damage od protivníka
        let opponentDamage = 0;
        for (const unit of opponent.field) {
            if (unit && !unit.hasAttacked) {
                opponentDamage += unit.attack;
            }
        }
        
        if (opponentDamage >= player.hero.health) {
            // Musíme se bránit
            return this.findDefensiveMove();
        }
        
        // Kontrola vysokých hrozeb
        const highThreats = opponent.field.filter(unit => 
            unit && this.calculateThreatLevel(unit) > 15
        );
        
        if (highThreats.length > 0) {
            return this.findRemovalMove(highThreats[0]);
        }
        
        return null;
    }

    /**
     * Hledá combo příležitosti
     */
    findComboOpportunity() {
        const player = this.gameState.players[this.playerIndex];
        const situation = this.analyzeCurrentSituation();
        
        // Kontrola spell synergies
        const spellSynergy = this.findSpellSynergy();
        if (spellSynergy) return spellSynergy;
        
        // Kontrola board combos
        const boardCombo = this.findBoardCombo();
        if (boardCombo) return boardCombo;
        
        // Archetype-specific combos
        if (this.deckArchetype === 'aggro') {
            return this.findAggroCombo();
        } else if (this.deckArchetype === 'control') {
            return this.findControlCombo();
        }
        
        return null;
    }

    /**
     * Vylepšené hodnocení board control
     */
    calculateEnhancedBoardControl(gameState) {
        const player = gameState.players[this.playerIndex];
        const opponent = gameState.players[this.opponentIndex];
        
        let playerValue = 0;
        let opponentValue = 0;
        
        // Pokročilé hodnocení jednotek
        for (const unit of player.field) {
            if (unit) {
                playerValue += this.calculateUnitValueEnhanced(unit);
            }
        }
        
        for (const unit of opponent.field) {
            if (unit) {
                opponentValue += this.calculateUnitValueEnhanced(unit);
            }
        }
        
        // Bonus za board positioning
        playerValue += this.calculatePositioningBonus(player.field);
        
        const totalValue = playerValue + opponentValue;
        if (totalValue === 0) return 0;
        
        return ((playerValue - opponentValue) / totalValue) * 100;
    }

    /**
     * Vylepšené hodnocení hodnoty jednotky
     */
    calculateUnitValueEnhanced(unit) {
        let value = unit.attack * 1.2 + unit.health * 0.8; // Attack je důležitější
        
        // Pokročilé effect bonuses
        if (unit.hasTaunt) value += 3;
        if (unit.hasDivineShield) value += 4;
        if (this.hasEffectKeyword(unit, 'Lifesteal')) value += 3;
        if (this.hasEffectKeyword(unit, 'Windfury')) value += unit.attack * 0.7;
        if (this.hasEffectKeyword(unit, 'draw')) value += 2.5;
        if (this.hasEffectKeyword(unit, 'damage')) value += 2;
        
        // Situational bonuses
        if (unit.frozen) value *= 0.3;
        if (unit.hasAttacked) value *= 0.7;
        
        // Archetype-specific value adjustments
        if (this.deckArchetype === 'aggro' && unit.attack > unit.health) value *= 1.2;
        if (this.deckArchetype === 'control' && unit.hasTaunt) value *= 1.3;
        
        return value;
    }

    /**
     * Archetype-specific action bonuses
     */
    getArchetypeActionBonus(action) {
        let bonus = 0;
        const situation = this.analyzeCurrentSituation();
        
        if (this.deckArchetype === 'aggro') {
            if (action.type === 'attack' && action.isHeroTarget) {
                bonus += 150;
            }
            if (action.type === 'playCard') {
                const card = this.gameState.players[this.playerIndex].hand[action.cardIndex];
                if (card && (card.attack || 0) > (card.health || 0)) {
                    bonus += 80;
                }
            }
        } else if (this.deckArchetype === 'control') {
            if (action.type === 'playCard') {
                const card = this.gameState.players[this.playerIndex].hand[action.cardIndex];
                if (card && (this.hasEffectKeyword(card, 'Taunt') || this.isRemovalSpell(card))) {
                    bonus += 100;
                }
            }
        }
        
        return bonus;
    }

    /**
     * Combo bonuses pro akce
     */
    getComboBonus(action) {
        let bonus = 0;
        const player = this.gameState.players[this.playerIndex];
        
        if (action.type === 'playCard') {
            const card = player.hand[action.cardIndex];
            if (!card) return 0;
            
            // Spell synergy bonuses
            if (card.type === 'spell') {
                const spellSynergyUnits = player.field.filter(unit => 
                    unit && (this.hasEffectKeyword(unit, 'spell') || 
                           unit.name === 'Arcane Familiar' || 
                           unit.name === 'Mana Wyrm' || 
                           unit.name === 'Battle Mage')
                );
                bonus += spellSynergyUnits.length * 50;
            }
            
            // Divine Shield synergy
            if (this.hasEffectKeyword(card, 'Divine Shield')) {
                const divineShieldUnits = player.field.filter(unit => 
                    unit && unit.hasDivineShield
                );
                bonus += divineShieldUnits.length * 30;
            }
            
            // Taunt synergy
            if (this.hasEffectKeyword(card, 'Taunt')) {
                const situation = this.analyzeCurrentSituation();
                if (situation.isPlayerLowHealth) {
                    bonus += 100;
                }
            }
        }
        
        return bonus;
    }

    /**
     * Threat response bonuses
     */
    getThreatResponseBonus(action) {
        let bonus = 0;
        const opponent = this.gameState.players[this.opponentIndex];
        
        if (action.type === 'playCard') {
            const card = this.gameState.players[this.playerIndex].hand[action.cardIndex];
            if (!card) return 0;
            
            // Removal spells proti hrozbám
            if (this.isRemovalSpell(card)) {
                const highThreats = opponent.field.filter(unit => 
                    unit && this.calculateThreatLevel(unit) > 10
                );
                bonus += highThreats.length * 80;
            }
            
            // AoE spells proti plnému boardu
            if (this.isAOESpell(card)) {
                const enemyUnits = opponent.field.filter(unit => unit).length;
                if (enemyUnits >= 3) {
                    bonus += enemyUnits * 60;
                }
            }
        }
        
        return bonus;
    }

    /**
     * Generuje možné tahy protivníka (zjednodušeno)
     */
    generateOpponentMoves(gameState) {
        // Zjednodušená simulace tahů protivníka
        const moves = [];
        const opponent = gameState.players[this.opponentIndex];
        
        // Simulujeme možné útoky
        for (let i = 0; i < opponent.field.length; i++) {
            const unit = opponent.field[i];
            if (unit && !unit.hasAttacked) {
                moves.push({
                    type: 'attack',
                    attackerIndex: i,
                    targetIndex: 0,
                    isHeroTarget: true
                });
            }
        }
        
        // Simulujeme možné karty (odhadujeme)
        for (let i = 0; i < Math.min(3, opponent.hand.length); i++) {
            moves.push({
                type: 'playCard',
                cardIndex: i,
                destinationIndex: opponent.field.length
            });
        }
        
        return moves;
    }

    /**
     * Hledá defensive move
     */
    findDefensiveMove() {
        const player = this.gameState.players[this.playerIndex];
        
        // Hledáme taunt jednotky
        for (let i = 0; i < player.hand.length; i++) {
            const card = player.hand[i];
            if (card && card.manaCost <= player.mana && this.hasEffectKeyword(card, 'Taunt')) {
                return {
                    type: 'playCard',
                    cardIndex: i,
                    destinationIndex: player.field.length,
                    priority: 1500
                };
            }
        }
        
        // Hledáme healing
        for (let i = 0; i < player.hand.length; i++) {
            const card = player.hand[i];
            if (card && card.manaCost <= player.mana && this.isHealingSpell(card)) {
                return {
                    type: 'playCard',
                    cardIndex: i,
                    priority: 1200
                };
            }
        }
        
        return null;
    }

    /**
     * Hledá removal move
     */
    findRemovalMove(threat) {
        const player = this.gameState.players[this.playerIndex];
        
        for (let i = 0; i < player.hand.length; i++) {
            const card = player.hand[i];
            if (card && card.manaCost <= player.mana && this.isRemovalSpell(card)) {
                return {
                    type: 'playCard',
                    cardIndex: i,
                    target: { unitIndex: threat.index },
                    priority: 1300
                };
            }
        }
        
        return null;
    }

    /**
     * Hledá spell synergy
     */
    findSpellSynergy() {
        const player = this.gameState.players[this.playerIndex];
        
        // Hledáme spell synergy jednotky na boardu
        const spellSynergyUnits = player.field.filter(unit => 
            unit && (unit.name === 'Arcane Familiar' || 
                   unit.name === 'Mana Wyrm' || 
                   unit.name === 'Battle Mage')
        );
        
        if (spellSynergyUnits.length > 0) {
            // Hledáme spell k zahrání
            for (let i = 0; i < player.hand.length; i++) {
                const card = player.hand[i];
                if (card && card.type === 'spell' && card.manaCost <= player.mana) {
                    return {
                        type: 'playCard',
                        cardIndex: i,
                        priority: 600 + spellSynergyUnits.length * 100
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Hledá board combo
     */
    findBoardCombo() {
        const player = this.gameState.players[this.playerIndex];
        
        // Hledáme buffing spells s jednotkami na boardu
        if (player.field.length > 0) {
            for (let i = 0; i < player.hand.length; i++) {
                const card = player.hand[i];
                if (card && card.manaCost <= player.mana && this.isBuffSpell(card)) {
                    return {
                        type: 'playCard',
                        cardIndex: i,
                        priority: 400 + player.field.length * 50
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Hledá aggro combo
     */
    findAggroCombo() {
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[this.opponentIndex];
        
        // Hledáme burst damage combo
        if (opponent.hero.health <= 15) {
            let totalDamage = 0;
            const damageCards = [];
            
            for (let i = 0; i < player.hand.length; i++) {
                const card = player.hand[i];
                if (card && card.type === 'spell' && card.manaCost <= player.mana) {
                    const damage = this.getSpellDamageToHero(card);
                    if (damage > 0) {
                        totalDamage += damage;
                        damageCards.push(i);
                    }
                }
            }
            
            if (totalDamage >= opponent.hero.health * 0.6) {
                return {
                    type: 'playCard',
                    cardIndex: damageCards[0],
                    priority: 800
                };
            }
        }
        
        return null;
    }

    /**
     * Hledá control combo
     */
    findControlCombo() {
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[this.opponentIndex];
        
        // Hledáme board clear combo
        const enemyUnits = opponent.field.filter(unit => unit).length;
        if (enemyUnits >= 2) {
            for (let i = 0; i < player.hand.length; i++) {
                const card = player.hand[i];
                if (card && card.manaCost <= player.mana && this.isAOESpell(card)) {
                    return {
                        type: 'playCard',
                        cardIndex: i,
                        priority: 600 + enemyUnits * 80
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Vylepšené rozpoznání removal spells
     */
    isRemovalSpell(spell) {
        const removalSpells = [
            'Death Touch', 'Fireball', 'Lightning Bolt', 'Frostbolt',
            'Magic Arrows', 'Holy Strike', 'Soothing Return'
        ];
        return removalSpells.includes(spell.name) || 
               (spell.effect && spell.effect.includes('Destroy'));
    }

    /**
     * Další vylepšené helper metody
     */
    calculateHandAdvantage(gameState) {
        const player = gameState.players[this.playerIndex];
        const opponent = gameState.players[this.opponentIndex];
        
        const handDiff = player.hand.length - opponent.hand.length;
        const handQuality = this.calculateHandQuality(player.hand);
        
        return handDiff * 10 + handQuality;
    }

    calculateHandQuality(hand) {
        let quality = 0;
        for (const card of hand) {
            if (card) {
                if (card.type === 'spell' && this.isDamageSpell(card)) quality += 2;
                if (this.hasEffectKeyword(card, 'draw')) quality += 3;
                if (this.hasEffectKeyword(card, 'Taunt')) quality += 1.5;
                if (card.rarity === 'legendary') quality += 2;
                if (card.rarity === 'epic') quality += 1;
            }
        }
        return quality;
    }

    calculateTempoScore(gameState) {
        const player = gameState.players[this.playerIndex];
        const turn = gameState.turn;
        
        // Hodnotíme tempo podle curve
        const expectedMana = Math.min(turn, 10);
        const manaEfficiency = (expectedMana - player.mana) / expectedMana;
        
        // Bonus za board presence
        const boardPresence = player.field.filter(unit => unit).length;
        
        return manaEfficiency * 50 + boardPresence * 15;
    }

    assessThreatsEnhanced(gameState) {
        const opponent = gameState.players[this.opponentIndex];
        let threatScore = 0;
        
        for (const unit of opponent.field) {
            if (unit) {
                const threat = this.calculateThreatLevelEnhanced(unit);
                threatScore -= threat;
            }
        }
        
        return threatScore;
    }

    calculateThreatLevelEnhanced(unit) {
        let threat = unit.attack * 2.5 + unit.health * 0.5;
        
        // Zvýšené hodnocení hrozeb
        if (this.hasEffectKeyword(unit, 'grow') || this.hasEffectKeyword(unit, 'gain')) {
            threat += 15;
        }
        
        if (this.hasEffectKeyword(unit, 'damage') || this.hasEffectKeyword(unit, 'draw')) {
            threat += 10;
        }
        
        if (unit.hasTaunt) threat += 5;
        if (unit.hasDivineShield) threat += 8;
        
        return threat;
    }

    calculateWinConditionProgress(gameState) {
        const player = gameState.players[this.playerIndex];
        const opponent = gameState.players[this.opponentIndex];
        
        let progress = 0;
        
        if (this.deckArchetype === 'aggro') {
            // Aggro win condition: reduce opponent health quickly
            const healthReduction = (30 - opponent.hero.health) / 30;
            progress = healthReduction * 200;
        } else if (this.deckArchetype === 'control') {
            // Control win condition: survive and gain value
            const healthAdvantage = player.hero.health - opponent.hero.health;
            const cardAdvantage = player.hand.length - opponent.hand.length;
            progress = healthAdvantage * 5 + cardAdvantage * 15;
        } else if (this.deckArchetype === 'combo') {
            // Combo win condition: gather combo pieces
            const comboProgress = this.calculateComboProgress();
            progress = comboProgress * 100;
        }
        
        return progress;
    }

    calculateComboProgress() {
        const player = this.gameState.players[this.playerIndex];
        
        // Zjednodušené hodnocení combo progressu
        let progress = 0;
        const totalCards = player.hand.length + player.deck.length;
        
        if (totalCards > 0) {
            progress = player.hand.length / totalCards;
        }
        
        return progress;
    }

    calculateResourceEfficiency(gameState) {
        const player = gameState.players[this.playerIndex];
        
        // Hodnotíme efektivitu využití zdrojů
        const manaEfficiency = (player.maxMana - player.mana) / Math.max(1, player.maxMana);
        const handSize = player.hand.length;
        const optimalHandSize = Math.min(7, Math.max(3, 10 - gameState.turn));
        const handEfficiency = 1 - Math.abs(handSize - optimalHandSize) / optimalHandSize;
        
        return manaEfficiency * 50 + handEfficiency * 30;
    }

    calculatePositioningBonus(field) {
        // Jednoduchý bonus za positioning
        let bonus = 0;
        
        for (let i = 0; i < field.length; i++) {
            const unit = field[i];
            if (unit && unit.hasTaunt) {
                // Taunt jednotky jsou lepší v center positions
                if (i >= 2 && i <= 4) {
                    bonus += 2;
                }
            }
        }
        
        return bonus;
    }

    /**
     * Kontroluje zda má smysl s jednotkou útočit
     */
    shouldUnitAttack(unit) {
        // Základní kontroly
        if (!unit || unit.hasAttacked || unit.frozen) {
            return false;
        }
        
        // Jednotky s 0 attack jsou obvykle utility (Mirror Image, Guard Totems)
        if (unit.attack <= 0) {
            this.log(`UNIT CHECK: ${unit.name || 'Unit'} has ${unit.attack} attack - should not attack`);
            return false;
        }
      
        return true;
    }

    /**
     * Vylepšené hodnocení trade
     */
    evaluateTradeEnhanced(attacker, defender) {
        const attackerValue = this.calculateUnitValueEnhanced(attacker);
        const defenderValue = this.calculateUnitValueEnhanced(defender);
        
        // Základní trade value
        let tradeValue = defenderValue - attackerValue;
        
        // Kontrola survival attacker
        const attackerSurvives = attacker.health > defender.attack;
        const defenderDies = attacker.attack >= defender.health;
        
        if (attackerSurvives && defenderDies) {
            // Ideální trade - zabijeme a přežijeme
            tradeValue += attackerValue * 0.7; // Bonus za survival
            this.log(`TRADE: Ideal trade - kill and survive (${attacker.name} vs ${defender.name})`);
        } else if (!attackerSurvives && defenderDies) {
            // Mutual destruction - OK pokud zabíjíme dražší jednotku
            if (defenderValue > attackerValue * 1.2) {
                tradeValue += 50; // Bonus za dobrý sacrifice
                this.log(`TRADE: Good sacrifice trade (${attacker.name} vs ${defender.name})`);
            } else {
                tradeValue -= 50; // Penalty za špatný sacrifice
                this.log(`TRADE: Poor sacrifice trade (${attacker.name} vs ${defender.name})`);
            }
        } else if (attackerSurvives && !defenderDies) {
            // Damage bez kill - obvykle špatné
            tradeValue -= 100;
            this.log(`TRADE: Damage without kill - poor trade (${attacker.name} vs ${defender.name})`);
        } else {
            // Attacker zemře a defender přežije - velmi špatné
            tradeValue -= 200;
            this.log(`TRADE: Attacker dies, defender survives - very bad trade (${attacker.name} vs ${defender.name})`);
        }
        
        // Bonus za odstranění key threats
        if (this.calculateThreatLevel(defender) > 15) {
            tradeValue += 100;
            this.log(`TRADE: Removing high threat worth extra value`);
        }
        
        // Penalty za ztrátu key units
        if (this.calculateUnitValueEnhanced(attacker) > 10) {
            tradeValue -= 50;
            this.log(`TRADE: Losing valuable unit - penalty`);
        }
        
        // Archetype considerations
        if (this.deckArchetype === 'aggro') {
            // Aggro nechce tradovat, chce face damage
            tradeValue -= 30;
        } else if (this.deckArchetype === 'control') {
            // Control chce dobré trades
            tradeValue += 20;
        }
        
        return tradeValue;
    }

    /**
     * Archetype bonusy pro útoky
     */
    getAttackArchetypeBonus(attacker, target) {
        let bonus = 0;
        
        if (this.deckArchetype === 'aggro') {
            if (target.isHero) {
                // Aggro chce face damage
                bonus += 150;
                
                // Extra bonus pro damage per turn
                bonus += attacker.attack * 15;
            } else {
                // Aggro nechce tradovat pokud to není nutné
                const opponent = this.gameState.players[this.opponentIndex];
                const hasTaunt = opponent.field.some(unit => unit && unit.hasTaunt);
                
                if (!hasTaunt && !target.unit.hasTaunt) {
                    // Pokud můžeme jít na face, trade má penalty
                    bonus -= 100;
                    this.log(`AGGRO: Penalty for trading when face is available`);
                }
            }
        } else if (this.deckArchetype === 'control') {
            if (target.isHero) {
                // Control nespěchá s face damage
                bonus -= 50;
            } else {
                // Control chce dobré trades
                bonus += 50;
                
                // Extra bonus za odstranění threats
                if (this.calculateThreatLevel(target.unit) > 10) {
                    bonus += 80;
                }
            }
        }
        
        return bonus;
    }

    /**
     * Pokročilá Divine Shield strategie
     */
    calculateDivineShieldStrategy(attacker, defender) {
        if (!defender.hasDivineShield) {
            return 0; // Žádný Divine Shield bonus
        }
        
        const player = this.gameState.players[this.playerIndex];
        let bonus = 0;
        
        // Hledáme slabší jednotky které by mohly sundat Divine Shield
        const weakerUnits = player.field.filter(unit => 
            unit && 
            unit !== attacker && 
            !unit.hasAttacked && 
            !unit.frozen &&
            unit.attack > 0 &&
            unit.attack < attacker.attack
        );
        
        if (weakerUnits.length > 0) {
            // Máme slabší jednotky které by mohly sundat shield efektivněji
            const weakestUseful = weakerUnits.reduce((min, unit) => 
                unit.attack < min.attack ? unit : min
            );
            
            // Velká penalty pro útok silnou jednotkou když máme slabší možnost
            bonus -= 200;
            this.log(`DIVINE SHIELD: Should use ${weakestUseful.name} (${weakestUseful.attack}) instead of ${attacker.name} (${attacker.attack}) to break shield`);
        } else {
            // Nemáme lepší možnost, tak můžeme útočit
            bonus += 50;
            this.log(`DIVINE SHIELD: No better option available, proceeding with ${attacker.name}`);
        }
        
        // Bonus pokud je to jediná možnost jak sundat shield
        if (weakerUnits.length === 0 && attacker.attack === 1) {
            bonus += 100;
            this.log(`DIVINE SHIELD: Perfect 1-attack unit for shield removal`);
        }
        
        return bonus;
    }

    /**
     * Základní kontrola pro neznámé spells
     */
    checkBasicSpellRequirements(spell) {
        const player = this.gameState.players[this.playerIndex];
        const opponent = this.gameState.players[this.opponentIndex];
        
        // Kontrola pro buff spells
        if (this.isBuffSpell(spell)) {
            if (player.field.length === 0) {
                this.log(`BUFF SPELL: ${spell.name} - No friendly units to buff`);
                return false;
            }
        }
        
        // Kontrola pro targeted removal
        if (this.isRemovalSpell(spell)) {
            if (opponent.field.length === 0) {
                this.log(`REMOVAL SPELL: ${spell.name} - No enemy units to remove`);
                return false;
            }
        }
        
        // Kontrola pro healing při full health
        if (this.isHealingSpell(spell)) {
            if (player.hero.health >= player.hero.maxHealth - 1) {
                this.log(`HEALING SPELL: ${spell.name} - Already at full health`);
                return false;
            }
        }
        
        // Kontrola pro draw při plné ruce
        if (this.hasEffectKeyword(spell, 'draw')) {
            if (player.hand.length >= 9) {
                this.log(`DRAW SPELL: ${spell.name} - Hand too full, risk overdraw`);
                return false;
            }
        }
        
        // Ostatní spells projdou
        return true;
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
