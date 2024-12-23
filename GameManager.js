const { Card, UnitCard, SpellCard, Hero } = require('./game/CardClasses');
const { startNextTurn, checkGameOver, playCardCommon, handleUnitEffects } = require('./game/gameLogic');
const { attack } = require('./game/combatLogic');

class GameManager {
    constructor() {
        this.games = new Map(); // Map pro ukládání aktivních her
        this.searchingPlayers = new Set(); // Nový Set pro aktivně hledající hráče
        this.playerGameMap = new Map(); // Nová mapa pro sledování, ve které hře je který hráč
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
            console.log(`Vytvořena nová hra s ID: ${gameId}`);

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
    createGame(player1Socket, player2Socket) {
        const gameId = this.generateGameId();

        // Inicializace balíčků pro oba hráče
        const [player1Deck, player2Deck] = this.initializeDecks();

        const gameState = {
            players: [
                {
                    socket: player1Socket,
                    hero: new Hero('Player 1', 30), // Explicitně nastavíme jméno
                    deck: player1Deck,
                    hand: player1Deck.splice(0, 3),
                    field: [],
                    mana: 1,
                    maxMana: 1
                },
                {
                    socket: player2Socket,
                    hero: new Hero('Player 2', 30), // Explicitně nastavíme jméno
                    deck: player2Deck,
                    hand: [...player2Deck.splice(0, 3), new SpellCard('coin', 'The Coin', 0, 'Gain 1 Mana Crystal', 'coinImage')],
                    field: [],
                    mana: 0,
                    maxMana: 0
                }
            ],
            currentPlayer: 0,
            turn: 1,
            gameOver: false,
            winner: null
        };

        this.games.set(gameId, gameState);
        this.setupGameListeners(gameId, player1Socket, 0);
        this.setupGameListeners(gameId, player2Socket, 1);
        this.broadcastGameState(gameId);

        return gameId;
    }

    initializeDecks() {
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

        // Vytvoření karet s unikátními ID pro každého hráče
        const createPlayerDeck = (playerIndex) => {
            return baseDeck.map(card => {
                const uniqueId = `${playerIndex}-${card.id}-${Math.random()}`;
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
            }).sort(() => Math.random() - 0.5); // Zamíchání balíčku
        };

        // Kontrola velikosti balíčku
        console.log('Velikost balíčku:', baseDeck.length);
        console.log('Složení balíčku:', baseDeck.map(card => card.name));

        return [createPlayerDeck(0), createPlayerDeck(1)];
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

        socket.on('endTurn', () => {
            console.log(`Hráč ${socket.id} končí tah`);
            this.handleEndTurn(gameId, playerIndex);
        });

        socket.on('disconnect', () => {
            console.log(`Hráč ${socket.id} se odpojil z game ${gameId}`);
            this.handleDisconnect(gameId, playerIndex);
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
            player.socket.emit('gameState', playerView);
        });

        // Po odeslání vymažeme combatLogMessage
        game.combatLogMessage = null;
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
                maxMana: player.maxMana
            },
            opponent: {
                hero: opponent.hero,
                // Přidáme informace o kartách v ruce protihráče
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
                maxMana: opponent.maxMana
            },
            notification: notification,
            combatLogMessage: game.combatLogMessage,
        };
    }

    // Zpracování herních akcí
    handlePlayCard(gameId, playerIndex, data) {
        const game = this.games.get(gameId);
        if (!game) return;

        // Kontrola, zda je hráč na tahu
        if (game.currentPlayer !== playerIndex) {
            game.notification = {
                message: 'Not your turn!',
                forPlayer: playerIndex
            };
            this.broadcastGameState(gameId);
            return;
        }

        const { cardIndex, destinationIndex, target } = data;

        // Použijeme jednotnou funkci playCardCommon pro všechny typy karet
        const updatedState = playCardCommon(game, playerIndex, cardIndex, target, destinationIndex);
        
        // Aktualizujeme notifikaci
        if (updatedState.notification) {
            game.notification = updatedState.notification;
        } 
        this.games.set(gameId, updatedState);
        this.broadcastGameState(gameId);
    }

    handleAttack(gameId, playerIndex, data) {
        const game = this.games.get(gameId);
        if (!game || game.currentPlayer !== playerIndex) {
            // Pokud hráč není na tahu, pošleme mu notifikaci
            game.notification = {
                message: 'Nejste na tahu!',
                forPlayer: playerIndex
            };
            this.broadcastGameState(gameId);
            return;
        }

        const updatedState = attack(
            data.attackerIndex,
            data.targetIndex,
            data.isHeroTarget,
            false
        )(game);

        // Aktualizujeme notifikaci
        if (updatedState.notification) {
            game.notification = updatedState.notification;
        }

        if (updatedState.gameOver) {
            console.log('Hra skončila, vítěz:', updatedState.winner);
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

        const nextPlayer = (playerIndex + 1) % 2;
        const updatedState = startNextTurn(game, nextPlayer);

        this.games.set(gameId, updatedState);
        this.broadcastGameState(gameId);
    }

    handleDisconnect(gameId, playerIndex) {
        const game = this.games.get(gameId);
        if (!game) return;

        const disconnectedSocket = game.players[playerIndex].socket;

        // Vyčistíme všechny reference na hráče
        this.searchingPlayers.delete(disconnectedSocket.id);
        this.playerGameMap.delete(disconnectedSocket.id);

        // Informujeme protihráče
        const opponent = game.players[1 - playerIndex];
        if (opponent && opponent.socket) {
            opponent.socket.emit('opponentDisconnected');
            this.playerGameMap.delete(opponent.socket.id);
        }

        // Ukončíme hru
        this.games.delete(gameId);
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
}

module.exports = GameManager;
