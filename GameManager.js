const { Card, UnitCard, SpellCard, Hero, SecretCard } = require('./game/CardClasses');
const { startNextTurn, checkGameOver, playCardCommon, handleUnitEffects, useHeroAbility } = require('./game/gameLogic');
const { attack } = require('./game/combatLogic');
const { createClient } = require('@supabase/supabase-js');
const AIPlayer = require('./game/AIPlayer');

class GameManager {
    constructor(io) {  // Přidáme io parametr do konstruktoru
        this.games = new Map(); // Map pro ukládání aktivních her
        this.searchingPlayers = new Set(); // Nový Set pro aktivně hledající hráče
        this.playerGameMap = new Map(); // Nová mapa pro sledování, ve které hře je který hráč
        this.onlinePlayers = new Map(); // userId -> {status, socketId, ...playerData}
        this.disconnectedPlayers = new Map(); // userId -> {gameId, disconnectTime}
        this.RECONNECT_TIMEOUT = 30000; // 30 sekund v milisekundách

        // Inicializace Supabase klienta se service_role klíčem
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
        this.io = io;  // Uložme io instanci
    }

    // Vytvoření nebo připojení ke hře
    handlePlayerJoin(socket) {
        console.log(`Zpracování připojení hráče ${socket.id}`);

        // Kontrola, zda hráč již není v nějaké hře
        if (this.playerGameMap.has(socket.id)) {
            console.log(`Hráč ${socket.id} je již ve hře`);
            return { status: 'already_in_game' };
        }

        // Kontrola, zda hráč již nehledá hru
        if (this.searchingPlayers.has(socket.id)) {
            console.log(`Hráč ${socket.id} již hledá hru`);
            return { status: 'already_searching' };
        }

        // Přidáme hráče mezi hledajcí
        this.searchingPlayers.add(socket.id);
        console.log(`Hráč ${socket.id} začal hledat hru. Počet hledajících: ${this.searchingPlayers.size}`);
        console.log('Aktuální hledající hráči:', Array.from(this.searchingPlayers));

        // Pokud jsou k dispozici alespoň dva hledající hráči
        if (this.searchingPlayers.size >= 2) {
            const players = Array.from(this.searchingPlayers);
            const player1Id = players[0];
            const player2Id = players[1];

            console.log(`Pokus o vytvoření hry mezi hráči ${player1Id} a ${player2Id}`);

            // Najdeme odpovídající socket objekty
            const player1Socket = this.findSocketById(socket, player1Id);
            const player2Socket = this.findSocketById(socket, player2Id);

            if (!player1Socket || !player2Socket) {
                console.error('Nepodařilo se najít sockety pro oba hráče');
                console.log('Player1 socket:', player1Socket ? 'nalezen' : 'nenalezen');
                console.log('Player2 socket:', player2Socket ? 'nalezen' : 'nenalezen');

                // Vrátíme hráče zpět do fronty
                if (player1Socket) {
                    this.searchingPlayers.add(player1Id);
                    console.log(`Hráč ${player1Id} vrácen do fronty`);
                }
                if (player2Socket) {
                    this.searchingPlayers.add(player2Id);
                    console.log(`Hráč ${player2Id} vrácen do fronty`);
                }
                return { status: 'error', message: 'Nepodařilo se spojit hráče' };
            }

            // Odebereme oba hráče z hledajících
            this.searchingPlayers.delete(player1Id);
            this.searchingPlayers.delete(player2Id);
            console.log('Hráči odebráni z fronty hledajících');

            // Vytvoříme novou hru
            const gameId = this.createGame(player1Socket, player2Socket);
            console.log(`Vytvořena nov hra s ID: ${gameId}`);

            // Zaregistrujeme hráče do hry
            this.playerGameMap.set(player1Id, gameId);
            this.playerGameMap.set(player2Id, gameId);
            console.log('Hráči zaregistrováni do hry');

            // Odešleme odpověď oběma hráčům
            const response = { status: 'joined', gameId };
            player1Socket.emit('joinGameResponse', response);
            player2Socket.emit('joinGameResponse', response);

            return response;
        }

        // Pokud není dostatek hráčů, vrátíme status čekán
        console.log(`Hráč ${socket.id} čeká na protihráče`);
        return { status: 'waiting' };
    }

    findSocketById(currentSocket, socketId) {
        // Nejprve zkontrolujeme aktuální socket
        if (currentSocket.id === socketId) {
            console.log(`Socket nalezen (stejný): ${socketId}`);
            return currentSocket;
        }

        // Získáme io instanci
        const io = currentSocket.server;
        if (!io) {
            console.error('Nelze získat přístup k io instanci');
            return null;
        }

        // Získáme socket ze všech připojených socketů
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
            console.log(`Socket nalezen: ${socketId}`);
            return socket;
        }

        console.error(`Socket nenalezen: ${socketId}`);
        return null;
    }

    // Vytvoření nové hry
    async createGame(player1Socket, player2Socket) {
        const gameId = this.generateGameId();

        // Načteme data hrdinů pro oba hráče
        const [player1Hero, player2Hero] = await Promise.all([
            this.loadHeroData(player1Socket.userId),
            this.loadHeroData(player2Socket.userId)
        ]);

        // Inicializace balíčků pro oba hráče
        const [player1Deck, player2Deck] = await this.initializeDecks(
            player1Socket.userId,
            player2Socket.userId
        );

           // Vytvoříme kartu Hand of Fate pro oba hráče
           const handOfFate = new SpellCard(
            `handOfFate-${Date.now()}-1`,
            'Hand of Fate',
            0,
            'Redraw hand when played, otherwise becomes Fate Token.',
            'handOfFate',
            'legendary'
        );

        const handOfFate2 = new SpellCard(
            `handOfFate-${Date.now()}-2`,
            'Hand of Fate',
            0,
            'Redraw hand when played, otherwise becomes Fate Token.',
            'handOfFate',
            'legendary'
        );

        const gameState = {
            gameId,
            players: [
                {
                    socket: player1Socket,
                    username: player1Socket.username,
                    hero: new Hero(player1Socket.username, 30, player1Hero),
                    deck: player1Deck,
                    hand: [...player1Deck.splice(0, 3), handOfFate],
                    field: [],
                    mana: 1,
                    maxMana: 1,
                    originalDeck: [...player1Deck],
                    fatigueDamage: 0,
                    secrets: []
                },
                {
                    socket: player2Socket,
                    username: player2Socket.username,
                    hero: new Hero(player2Socket.username, 30, player2Hero),
                    deck: player2Deck,
                    hand: [...player2Deck.splice(0, 3), new SpellCard('coin', 'The Coin', 0, 'Gain 1 Mana Crystal', 'coinImage'),handOfFate2],
                    field: [],
                    mana: 0,
                    maxMana: 0,
                    originalDeck: [...player2Deck],
                    fatigueDamage: 0,
                    secrets: []
                }
            ],
            currentPlayer: 0,
            turn: 1,
            gameOver: false,
            winner: null,
            startTime: new Date(),
            endTurnEffects: [],
            startTurnEffects: [],
            combatLogMessages: [],
            deadMinionsCount: 0,  // Přidáme počítadlo mrtvých minionů
        };

        this.games.set(gameId, gameState);
        this.setupGameListeners(gameId, player1Socket, 0);
        this.setupGameListeners(gameId, player2Socket, 1);

        // Aktualizujeme status obou hráčů na "in_game"
        this.updatePlayerStatus(player1Socket.userId, 'in_game');
        this.updatePlayerStatus(player2Socket.userId, 'in_game');

        // Odešleme oběma hráčům informaci o začátku hry
        player1Socket.emit('gameStarted', gameId);
        player2Socket.emit('gameStarted', gameId);

        this.broadcastGameState(gameId);

        return gameId;
    }

    async initializeDecks(player1Id, player2Id) {
        const player1Deck = await this.loadPlayerDeck(player1Id);
        const player2Deck = await this.loadPlayerDeck(player2Id);
        return [player1Deck, player2Deck];
    }

    async loadPlayerDeck(userId) {
        try {
            // Načteme aktivní balíček hráe
            const { data: deck, error: deckError } = await this.supabase
                .from('decks')
                .select(`
                    id,
                    deck_cards (
                        card_id,
                        quantity,
                        cards (*)
                    )
                `)
                .eq('user_id', userId)
                .eq('is_active', true)
                .single();

            if (deckError) throw deckError;

            // Pokud hráč nemá aktivní balíček, vrátíme výchozí
            if (!deck) {
                console.log(`No active deck found for user ${userId}, using default`);
                return this.createDefaultDeck();
            }

            // Vytvoříme balíček karet podle dat z databáze
            const playerDeck = [];
            deck.deck_cards.forEach(({ cards: card, quantity }) => {
                for (let i = 0; i < quantity; i++) {
                    const uniqueId = `${userId}-${card.id}-${Math.random()}`;
                    if (card.type === 'unit') {
                        playerDeck.push(new UnitCard(
                            uniqueId,
                            card.name,
                            card.mana_cost,
                            card.attack,
                            card.health,
                            card.effect,
                            card.image,
                            card.rarity
                        ));
                    } else if (card.type === 'secret') {
                        // Určíme triggerType podle názvu karty
                        let triggerType = '';
                        if (card.name === 'Counterspell') {
                            triggerType = 'spell_played';
                        } else if (card.name === 'Explosive Trap') {
                            triggerType = 'hero_attack';
                        } else if (card.name === 'Ambush') {
                            triggerType = 'unit_played';
                        } else if (card.name === 'Soul Guardian') {
                            triggerType = 'hero_attack';
                        } else if (card.name === 'Phantom Mirage') {
                            triggerType = 'unit_played';
                        } else if (card.name === 'Spell Reflector') {
                            triggerType = 'spell_played';
                        }
                        
                        playerDeck.push(new SecretCard(
                            uniqueId,
                            card.name,
                            card.mana_cost,
                            card.effect,
                            card.image,
                            card.rarity,
                            triggerType
                        ));
                    } else {
                        playerDeck.push(new SpellCard(
                            uniqueId,
                            card.name,
                            card.mana_cost,
                            card.effect,
                            card.image,
                            card.rarity
                        ));
                    }
                }
            });

            return playerDeck.sort(() => Math.random() - 0.5);
        } catch (error) {
            console.error('Error loading player deck:', error);
            return this.createDefaultDeck();
        }
    }

    createDefaultDeck() {
        // Přesuneme původní logiku vytvření balíčku sem
        const baseDeck = [
            // Základní jednotky (2 kopie každé)
            ...Array(2).fill({ id: 1, name: 'Fire Elemental', manaCost: 4, attack: 5, health: 6, effect: 'Deals 2 damage to enemy hero when played', image: 'fireElemental', rarity: 'rare' }),
            ...Array(2).fill({ id: 2, name: 'Shield Bearer', manaCost: 2, attack: 1, health: 7, effect: 'Taunt', image: 'shieldBearer', rarity: 'common' }),
            ...Array(2).fill({ id: 5, name: 'Water Elemental', manaCost: 3, attack: 3, health: 5, effect: 'Freeze ramdom enemy minion when played', image: 'waterElemental', rarity: 'rare' }),
            ...Array(2).fill({ id: 6, name: 'Earth Golem', manaCost: 5, attack: 4, health: 8, effect: 'Taunt', image: 'earthGolem', rarity: 'uncommon' }),
            ...Array(2).fill({ id: 9, name: 'Nimble Sprite', manaCost: 1, attack: 1, health: 2, effect: 'Draw a card when played', image: 'nimbleSprite', rarity: 'common' }),
            ...Array(2).fill({ id: 10, name: 'Arcane Familiar', manaCost: 1, attack: 1, health: 3, effect: 'Gain +1 attack when you cast a spell', image: 'arcaneFamiliar', rarity: 'epic' }),
            ...Array(2).fill({ id: 15, name: 'Mana Wyrm', manaCost: 2, attack: 2, health: 3, effect: 'Gain +1 attack when you cast a spell', image: 'manaWyrm', rarity: 'rare' }),
            ...Array(2).fill({ id: 16, name: 'Shadow Assassin', manaCost: 3, attack: 4, health: 2, effect: 'Deal 2 damage to enemy hero when played', image: 'shadowAssassin', rarity: 'rare' }),
            ...Array(2).fill({ id: 43, name: 'Mountain Giant', manaCost: 7, attack: 6, health: 9, effect: 'Taunt', image: 'mountainGiant', rarity: 'rare' }),
            ...Array(1).fill({ id: 44, name: 'Light Champion', manaCost: 6, attack: 5, health: 5, effect: 'Divine Shield', image: 'lightChampion', rarity: 'uncommon' }),
            ...Array(1).fill({ id: 45, name: 'Radiant Protector', manaCost: 6, attack: 4, health: 5, effect: 'Taunt, Divine Shield', image: 'radiantProtector', rarity: 'legendary' }),


            // Běžná kouzla (2 kopie každého)
            ...Array(2).fill({ id: 3, name: 'Fireball', manaCost: 4, effect: 'Deal 6 damage to enemy hero', image: 'fireball', rarity: 'uncommon' }),
            ...Array(2).fill({ id: 7, name: 'Lightning Bolt', manaCost: 2, effect: 'Deal 3 damage to enemy hero', image: 'lightningBolt', rarity: 'common' }),

            // Vzácná kouzla (2 kopie každého)
            ...Array(2).fill({ id: 4, name: 'Healing Touch', manaCost: 3, effect: 'Restore 8 health', image: 'healingTouch', rarity: 'common' }),
            ...Array(2).fill({ id: 8, name: 'Arcane Intellect', manaCost: 3, effect: 'Draw 2 cards', image: 'arcaneIntellect', rarity: 'rare' }),

            // Epická kouzla (1 kopie každého)
            { id: 11, name: 'Glacial Burst', manaCost: 3, effect: 'Freeze all enemy minions', image: 'glacialBurst', rarity: 'epic' },
            { id: 13, name: 'Inferno Wave', manaCost: 7, effect: 'Deal 4 damage to all enemy minions', image: 'infernoWave', rarity: 'epic' }
        ];

        return baseDeck.map(card => {
            const uniqueId = `default-${card.id}-${Math.random()}`;
            if (card.attack !== undefined) {
                return new UnitCard(
                    uniqueId,
                    card.name,
                    card.manaCost,
                    card.attack,
                    card.health,
                    card.effect,
                    card.image,
                    card.rarity
                );
            } else if (card.type === 'secret') {
                return new SecretCard(
                    uniqueId,
                    card.name,
                    card.manaCost,
                    card.effect,
                    card.image,
                    card.rarity,
                    card.triggerType
                );
            } else {
                return new SpellCard(
                    uniqueId,
                    card.name,
                    card.manaCost,
                    card.effect,
                    card.image,
                    card.rarity
                );
            }
        }).sort(() => Math.random() - 0.5);
    }

    // Nastavení event listenerů pro hráče
    setupGameListeners(gameId, socket, playerIndex) {
        console.log(`Nastavuji listenery pro hráče ${socket.id} v game ${gameId}`);

        socket.join(gameId);
        console.log(`Hráč ${socket.id} připojen do místnosti ${gameId}`);

        socket.on('playCard', (data) => {
            console.log(`Hráč ${socket.id} hraje kartu:`, data);
            this.handlePlayCard(gameId, playerIndex, data);
        });

        socket.on('attack', (data) => {
            console.log(`Hráč ${socket.id} útočí:`, data);
            const game = this.games.get(gameId);

            if (!game) {
                console.log('Hra neexistuje');
                return;
            }

            if (game.currentPlayer !== playerIndex) {
                console.log('Hráč není na tahu');
                socket.emit('error', 'Nejste na tahu!');
                return;
            }

            const attacker = game.players[playerIndex].field[data.attackerIndex];
            if (attacker && attacker.hasAttacked) {
                console.log('Jednotka již útočila v tomto kole');
                socket.emit('gameState', {
                    ...this.createPlayerView(game, playerIndex),
                    notification: {
                        message: 'Tato jednotka již v tomto kole útočila!',
                        forPlayer: playerIndex
                    }
                });
                return;
            }

            this.handleAttack(gameId, playerIndex, data);
        });

        // Přidáme listener pro použití hrdinské schopnosti
        socket.on('useHeroAbility', () => {
            console.log(`Hráč ${socket.id} používá hrdinskou schopnost`);
            const game = this.games.get(gameId);

            if (!game) {
                console.log('Hra neexistuje');
                return;
            }

            if (game.currentPlayer !== playerIndex) {
                console.log('Hráč není na tahu');
                socket.emit('error', 'Not your turn!');
                return;
            }

            const player = game.players[playerIndex];
            if (player.hero.hasUsedAbility) {
                console.log('Hrdinská schopnost již byla použita v tomto tahu');
                socket.emit('error', 'Hero ability already used this turn!');
                return;
            }

            if (player.mana < player.hero.abilityCost) {
                console.log('Nedostatek many pro použití schopnosti');
                socket.emit('error', 'Not enough mana!');
                return;
            }

            this.handleHeroAbility(gameId, playerIndex);
        });

        socket.on('endTurn', () => {
            console.log(`Hráč ${socket.id} končí tah`);
            this.handleEndTurn(gameId, playerIndex);
        });

        socket.on('disconnect', () => {
            console.log(`Hráč ${socket.id} se odpojil z game ${gameId}`);
            this.handleDisconnect(gameId, playerIndex);
        });

        socket.on('chatMessage', (data) => {
            const game = this.games.get(gameId);
            if (!game) return;

            // Odešleme zprávu oběma hráčům
            game.players.forEach(player => {
                player.socket.emit('chatMessage', {
                    sender: data.sender,
                    message: data.message,
                    timestamp: Date.now()
                });
            });
        });
    }

    // Generování unikátního ID hry
    generateGameId() {
        const timestamp = Date.now().toString(36); // Převedeme aktuální čas na base36
        const randomPart = Math.random().toString(36).substring(2, 8); // Náhodná část
        return `${timestamp}-${randomPart}`; // Kombinace času a náhodného řetězce
    }

    // Broadcast aktuálního stavu hry oběma hráčům
    broadcastGameState(gameId) {
        const game = this.games.get(gameId);
        if (!game) return;

        // Rozešleme aktuální stav hry oběma hráčům
        game.players.forEach((player, index) => {
            if (player.socket.isAI) return;

            const playerView = this.createPlayerView(game, index);

            // Přidáme animační data, pokud existují
            if (game.animation) {
                playerView.animation = {
                    ...game.animation,
                    // Převrátíme indexy pro druhého hráče
                    sourceIndex: index === 1 ? this.invertFieldIndex(game.animation.sourceIndex) : game.animation.sourceIndex,
                    targetIndex: index === 1 ? this.invertFieldIndex(game.animation.targetIndex) : game.animation.targetIndex
                };
            }
            
            // Přidáme animaci aktivace secret karty, pokud existuje
            if (game.secretAnimation) {
                playerView.secretAnimation = {
                    ...game.secretAnimation,
                    // Předáme vlastnictví bez úpravy, aby klient sám mohl rozhodnout správný text
                    owner: game.secretAnimation.owner
                };
            }

            player.socket.emit('gameState', playerView);
        });

        // Vyčistíme combat log zprávy a animace
        game.combatLogMessages = [];
        game.animation = null;
        game.secretAnimation = null;
    }

    createPlayerView(game, playerIndex) {
        const player = game.players[playerIndex];
        const opponent = game.players[1 - playerIndex];

        // Filtrujeme notifikace podle toho, komu jsou určeny
        let notification = null;
        if (game.notification) {
            // Pokud je notifikace objekt s určením pro konkrétního hráče
            if (typeof game.notification === 'object') {
                if (game.notification.forPlayer === playerIndex) {
                    notification = game.notification.message;
                }
            } else {
                // Pokud je notifikace string, zobrazí se oběma hráčům
                notification = game.notification;
            }
        }

        return {
            gameId: game.gameId,
            currentPlayer: game.currentPlayer,
            turn: game.turn,
            gameOver: game.gameOver,
            winner: game.winner,
            playerIndex,
            player: {
                hero: player.hero,
                hand: player.hand,
                field: player.field,
                deck: player.deck.length,
                mana: player.mana,
                maxMana: player.maxMana,
                username: player.username,
                secrets: player.secrets
            },
            opponent: {
                hero: opponent.hero,
                hand: Array(opponent.hand.length).fill().map(() => ({
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'unknown',
                    isHidden: true,
                    name: 'Hidden Card',
                    manaCost: 0
                })),
                field: opponent.field,
                deckSize: opponent.deck.length,
                mana: opponent.mana,
                maxMana: opponent.maxMana,
                username: opponent.username,
                secrets: opponent.secrets.map(secret => ({
                    id: secret.id,
                    type: 'secret',
                    isSecret: true,
                    isRevealed: secret.isRevealed,
                    triggerType: secret.isRevealed ? secret.triggerType : null,
                    name: secret.isRevealed ? secret.name : 'Secret',
                    image: secret.isRevealed ? secret.image : 'secretCard'
                }))
            },
            notification: notification,
            combatLogMessages: game.combatLogMessages || [],
            animation: game.animation,
        };
    }

    // Zpracování herních akcí
    async handlePlayCard(gameId, playerIndex, data) {
        const game = this.games.get(gameId);
        if (!game) return;

        if (game.currentPlayer !== playerIndex) {
            game.notification = {
                message: 'Not your turn!',
                forPlayer: playerIndex
            };
            this.broadcastGameState(gameId);
            return;
        }

        const { cardIndex, destinationIndex, target } = data;
        const card = game.players[playerIndex].hand[cardIndex];

        // Speciální logika pro Ancient Colossus
        if (card.name === 'Ancient Colossus') {
            // Upravíme cenu podle počtu mrtvých minionů
            card.manaCost = Math.max(1, 30 - game.deadMinionsCount);
        }

        // Přidáme animační data před provedením akce
        if (card.type === 'secret') {
            // Pro tajné karty vytvoříme speciální animaci, která nezobrazuje konkrétní kartu
            game.animation = {
                type: 'playCard',
                player: game.players[playerIndex].username,
                playerIndex: playerIndex,
                card: {
                    id: `secret-${Date.now()}`,
                    name: 'Secret',
                    type: 'secret',
                    manaCost: card.manaCost,
                    image: 'secretCard'
                },
                sourceIndex: cardIndex,
                targetIndex: destinationIndex
            };
        } else {
            game.animation = {
                type: 'playCard',
                player: game.players[playerIndex].username,
                playerIndex: playerIndex,
                card: card,
                sourceIndex: cardIndex,
                targetIndex: destinationIndex
            };
        }

        const updatedState = playCardCommon(game, playerIndex, cardIndex, target, destinationIndex);

        if (updatedState.notification) {
            game.notification = updatedState.notification;
        }

        // Přidáme kontrolu konce hry a uložení výsledku
        if (updatedState.gameOver) {
            console.log('Hra skončila po zahrání karty, vítěz:', updatedState.winner);

            // Zachováme poslední animaci
            updatedState.animation = game.animation;

            // Určíme ID vítěze
            let winnerId;
            if (updatedState.winner === 'draw') {
                winnerId = game.players[0].socket.userId;
            } else {
                winnerId = game.players[updatedState.winner].socket.userId;
            }

            console.log('Určen vítěz:', {
                winnerIndex: updatedState.winner,
                winnerId: winnerId,
                player1Id: game.players[0].socket.userId,
                player2Id: game.players[1].socket.userId
            });

            // Zavoláme handleGameEnd pro zápis do DB
            await this.handleGameEnd(gameId, winnerId);

            // Informujeme oba hráče o konci hry
            game.players.forEach((player, index) => {
                const playerView = this.createPlayerView(updatedState, index);
                player.socket.emit('gameState', playerView);
            });

            // Ukončíme hru a vyčistíme
            setTimeout(() => {
                this.games.delete(gameId);
                game.players.forEach(player => {
                    this.playerGameMap.delete(player.socket.id);
                });
            }, 5000); // Počkáme 5 sekund před vyčištěním
        } else {
            this.games.set(gameId, updatedState);
            this.broadcastGameState(gameId);
        }
    }

    async handleAttack(gameId, playerIndex, data) {
        const game = this.games.get(gameId);
        if (!game || game.currentPlayer !== playerIndex) {
            game.notification = {
                message: 'Not your turn!',
                forPlayer: playerIndex
            };
            this.broadcastGameState(gameId);
            return;
        }

        // Přidáme animační data před provedením útoku
        const attacker = game.players[playerIndex].field[data.attackerIndex];
        let target;
        if (data.isHeroTarget) {
            target = {
                type: 'hero',
                name: game.players[1 - playerIndex].username
            };
        } else {
            target = game.players[1 - playerIndex].field[data.targetIndex];
        }

        game.animation = {
            type: 'attack',
            player: game.players[playerIndex].username,
            card: attacker,
            target: target,
            sourceIndex: data.attackerIndex,
            targetIndex: data.targetIndex,
            isHeroTarget: data.isHeroTarget
        };

        const updatedState = attack(
            data.attackerIndex,
            data.targetIndex,
            data.isHeroTarget,
            false
        )(game);

        if (updatedState.notification) {
            game.notification = updatedState.notification;
        }

        if (updatedState.gameOver) {
            console.log('Hra skončila, vítěz:', updatedState.winner);

            // Zachováme poslední animaci
            updatedState.animation = game.animation;

            let winnerId;
            if (updatedState.winner === 'draw') {
                  // V případě remízy můžeme použít ID prvního hráče nebo speciální logiku
                winnerId = game.players[0].socket.userId;
            } else {
                // Převedeme číselný index na ID
                winnerId = game.players[updatedState.winner].socket.userId;
            }
            console.log('Určen vítěz:', {
                winnerIndex: updatedState.winner,
                winnerId: winnerId,
                player1Id: game.players[0].socket.userId,
                player2Id: game.players[1].socket.userId
            });

            // Zavoláme handleGameEnd pro zápis do DB
            await this.handleGameEnd(gameId, winnerId);

            // Informujeme oba hráče o konci hry
            game.players.forEach((player, index) => {
                const playerView = this.createPlayerView(updatedState, index);
                player.socket.emit('gameState', playerView);
            });

            // Ukončíme hru a vyčistíme
            setTimeout(() => {
                this.games.delete(gameId);
                game.players.forEach(player => {
                    this.playerGameMap.delete(player.socket.id);
                });
            }, 5000); // Počkáme 5 sekund před vyčištěním
        } else {
            this.games.set(gameId, updatedState);
            this.broadcastGameState(gameId);
        }
    }

    handleEndTurn(gameId, playerIndex) {
        const game = this.games.get(gameId);
        if (!game || game.currentPlayer !== playerIndex) return;

        // Vyčistíme animaci před změnou tahu
        game.animation = null;

        const nextPlayer = (playerIndex + 1) % 2;
        const updatedState = startNextTurn(game, nextPlayer);

        this.games.set(gameId, updatedState);
        this.broadcastGameState(gameId);

        // Pokud je další hráč AI, spustíme jeho tah
        if (updatedState.isAIGame && nextPlayer === 1) {
            setTimeout(() => this.makeAIMove(gameId), 1000);
        }
    }

    handleDisconnect(gameId, playerIndex) {
        console.log(`Hráč se odpojil: GameID ${gameId}, PlayerIndex ${playerIndex}`);
        const game = this.games.get(gameId);
        if (!game) return;

        const player = game.players[playerIndex];
        const userId = player.socket.userId;

        // Uložíme informace o odpojeném hráči
        this.disconnectedPlayers.set(userId, {
            gameId,
            playerIndex,
            disconnectTime: Date.now()
        });

        // Informujeme protihráče
        const opponent = game.players[1 - playerIndex];
        if (opponent && opponent.socket) {
            opponent.socket.emit('opponentDisconnected', {
                message: 'Opponent disconnected. Waiting for reconnect...',
                remainingTime: this.RECONNECT_TIMEOUT / 1000
            });
        }

        // Nastavíme časovač pro ukončení hry
        setTimeout(() => {
            const disconnectInfo = this.disconnectedPlayers.get(userId);
            if (disconnectInfo) {
                // Hráč se nevrátil včas
                this.handleGameTimeout(gameId, playerIndex);
                this.disconnectedPlayers.delete(userId);
            }
        }, this.RECONNECT_TIMEOUT);
    }

    // Přidáme metodu pro zpracování timeoutu hry
    handleGameTimeout(gameId, playerIndex) {
        const game = this.games.get(gameId);
        if (!game) return;

        // Zkontrolujeme, zda jsou oba hráči odpojeni
        const bothDisconnected = game.players.every(player => 
            this.disconnectedPlayers.has(player.socket.userId)
        );

        if (bothDisconnected) {
            // Uklidíme hru
            this.cleanupGame(gameId);
        } else {
            const winner = 1 - playerIndex;
            // Ukončíme hru ve prospěch připojeného hráče
            this.handleGameEnd(gameId, game.players[winner].socket.userId,true);
            
            // Informujeme připojeného hráče
            const opponent = game.players[winner];
            if (opponent && opponent.socket) {
                opponent.socket.emit('gameOver', {
                    winner: winner,
                    reason: 'opponent_disconnected'
                });
            }
        }
    }

    // Přidáme metodu pro úklid hry
    cleanupGame(gameId) {
        const game = this.games.get(gameId);
        if (!game) return;

        // Odstraníme všechny reference na hru
        game.players.forEach(player => {
            this.playerGameMap.delete(player.socket.id);
            this.disconnectedPlayers.delete(player.socket.userId);
        });

        this.games.delete(gameId);
    }

    // Přidáme metodu pro reconnect
    async handleReconnect(socket, userId) {
        const disconnectInfo = this.disconnectedPlayers.get(userId);
        if (!disconnectInfo) return false;

        const { gameId, playerIndex } = disconnectInfo;
        const game = this.games.get(gameId);
        if (!game) return false;

        // Aktualizujeme socket v game state
        game.players[playerIndex].socket = socket;
        this.playerGameMap.set(socket.id, gameId);
        this.disconnectedPlayers.delete(userId);

        // Nastavíme event listenery pro nový socket
        this.setupGameListeners(gameId, socket, playerIndex);

        // Informujeme oba hráče
        const opponent = game.players[1 - playerIndex];
        if (opponent && opponent.socket) {
            opponent.socket.emit('opponentReconnected');
        }
        socket.emit('reconnectedToGame', {
            gameId,
            gameState: this.createPlayerView(game, playerIndex)
        });

        return true;
    }

    // Přidat do třídy GameManager
    getPlayerIndex(gameId, socketId) {
        const game = this.games.get(gameId);
        if (!game) return -1;

        return game.players.findIndex(player => player.socket.id === socketId);
    }

    // Přidáme metodu pro zrušení hledání hry
    cancelSearch(socket) {
        this.searchingPlayers.delete(socket.id);
        console.log(`Hráč ${socket.id} zrušil hledání. Počet hledajících: ${this.searchingPlayers.size}`);
    }

    async handleGameEnd(gameId, winnerId,endedByDisconnect) {
        const game = this.games.get(gameId);
        if (!game) return;

        try {
            // Nastavíme gameOver před zpracováním konce hry
            game.gameOver = true;
            game.winner = game.players.findIndex(p => p.socket.userId === winnerId);

            // Rozdělíme logiku pro PvP a AI hry
            if (game.isAIGame) {
                await this.handleAIGameEnd(game, winnerId);
                
                // Pro AI hry počkáme 5 sekund a pak vyčistíme hru
                setTimeout(() => {
                    this.games.delete(gameId);
                    // Vyčistíme také playerGameMap pro lidského hráče
                    const humanPlayer = game.players.find(p => !p.socket.isAI);
                    if (humanPlayer) {
                        this.playerGameMap.delete(humanPlayer.socket.id);
                    }
                }, 5000);
            } else {
                await this.handlePvPGameEnd(game, winnerId,endedByDisconnect);
            }

            // Odešleme finální stav hry
            this.broadcastGameState(gameId);
            console.log('Úspěšně zpracován konec hry');

        } catch (error) {
            console.error('Error handling game end:', error);
        }
    }

    // Nová metoda pro zpracování odměn a výzev
    async processRewardsAndChallenges(playerId, isWinner, isAIGame) {
        // Objekt pro ukládání odměn a progressu
        const rewards = {
            gold: 0,
            completedChallenges: [],
            challengeProgress: []
        };

        // Základní odměna za hru (menší pro AI hry)
        const baseReward = isAIGame ? 25 : 50;
        if (isWinner) {
            rewards.gold = baseReward;
        }

        // Aktualizace výzev
        const { data: playerChallenges } = await this.supabase
            .from('player_challenges')
            .select('*, challenge:challenges(*)')
            .eq('player_id', playerId)
            .eq('completed', false);

        if (playerChallenges) {
            for (const pc of playerChallenges) {
                let newProgress = pc.progress;
                let wasCompleted = false;
                let progressMade = false;

                // Některé výzvy nezapočítáváme pro AI hry
                if (isAIGame && pc.challenge.condition_type === 'win_streak') {
                    continue;
                }

                switch (pc.challenge.condition_type) {
                    case 'win_streak':
                        if (isWinner) {
                            newProgress += 1;
                            progressMade = true;
                        } else {
                            newProgress = 0;
                        }
                        break;
                    case 'games_played':
                        newProgress += 1;
                        progressMade = true;
                        break;
                    case 'games_won':
                        if (isWinner) {
                            newProgress += 1;
                            progressMade = true;
                        }
                        break;
                }

                if (newProgress >= pc.challenge.condition_value) {
                    wasCompleted = true;
                    rewards.completedChallenges.push({
                        challengeName: pc.challenge.name,
                        reward: pc.challenge.reward_gold
                    });
                } else if (progressMade) {
                    rewards.challengeProgress.push({
                        challengeName: pc.challenge.name,
                        currentProgress: newProgress,
                        targetProgress: pc.challenge.condition_value
                    });
                }

                // Aktualizace progressu výzvy
                await this.supabase
                    .from('player_challenges')
                    .update({
                        progress: newProgress,
                        completed: wasCompleted
                    })
                    .eq('player_id', playerId)
                    .eq('challenge_id', pc.challenge.id);
            }
        }

        // Aktualizace měny hráče
        if (rewards.gold > 0) {
            const { data: currency } = await this.supabase
                .from('player_currency')
                .select('gold_amount')
                .eq('player_id', playerId)
                .single();

            await this.supabase
                .from('player_currency')
                .update({
                    gold_amount: currency.gold_amount + rewards.gold
                })
                .eq('player_id', playerId);
        }

        return rewards;
    }

    async handleAIGameEnd(game, winnerId) {
        const playerId = game.players[0].socket.userId; // Vždy hráč na indexu 0
        const isWinner = winnerId === playerId;

        // Zpracujeme odměny a výzvy
        const rewards = await this.processRewardsAndChallenges(playerId, isWinner, true);

        // Odešleme notifikaci o odměnách
        if (rewards.gold > 0 || rewards.completedChallenges.length > 0 || rewards.challengeProgress.length > 0) {
            game.players[0].socket.emit('rewardEarned', {
                gold: rewards.gold,
                message: `You earned ${rewards.gold} gold!`,
                completedChallenges: rewards.completedChallenges,
                challengeProgress: rewards.challengeProgress
            });
        }
    }

    async handlePvPGameEnd(game, winnerId,endedByDisconnect) {
        if (endedByDisconnect) {
            return;
        }
        const player1Id = game.players[0].socket.userId;
        const player2Id = game.players[1].socket.userId;

           // Uložíme originální balíčky
        const player1Deck = game.players[0].originalDeck || [];
        const player2Deck = game.players[1].originalDeck || [];

        // Vypočítáme délku hry
        const gameDuration = game.startTime ? new Date() - game.startTime : 0;

        // Uložíme historii hry
        await this.supabase
            .from('game_history')
            .insert([{
                player_id: player1Id,
                opponent_id: player2Id,
                winner_id: winnerId,
                game_duration: `${Math.floor(gameDuration / 1000)} seconds`,
                player_deck: player1Deck,
                opponent_deck: player2Deck,
                created_at: new Date().toISOString()
            }]);

        // Aktualizujeme statistiky hráčů
        await this.updatePlayerStats(player1Id, winnerId === player1Id);
        await this.updatePlayerStats(player2Id, winnerId === player2Id);

        // Zpracujeme odměny a výzvy pro oba hráče
        const player1Rewards = await this.processRewardsAndChallenges(player1Id, winnerId === player1Id, false);
        const player2Rewards = await this.processRewardsAndChallenges(player2Id, winnerId === player2Id, false);

        // Odešleme notifikace oběma hráčům
        game.players.forEach((player, index) => {
            const rewards = index === 0 ? player1Rewards : player2Rewards;
            if (rewards.gold > 0 || rewards.completedChallenges.length > 0 || rewards.challengeProgress.length > 0) {
                player.socket.emit('rewardEarned', {
                    gold: rewards.gold,
                    message: `You earned ${rewards.gold} gold!`,
                    completedChallenges: rewards.completedChallenges,
                    challengeProgress: rewards.challengeProgress
                });
            }
        });
    }

    async updatePlayerStats(userId, isWinner) {
        try {
            // Použijeme this.supabase místo globálního supabase
            const { data: profile, error: profileError } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;

            const updates = {
                total_games: profile.total_games + 1,
                wins: profile.wins + (isWinner ? 1 : 0),
                losses: profile.losses + (isWinner ? 0 : 1),
                rank: this.calculateNewRank(profile.rank, isWinner)
            };

            const { error: updateError } = await this.supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (updateError) throw updateError;

        } catch (error) {
            console.error('Chyba při aktualizaci statistik hráče:', error);
        }
    }

    calculateNewRank(currentRank, isWinner) {
        const RANK_CHANGE = 25;
        return isWinner ? currentRank + RANK_CHANGE : Math.max(0, currentRank - RANK_CHANGE);
    }

    async handlePlayerConnect(socket, userId) {
        try {
            // Získáme data hráče z databáze
            const { data: playerData, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            // Aktualizujeme nebo přidáme hráče do mapy
            this.onlinePlayers.set(userId, {
                id: userId,
                username: playerData.username,
                rank: playerData.rank,
                status: 'online',
                socketId: socket.id
            });

            // Přidáme handler pro požadavek na seznam hráčů
            socket.on('request_online_players', () => {
                this.broadcastOnlinePlayers();
            });

            this.broadcastOnlinePlayers();
        } catch (error) {
            console.error('Error handling player connect:', error);
        }
    }

    handlePlayerDisconnect(userId) {
        this.onlinePlayers.delete(userId);
        this.broadcastOnlinePlayers();
    }

    updatePlayerStatus(userId, status) {
        const player = this.onlinePlayers.get(userId);
        if (player) {
            player.status = status;
            this.broadcastOnlinePlayers();
        }
    }

    broadcastOnlinePlayers() {
        try {
            const players = Array.from(this.onlinePlayers.values()).map(player => ({
                id: player.id,
                username: player.username,
                rank: player.rank,
                status: player.status
            }));

            console.log('Broadcasting online players:', {
                playerCount: players.length,
                connectedSockets: this.io.sockets.sockets.size,
                players: players.map(p => ({
                    username: p.username,
                    status: p.status
                }))
            });

            // Broadcast všem připojeným klientům
            this.io.emit('online_players_update', players);

            // Pro ověření projdeme všechny připojené sockety
            this.io.sockets.sockets.forEach((socket) => {
                console.log('Sending to socket:', {
                    socketId: socket.id,
                    userId: socket.userId,
                    username: socket.username
                });
            });
        } catch (error) {
            console.error('Error broadcasting online players:', error);
        }
    }

    // Pomocná metoda pro převrácení indexů pole
    invertFieldIndex(index) {
        if (index === null || index === undefined) return index;
        return 6 - index; // Pro pole velikosti 7 (0-6)
    }

    // Přidáme novou metodu pro načtení dat hrdiny
    async loadHeroData(userId) {
        try {
            const { data: profile, error: profileError } = await this.supabase
                .from('profiles')
                .select(`
                    hero_id,
                    heroes (*)
                `)
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;
            return profile.heroes;
        } catch (error) {
            console.error('Error loading hero data:', error);
            // Vrátíme výchozího hrdinu (Mage)
            return {
                id: 1,
                name: 'Mage',
                ability_name: 'Fireblast',
                ability_description: 'Deal 2 damage to enemy hero',
                ability_cost: 2,
                image: 'mage'
            };
        }
    }

    // Přidáme novou metodu pro zpracování hrdinské schopnosti
    async handleHeroAbility(gameId, playerIndex) {
        console.log('Zpracování použití hrdinské schopnosti:', { gameId, playerIndex });
        
        const game = this.games.get(gameId);
        if (!game) {
            console.log('Hra neexistuje');
            return;
        }

        // Přidáme animační data před provedením akce
        game.animation = {
            type: 'heroAbility',
            player: game.players[playerIndex].username,
            hero: game.players[playerIndex].hero,
            target: game.players[1 - playerIndex].hero, // Pro Mage
            isHealing: game.players[playerIndex].hero.id === 2 // Pro Priest
        };

        // Vytvoříme nový stav pomocí funkce useHeroAbility
        const newState = useHeroAbility(game, playerIndex);
        
        // Pokud funkce vrátila false nebo undefined, něco se nepovedlo
        if (!newState) {
            console.log('Použití schopnosti se nezdařilo');
            return;
        }

        // Kontrola konce hry
        if (newState.gameOver) {
            console.log('Hra skončila po použití hrdinské schopnosti');
            const winnerId = newState.winner === 'draw' 
                ? game.players[0].socket.userId 
                : game.players[newState.winner].socket.userId;

            await this.handleGameEnd(gameId, winnerId);

            // Informujeme oba hráče o konci hry
            game.players.forEach((player, index) => {
                const playerView = this.createPlayerView(newState, index);
                player.socket.emit('gameState', playerView);
            });

            // Ukončíme hru a vyčistíme
            setTimeout(() => {
                this.games.delete(gameId);
                game.players.forEach(player => {
                    this.playerGameMap.delete(player.socket.id);
                });
            }, 5000);
        } else {
            // Aktualizujeme stav hry a odešleme ho hráčům
            this.games.set(gameId, newState);           
            this.broadcastGameState(gameId);
        }
    }

    // Přidáme novou metodu pro vytvoření AI hry
    async createAIGame(playerSocket) {
        try {
            console.log('Creating AI game for player:', playerSocket.id);
            
            const gameId = this.generateGameId();
            console.log('Generated game ID:', gameId);

            // Náhodně vybereme AI hrdinu a odpovídající balíček
            const aiHeroChoice = Math.floor(Math.random() * 3) + 1; // 1 = Mage, 2 = Priest, 3 = Seer
            let aiDeck;
            let aiHero;

            switch (aiHeroChoice) {
                case 1:
                    aiDeck = this.createMageDeck();
                    aiHero = {
                        id: 1,
                        name: 'Mage',
                        ability_name: 'Fireblast',
                        ability_description: 'Deal 2 damage to enemy hero',
                        ability_cost: 2,
                        image: 'mage'
                    };
                    break;
                case 2:
                    aiDeck = this.createPriestDeck();
                    aiHero = {
                        id: 2,
                        name: 'Priest',
                        ability_name: 'Lesser Heal',
                        ability_description: 'Restore 2 health to your hero',
                        ability_cost: 2,
                        image: 'priest'
                    };
                    break;
                case 3:
                    aiDeck = this.createSeerDeck();
                    aiHero = {
                        id: 3,
                        name: 'Seer',
                        ability_name: 'Fortune Draw',
                        ability_description: 'Draw a random card from your deck',
                        ability_cost: 2,
                        image: 'seer'
                    };
                    break;
            }

            // Vytvoříme mock socket pro AI
            const aiSocket = {
                id: 'ai-bot',
                isAI: true,
                emit: () => {}, // Prázdná funkce, protože AI nepotřebuje dostávat události
                join: () => {}, // Prázdná funkce pro kompatibilitu s Socket.IO
                on: () => {}    // Prázdná funkce pro kompatibilitu s Socket.IO
            };

            // Načteme data hrdiny pro hráče
            const playerHero = await this.loadHeroData(playerSocket.userId);
            if (!playerHero) {
                throw new Error('Failed to load player hero data');
            }

            // Inicializace balíčku pro hráče
            const playerDeck = await this.loadPlayerDeck(playerSocket.userId);
            if (!playerDeck || playerDeck.length === 0) {
                throw new Error('Failed to load player deck');
            }

            const gameState = {
                gameId,
                players: [
                    {
                        socket: playerSocket,
                        username: playerSocket.username,
                        hero: new Hero(playerSocket.username, 30, playerHero),
                        deck: playerDeck,
                        hand: playerDeck.splice(0, 3),
                        field: [],
                        mana: 1,
                        maxMana: 1,
                        originalDeck: [...playerDeck],
                        fatigueDamage: 0,
                        secrets: []
                    },
                    {
                        socket: aiSocket, // Použijeme ná mock socket
                        username: 'AI Opponent',
                        hero: new Hero('AI Opponent', 30, aiHero),
                        deck: aiDeck,
                        hand: [...aiDeck.splice(0, 3), new SpellCard('coin', 'The Coin', 0, 'Gain 1 Mana Crystal', 'coinImage')],
                        field: [],
                        mana: 0,
                        maxMana: 0,
                        originalDeck: [...aiDeck],
                        fatigueDamage: 0,
                        secrets: []
                    }
                ],
                currentPlayer: 0,
                turn: 1,
                gameOver: false,
                winner: null,
                startTime: new Date(),
                endTurnEffects: [],
                startTurnEffects: [],
                combatLogMessages: [],
                deadMinionsCount: 0,  // Přidáme počítadlo mrtvých minionů
                isAIGame: true
            };

            console.log('Game state initialized');

            this.games.set(gameId, gameState);
            this.setupGameListeners(gameId, playerSocket, 0);
            this.playerGameMap.set(playerSocket.id, gameId);

            console.log('Game setup completed, emitting initial state');

            // Odešleme počáteční stav hry
            this.broadcastGameState(gameId);

            return gameId;
        } catch (error) {
            console.error('Error in createAIGame:', error);
            throw error;
        }
    }

    // Přidáme metodu pro provedení AI tahu
    async makeAIMove(gameId) {
        try {
            const game = this.games.get(gameId);
            // Přidáme kontrolu na gameOver hned na začátku
            if (!game || !game.isAIGame || game.currentPlayer !== 1 || game.gameOver) {
                return;
            }

            const ai = new AIPlayer(game, 1);
            
            while (true) {
                try {
                    // Získáme aktuální stav hry před každým tahem
                    const currentGame = this.games.get(gameId);
                    // Rozšíříme podmínku o kontrolu gameOver
                    if (!currentGame || currentGame.gameOver || currentGame.currentPlayer !== 1) {
                        return;
                    }

                    // Vytvoříme novou instanci AI s aktuálním stavem
                    const ai = new AIPlayer(currentGame, 1);
                    const move = await ai.makeMove();

                    if (!move) {
                        console.log('AI nemá žádný validní tah, končí tah');
                        this.handleEndTurn(gameId, 1);
                        return;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Znovu zkontrolujeme stav hry před provedením tahu
                    const gameBeforeMove = this.games.get(gameId);
                    // Přidáme kontrolu gameOver i zde
                    if (!gameBeforeMove || gameBeforeMove.gameOver || gameBeforeMove.currentPlayer !== 1) {
                        return;
                    }

                    let success = false;
                    switch (move.type) {
                        case 'playCard':
                            success = await this.handlePlayCard(gameId, 1, move);
                            break;
                        case 'attack':
                            // Dodatečná validace před útokem
                            if (this.validateAttack(gameBeforeMove, 1, move)) {
                                success = await this.handleAttack(gameId, 1, move);
                            }
                            break;
                        case 'heroAbility':
                            success = await this.handleHeroAbility(gameId, 1);
                            break;
                        case 'endTurn':
                            this.handleEndTurn(gameId, 1);
                            return;
                    }

                    if (!success) {
                        console.log('AI tah selhal, zkouší další tah');
                        continue;
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error('Chyba během AI tahu:', error);
                    this.handleEndTurn(gameId, 1);
                    return;
                }
            }
        } catch (error) {
            console.error('Kritická chyba v makeAIMove:', error);
            const game = this.games.get(gameId);
            if (game) {
                game.gameOver = true;
                game.winner = 0;
                this.broadcastGameState(gameId);
            }
        }
    }

    // Přidáme pomocnou metodu pro validaci útoku
    validateAttack(game, playerIndex, move) {
        const player = game.players[playerIndex];
        const opponent = game.players[1 - playerIndex];

        // Kontrola existence útočníka
        if (!player.field[move.attackerIndex]) {
            console.log('Útočník neexistuje');
            return false;
        }

        // Kontrola, zda útočník může útočit
        const attacker = player.field[move.attackerIndex];
        if (attacker.hasAttacked || attacker.frozen) {
            console.log('Útočník nemůže útočit');
            return false;
        }

        // Pro útok na hrdinu
        if (move.isHeroTarget) {
            // Kontrola Taunt
            if (opponent.field.some(unit => unit && unit.hasTaunt)) {
                console.log('Nelze útočit na hrdinu přes Taunt');
                return false;
            }
            return true;
        }

        // Pro útok na jednotku
        if (!opponent.field[move.targetIndex]) {
            console.log('Cíl útoku neexistuje');
            return false;
        }

        // Kontrola Taunt pro útok na jednotku
        const hasTaunt = opponent.field.some(unit => unit && unit.hasTaunt);
        if (hasTaunt && !opponent.field[move.targetIndex].hasTaunt) {
            console.log('Musí nejdřív zaútočit na Taunt');
            return false;
        }

        return true;
    }

    // Přidáme nové metody pro AI balíčky
    createMageDeck() {
        // Původní agresivní balíček zůstává pro mága
        return this.createDefaultDeck();
    }

    createPriestDeck() {
        const baseDeck = [
            // Defenzivní jednotky s Taunt (2 kopie každé)
            ...Array(2).fill({ id: 2, name: 'Shield Bearer', manaCost: 2, attack: 1, health: 7, effect: 'Taunt', image: 'shieldBearer', rarity: 'common' }),
            ...Array(2).fill({ id: 6, name: 'Earth Golem', manaCost: 5, attack: 4, health: 8, effect: 'Taunt', image: 'earthGolem', rarity: 'uncommon' }),
            ...Array(2).fill({ id: 43, name: 'Mountain Giant', manaCost: 7, attack: 6, health: 9, effect: 'Taunt', image: 'mountainGiant', rarity: 'rare' }),
            ...Array(2).fill({ id: 44, name: 'Light Champion', manaCost: 6, attack: 5, health: 5, effect: 'Divine Shield', image: 'lightChampion', rarity: 'uncommon' }),
            
            // Léčivé a kontrolní jednotky
            ...Array(2).fill({ id: 9, name: 'Nimble Sprite', manaCost: 1, attack: 1, health: 2, effect: 'Draw a card when played', image: 'nimbleSprite', rarity: 'common' }),
            ...Array(2).fill({ id: 5, name: 'Water Elemental', manaCost: 3, attack: 3, health: 5, effect: 'Freeze random enemy minion when played', image: 'waterElemental', rarity: 'rare' }),
            ...Array(2).fill({ name: 'Crystal Guardian', manaCost: 5, attack: 3, health: 6, effect: 'Divine Shield, Taunt. When Divine Shield is broken, restore 3 health to your hero', image: 'crystalGuardian', rarity: 'rare' }),
            ...Array(2).fill({ name: 'Spirit Healer', manaCost: 5, attack: 4, health: 4, effect: 'When you cast a spell, restore 2 health to your hero', image: 'spiritHealer', rarity: 'rare' }),
            
            // Léčivá kouzla
            ...Array(2).fill({ id: 4, name: 'Healing Touch', manaCost: 3, effect: 'Restore 8 health', image: 'healingTouch', rarity: 'common' }),
            ...Array(2).fill({ name: 'Holy Nova', manaCost: 5, effect: 'Deal 2 damage to all enemies and restore 2 health to all friendly characters', image: 'holyNova', rarity: 'rare' }),
            
            // Kontrolní kouzla
            ...Array(2).fill({ name: 'Mass Fortification', manaCost: 4, effect: 'Give all friendly minions Taunt and +0/+2', image: 'massFortification', rarity: 'rare' }),
            ...Array(2).fill({ id: 11, name: 'Glacial Burst', manaCost: 3, effect: 'Freeze all enemy minions', image: 'glacialBurst', rarity: 'epic' }),
            
            // Legendární karta
            { name: 'Ancient Protector', manaCost: 8, attack: 5, health: 9, effect: 'Divine Shield, Taunt. Adjacent minions also gain Divine Shield', image: 'ancientProtector', rarity: 'legendary' },
            
            // Doplnění do 30 karet
            ...Array(2).fill({ name: 'Guardian Totem', manaCost: 4, attack: 2, health: 5, effect: 'Taunt. Adjacent minions gain Taunt', image: 'guardianTotem', rarity: 'rare' }),
            ...Array(2).fill({ name: 'Stone Guardian', manaCost: 3, attack: 2, health: 5, effect: 'Taunt', image: 'stoneGuardian', rarity: 'common' })
        ];

        return this.createDeckFromTemplate(baseDeck);
    }

    createSeerDeck() {
        const baseDeck = [
            // Karty s efekty při seslání kouzel (2 kopie každé)
            ...Array(2).fill({ id: 10, name: 'Arcane Familiar', manaCost: 1, attack: 1, health: 3, effect: 'Gain +1 attack when you cast a spell', image: 'arcaneFamiliar', rarity: 'epic' }),
            ...Array(2).fill({ id: 15, name: 'Mana Wyrm', manaCost: 2, attack: 2, health: 3, effect: 'Gain +1 attack when you cast a spell', image: 'manaWyrm', rarity: 'rare' }),
            ...Array(2).fill({ name: 'Battle Mage', manaCost: 4, attack: 3, health: 5, effect: 'When you cast a spell, this minion gains +2 attack this turn', image: 'battleMage', rarity: 'rare' }),
            
            // Karty pro manipulaci s manou
            ...Array(2).fill({ id: 9, name: 'Nimble Sprite', manaCost: 1, attack: 1, health: 2, effect: 'Draw a card when played', image: 'nimbleSprite', rarity: 'common' }),

            ...Array(2).fill({ name: 'Mana Collector', manaCost: 5, attack: 3, health: 6, effect: 'At the start of your turn, gain mana equal to this minions attack', image: 'manaCollector', rarity: 'uncommon' }),
            
            // Kouzla pro lízání karet
            ...Array(2).fill({ id: 8, name: 'Arcane Intellect', manaCost: 3, effect: 'Draw 2 cards', image: 'arcaneIntellect', rarity: 'rare' }),
            ...Array(2).fill({ name: 'Spell Seeker', manaCost: 2, attack: 2, health: 3, effect: 'Draw a random spell from your deck when played', image: 'spellSeeker', rarity: 'rare' }),
            
            // Kontrolní kouzla
            ...Array(2).fill({ name: 'Mirror Image', manaCost: 2, effect: 'Create two 0/2 Mirror Images with Taunt', image: 'mirrorImage', rarity: 'rare' }),
            ...Array(2).fill({ name: 'Arcane Explosion', manaCost: 2, effect: 'Deal 1 damage to all enemy minions', image: 'arcaneExplosion', rarity: 'common' }),
            
            // Silná kouzla
            ...Array(2).fill({ name: 'Mana Surge', manaCost: 3, effect: 'Restore your mana crystals to maximum available this turn', image: 'manaSurge', rarity: 'epic' }),
            ...Array(2).fill({ name: 'Arcane Storm', manaCost: 7, effect: 'Deal 8 damage to all characters', image: 'arcaneStorm', rarity: 'epic' }),
            
            // Legendární karta
            { name: 'Time Weaver', manaCost: 8, attack: 6, health: 8, effect: 'At the end of your turn, restore 2 health to all friendly characters', image: 'timeWeaver', rarity: 'legendary' },
            
            // Doplnění do 30 karet
            ...Array(2).fill({ name: 'Spell Weaver', manaCost: 4, attack: 3, health: 3, effect: 'Gain +1/+1 for each spell in your hand when played', image: 'spellWeaver', rarity: 'epic' }),
            ...Array(2).fill({ name: 'Arcane Guardian', manaCost: 3, attack: 2, health: 4, effect: 'Has +1 health for each spell in your hand', image: 'arcaneGuardian', rarity: 'common' })
        ];

        return this.createDeckFromTemplate(baseDeck);
    }

    // Pomocná funkce pro vytvoření balíčku z šablony
    createDeckFromTemplate(template) {
        return template.map(card => {
            const uniqueId = `ai-${card.id || Math.random()}-${Math.random()}`;
            if (card.attack !== undefined) {
                return new UnitCard(
                    uniqueId,
                    card.name,
                    card.manaCost,
                    card.attack,
                    card.health,
                    card.effect,
                    card.image,
                    card.rarity
                );
            } else {
                return new SpellCard(
                    uniqueId,
                    card.name,
                    card.manaCost,
                    card.effect,
                    card.image,
                    card.rarity
                );
            }
        }).sort(() => Math.random() - 0.5);
    }

}

module.exports = GameManager;
