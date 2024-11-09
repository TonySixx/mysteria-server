const { Card, UnitCard, SpellCard, Hero } = require('./game/CardClasses');
const { startNextTurn, checkGameOver, playCardCommon, handleUnitEffects, useHeroAbility } = require('./game/gameLogic');
const { attack } = require('./game/combatLogic');
const { createClient } = require('@supabase/supabase-js');

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

        const gameState = {
            players: [
                {
                    socket: player1Socket,
                    username: player1Socket.username,
                    hero: new Hero(player1Socket.username, 30, player1Hero),
                    deck: player1Deck,
                    hand: player1Deck.splice(0, 3),
                    field: [],
                    mana: 1,
                    maxMana: 1,
                    originalDeck: [...player1Deck]
                },
                {
                    socket: player2Socket,
                    username: player2Socket.username,
                    hero: new Hero(player2Socket.username, 30, player2Hero),
                    deck: player2Deck,
                    hand: [...player2Deck.splice(0, 3), new SpellCard('coin', 'The Coin', 0, 'Gain 1 Mana Crystal', 'coinImage')],
                    field: [],
                    mana: 0,
                    maxMana: 0,
                    originalDeck: [...player2Deck]
                }
            ],
            currentPlayer: 0,
            turn: 1,
            gameOver: false,
            winner: null,
            startTime: new Date(),
            spellsPlayedThisGame: 0,
            endTurnEffects: [],
            startTurnEffects: [],
            combatLogMessages: []
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
        // Přesuneme původní logiku vytváření balíčku sem
        const baseDeck = [
            // Základní jednotky (3 kopie každé)
            ...Array(3).fill({ id: 1, name: 'Fire Elemental', manaCost: 4, attack: 5, health: 6, effect: 'Deals 2 damage when played', image: 'fireElemental', rarity: 'rare' }),
            ...Array(3).fill({ id: 2, name: 'Shield Bearer', manaCost: 2, attack: 1, health: 7, effect: 'Taunt', image: 'shieldBearer', rarity: 'common' }),
            ...Array(3).fill({ id: 5, name: 'Water Elemental', manaCost: 3, attack: 3, health: 5, effect: 'Freeze enemy when played', image: 'waterElemental', rarity: 'rare' }),
            ...Array(3).fill({ id: 6, name: 'Earth Golem', manaCost: 5, attack: 4, health: 8, effect: 'Taunt', image: 'earthGolem', rarity: 'uncommon' }),
            ...Array(3).fill({ id: 9, name: 'Nimble Sprite', manaCost: 1, attack: 1, health: 2, effect: 'Draw a card when played', image: 'nimbleSprite', rarity: 'common' }),
            ...Array(3).fill({ id: 10, name: 'Arcane Familiar', manaCost: 1, attack: 1, health: 3, effect: 'Gain +1 attack for each spell cast', image: 'arcaneFamiliar', rarity: 'epic' }),

            // Běžná kouzla (3 kopie každého)
            ...Array(3).fill({ id: 3, name: 'Fireball', manaCost: 4, effect: 'Deal 6 damage', image: 'fireball', rarity: 'uncommon' }),
            ...Array(3).fill({ id: 7, name: 'Lightning Bolt', manaCost: 2, effect: 'Deal 3 damage', image: 'lightningBolt', rarity: 'common' }),

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
        return Math.random().toString(36).substring(2, 15);
    }

    // Broadcast aktuálního stavu hry oběma hráčům
    broadcastGameState(gameId) {
        const game = this.games.get(gameId);
        if (!game) return;

        // Odešleme stav oběma hráčům
        game.players.forEach((player, index) => {
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

            player.socket.emit('gameState', playerView);
        });

        // Vyčistíme combat log zprávy a animace
        game.combatLogMessages = [];
        game.animation = null;
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
            spellsPlayedThisGame: game.spellsPlayedThisGame || 0,
            player: {
                hero: player.hero,
                hand: player.hand,
                field: player.field,
                deck: player.deck.length,
                mana: player.mana,
                maxMana: player.maxMana,
                username: player.username
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
                username: opponent.username
            },
            notification: notification,
            combatLogMessages: game.combatLogMessages || [],
            animation: game.animation
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

        // Přidáme animační data před provedením akce
        game.animation = {
            type: 'playCard',
            player: game.players[playerIndex].username,
            card: card,
            sourceIndex: cardIndex,
            targetIndex: destinationIndex
        };

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
            // Ukončíme hru ve prospěch připojeného hráče
            const winner = 1 - playerIndex;
            this.handleGameEnd(gameId, game.players[winner].socket.userId);
            
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

    async handleGameEnd(gameId, winnerId) {
        const game = this.games.get(gameId);
        if (!game) return;

        try {
            const player1Id = game.players[0].socket.userId;
            const player2Id = game.players[1].socket.userId;

            // Uložíme originální balíčky (pokud existují, jinak prázdné pole)
            const player1Deck = game.players[0].originalDeck || [];
            const player2Deck = game.players[1].originalDeck || [];

            // Vypočítáme délku hry
            const gameDuration = game.startTime ? new Date() - game.startTime : 0;

            console.log('Ukládám výsledky hry:', {
                player1Id,
                player2Id,
                winnerId,
                gameDuration,
                deckSizes: {
                    player1: player1Deck.length,
                    player2: player2Deck.length
                }
            });

            // Použijeme this.supabase místo globálního supabase
            const { data: historyData, error: historyError } = await this.supabase
                .from('game_history')
                .insert([{
                    player_id: player1Id,
                    opponent_id: player2Id,
                    winner_id: winnerId,
                    game_duration: `${Math.floor(gameDuration / 1000)} seconds`, // Převedeme na sekundy a formátujeme pro INTERVAL
                    player_deck: player1Deck,
                    opponent_deck: player2Deck,
                    created_at: new Date().toISOString()
                }]);

            if (historyError) {
                console.error('Chyba při ukládání historie:', historyError);
                throw historyError;
            }

            // Aktualizujeme statistiky hráčů
            await this.updatePlayerStats(player1Id, winnerId === player1Id);
            await this.updatePlayerStats(player2Id, winnerId === player2Id)

            // Objekt pro ukládání odměn a progressu pro oba hráče
            const rewards = {
                [player1Id]: { gold: 0, completedChallenges: [] },
                [player2Id]: { gold: 0, completedChallenges: [] }
            };

            // Základní odměna pouze pro vítěze
            const baseReward = 50;
            rewards[winnerId].gold = baseReward;

            // Aktualizace výzev pro oba hráče
            const updatePlayerChallenges = async (playerId, isWinner) => {
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

                        switch (pc.challenge.condition_type) {
                            case 'win_streak':
                                if (isWinner) {
                                    newProgress += 1;
                                    progressMade = true;
                                } else {
                                    newProgress = 0; // Reset streak on loss
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

                        // Kontrola dokončení výzvy
                        if (newProgress >= pc.challenge.condition_value) {
                            wasCompleted = true;
                            rewards[playerId].completedChallenges.push({
                                challengeName: pc.challenge.name,
                                reward: pc.challenge.reward_gold
                            });
                        } else if (progressMade) {
                            // Přidáme informaci o postupu ve výzvě
                            if (!rewards[playerId].challengeProgress) {
                                rewards[playerId].challengeProgress = [];
                            }
                            rewards[playerId].challengeProgress.push({
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
            };

            // Aktualizujeme výzvy pro oba hráče
            await updatePlayerChallenges(player1Id, player1Id === winnerId);
            await updatePlayerChallenges(player2Id, player2Id === winnerId);

            // Přidáme pouze základní odměnu vítězi
            const { data: winnerCurrency } = await this.supabase
                .from('player_currency')
                .select('gold_amount')
                .eq('player_id', winnerId)
                .single();

            await this.supabase
                .from('player_currency')
                .update({
                    gold_amount: winnerCurrency.gold_amount + baseReward
                })
                .eq('player_id', winnerId);

            // Odešleme notifikace oběma hráčům
            game.players.forEach(player => {
                const playerId = player.socket.userId;
                const playerRewards = rewards[playerId];

                if (playerRewards.gold > 0 || 
                    playerRewards.completedChallenges.length > 0 || 
                    (playerRewards.challengeProgress && playerRewards.challengeProgress.length > 0)) {
                    player.socket.emit('rewardEarned', {
                        gold: playerRewards.gold,
                        message: `You earned ${playerRewards.gold} gold!`,
                        completedChallenges: playerRewards.completedChallenges,
                        challengeProgress: playerRewards.challengeProgress
                    });
                }
            });

            console.log('Úspěšně uloženy výsledky hry a aktualizovány statistiky');

        } catch (error) {
            console.error('Error handling game end:', error);
        }
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
}

module.exports = GameManager;
