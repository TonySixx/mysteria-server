const GAME_CONSTANTS = {
    MAX_HAND_SIZE: 10,
    MAX_FIELD_SIZE: 7,
    MAX_MANA: 10,
    STARTING_HEALTH: 30,
    STARTING_MANA: 1,
    CARDS_PER_TURN: 1
};

const CARD_TYPES = {
    UNIT: 'unit',
    SPELL: 'spell'
};

const RARITY = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    EPIC: 'epic',
    LEGENDARY: 'legendary'
};

export const GAME_EVENTS = {
    JOIN_GAME: 'joinGame',
    GAME_STATE: 'gameState',
    PLAY_CARD: 'playCard',
    ATTACK: 'attack',
    END_TURN: 'endTurn',
    GAME_OVER: 'gameOver',
    OPPONENT_DISCONNECTED: 'opponentDisconnected',
    PLAYER_RECONNECTED: 'playerReconnected',
    ERROR: 'error'
};

export const PLAYER_STATES = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    DISCONNECTED: 'disconnected'
};

export const GAME_PHASES = {
    MULLIGAN: 'mulligan',
    MAIN: 'main',
    COMBAT: 'combat',
    END: 'end'
};

module.exports = {
    GAME_CONSTANTS,
    CARD_TYPES,
    RARITY,
    GAME_EVENTS,
    PLAYER_STATES,
    GAME_PHASES
};
