require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const GameManager = require('./GameManager');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Inicializace Supabase klienta
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// CORS konfigurace - musí být na začátku před všemi endpointy
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,https://mysteria.vercel.app").split(',').map(origin => origin.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Povolíme požadavky bez origin (např. z Postman nebo při lokálním vývoji)
        if (!origin) return callback(null, true);
        
        if (corsOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            console.log('CORS rejected origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true
}));

// Middleware pro logování
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Statické soubory
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
} else {
    app.use(express.static('public'));
}

const gameManager = new GameManager(io);  // Předáme io instanci

// Socket.IO error handling
io.engine.on("connection_error", (err) => {
    console.log(err.req);      // the request object
    console.log(err.code);     // the error code, for example 1
    console.log(err.message);  // the error message, for example "Session ID unknown"
    console.log(err.context);  // some additional error context
});

// Middleware pro ověření JWT tokenu
const authenticateToken = (socket, next) => {
    const token = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId;
    const username = socket.handshake.auth.username;
    
    console.log('Autentizace socket připojení:', {
        hasToken: !!token,
        userId,
        username
    });

    if (!token || !userId || !username) {
        console.log('Chybějící autentizační údaje:', { 
            token: !!token, 
            userId: !!userId, 
            username: !!username 
        });
        return next(new Error('Chybí autentizační údaje'));
    }

    try {
        // Použijeme správný secret key ze Supabase
        const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET || 'your-jwt-secret');
        
        // Supabase JWT má jiný formát, upravíme kontrolu
        if (!decoded.sub && !decoded.user_id) {
            console.log('Chybí ID uživatele v tokenu');
            return next(new Error('Neplatný token - chybí ID uživatele'));
        }

        const tokenUserId = decoded.sub || decoded.user_id;
        if (tokenUserId !== userId) {
            console.log('Nesouhlasí ID uživatele:', { 
                decoded: tokenUserId, 
                userId 
            });
            return next(new Error('Neplatné ID uživatele'));
        }
        
        socket.userId = userId;
        socket.username = username;
        console.log('Úspěšná autentizace socket připojení:', {
            userId,
            username
        });
        next();
    } catch (err) {
        console.log('Chyba při ověření tokenu:', err.message);
        next(new Error('Neplatný token'));
    }
};

io.use(authenticateToken);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`New player connected (ID: ${socket.id}, User: ${socket.username})`);
    
    // Vypíšeme aktuální počet připojených klientů
    const connectedClients = io.sockets.sockets.size;
    console.log(`Current connected clients: ${connectedClients}`);

    // Přidáme inicializaci hráče při připojení
    gameManager.handlePlayerConnect(socket, socket.userId);

    socket.on('joinGame', (data) => {
        try {
            const { userId, username } = data;
            if (userId !== socket.userId) {
                throw new Error('Unauthorized');
            }
            // Aktualizujeme status hráče na "searching"
            gameManager.updatePlayerStatus(userId, 'searching');
            gameManager.handlePlayerJoin(socket, { userId, username });
        } catch (error) {
            console.error('Error joining game:', error);
            socket.emit('error', error.message);
        }
    });

    socket.on('cancelSearch', () => {
        try {
            // Aktualizujeme status hráče zpět na "online"
            gameManager.updatePlayerStatus(socket.userId, 'online');
            gameManager.cancelSearch(socket);
            socket.emit('searchCancelled');
        } catch (error) {
            console.error('Error canceling search:', error);
        }
    });

    socket.on('disconnect', () => {
        try {
            console.log(`Player disconnecting (ID: ${socket.id}, User: ${socket.username})`);
            
            const gameId = gameManager.playerGameMap.get(socket.id);
            if (gameId) {
                const playerIndex = gameManager.getPlayerIndex(gameId, socket.id);
                gameManager.handleDisconnect(gameId, playerIndex);
            } else {
                gameManager.cancelSearch(socket);
            }
            
            gameManager.handlePlayerDisconnect(socket.userId);
            
            // Vypíšeme aktuální počet připojených klientů po odpojení
            const remainingClients = io.sockets.sockets.size;
            console.log(`Remaining connected clients: ${remainingClients}`);
        } catch (error) {
            console.error('Error during disconnect:', error);
        }
    });

    // Přidáme handler pro start hry
    socket.on('gameStarted', (gameId) => {
        try {
            // Aktualizujeme status obou hráčů na "in_game"
            const game = gameManager.games.get(gameId);
            if (game) {
                game.players.forEach(player => {
                    gameManager.updatePlayerStatus(player.socket.userId, 'in_game');
                });
            }
        } catch (error) {
            console.error('Error updating player status on game start:', error);
        }
    });

    // Přidáme handler pro konec hry
    socket.on('gameEnded', (gameId) => {
        try {
            // Aktualizujeme status hráčů zpět na "online"
            const game = gameManager.games.get(gameId);
            if (game) {
                game.players.forEach(player => {
                    gameManager.updatePlayerStatus(player.socket.userId, 'online');
                });
            }
        } catch (error) {
            console.error('Error updating player status on game end:', error);
        }
    });

    // Přidáme handler pro reconnect
    socket.on('attemptReconnect', async () => {
        try {
            const reconnected = await gameManager.handleReconnect(socket, socket.userId);
            if (!reconnected) {
                socket.emit('reconnectFailed');
            }
        } catch (error) {
            console.error('Error during reconnect:', error);
            socket.emit('reconnectFailed');
        }
    });

    socket.on('startAIGame', async () => {
        try {
            console.log('Received startAIGame request from:', socket.id);
            
            // Kontrola, zda je uživatel přihlášen
            if (!socket.userId) {
                throw new Error('User not authenticated');
            }

            // Kontrola, zda uživatel již není ve hře
            if (gameManager.playerGameMap.has(socket.id)) {
                throw new Error('Player already in game');
            }

            // Vytvoření AI hry
            const gameId = await gameManager.createAIGame(socket);
            console.log('Created AI game with ID:', gameId);

            // Aktualizace statusu hráče
            gameManager.updatePlayerStatus(socket.userId, 'in_game');

            // Odeslání odpovědi klientovi
            socket.emit('joinGameResponse', { 
                status: 'joined', 
                gameId,
                isAIGame: true
            });

        } catch (error) {
            console.error('Error starting AI game:', error);
            socket.emit('error', {
                message: 'Failed to start AI game',
                details: error.message
            });
        }
    });

});


// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// API Endpointy - musí být definovány před server.listen()
// Přidáme middleware pro parsing JSON (potřeba pro POST requesty)
app.use(express.json());

// Ping endpoint pro udržení serveru aktivního
app.get('/api/ping', async (req, res) => {
    try {
        console.log(`${new Date().toISOString()} - Ping received from client`);
        
      
        
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            message: 'Server is alive',
            environment: process.env.NODE_ENV,
            uptime: process.uptime(),
            version: '1.0.0'
        });
    } catch (error) {
        console.error('Ping endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server health check failed',
            timestamp: new Date().toISOString()
        });
    }
});



// Endpointy pro správu balíčků
app.get('/api/decks', async (req, res) => {
    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return res.status(400).json({
                status: 'error',
                message: 'user_id is required'
            });
        }
        
        const { data, error } = await supabase
            .from('decks')
            .select('*')
            .eq('user_id', user_id);

        if (error) throw error;
        
        res.json({
            status: 'success',
            data: data
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/api/decks', async (req, res) => {
    try {
        const { user_id, name, cards } = req.body;
        
        if (!user_id || !name) {
            return res.status(400).json({
                status: 'error',
                message: 'user_id and name are required'
            });
        }
        
        // Začneme transakci
        const { data: deck, error: deckError } = await supabase
            .from('decks')
            .insert({ user_id, name })
            .select()
            .single();

        if (deckError) throw deckError;

        // Vložíme karty do balíčku
        if (cards && cards.length > 0) {
            const { error: cardsError } = await supabase
                .from('deck_cards')
                .insert(cards.map(card => ({
                    deck_id: deck.id,
                    card_id: card.id,
                    quantity: card.quantity
                })));

            if (cardsError) throw cardsError;
        }

        res.status(201).json({
            status: 'success',
            data: deck
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpointy pro hrdiny
app.get('/api/heroes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('heroes')
            .select('*');

        if (error) throw error;
        
        res.json({
            status: 'success',
            data: data
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.patch('/api/profiles/hero', async (req, res) => {
    try {
        const { user_id, hero_id } = req.body;
        
        if (!user_id || !hero_id) {
            return res.status(400).json({
                status: 'error',
                message: 'user_id and hero_id are required'
            });
        }
        
        const { data, error } = await supabase
            .from('profiles')
            .update({ hero_id })
            .eq('id', user_id)
            .select()
            .single();

        if (error) throw error;
        
        res.json({
            status: 'success',
            data: data
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Handle 404 for non-existent routes
app.all('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Can't find ${req.originalUrl} on this server!`
    });
});

// Production route for serving React app
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });
}

// Global error handling middleware - MUST be last!
app.use((err, req, res, next) => {
    console.error('Error occurred:', err.stack);
    
    // Send structured JSON error response
    res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Server běží na portu ${PORT}`);
    console.log('Available endpoints:');
    console.log('- GET /api/ping');
    console.log('- GET /api/decks');
    console.log('- POST /api/decks');
    console.log('- GET /api/heroes');
    console.log('- PATCH /api/profiles/hero');
});
