const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for the game state
let gameState = {
  players: [],
  cards: [],
  currentTurn: null,
};

// API to get the current game state
app.get('/game-state', (req, res) => {
  res.json(gameState);
});

// API to join the game
app.post('/join', (req, res) => {
  const { playerName } = req.body;
  console.log('Player joining', playerName);
  if (!playerName) {
    return res.status(400).json({ error: 'Player name is required' });
  }

  const newPlayer = { id: gameState.players.length + 1, name: playerName };
  gameState.players.push(newPlayer);

  console.log('Gamestate is', gameState);

  res.status(201).json(newPlayer);
});

// API to initialize the game
app.post('/initialize-game', (req, res) => {
  console.log('Initialize game request received');
  const { cards } = req.body;

  if (!cards || !Array.isArray(cards)) {
    return res.status(400).json({ error: 'Cards array is required to initialize the game' });
  }

  gameState = {
    players: [],
    cards: cards.map((card, index) => ({ id: index + 1, value: card, flipped: false })),
    currentTurn: null,
  };

  res.status(200).json({ message: 'Game initialized', gameState });
});

// API to update the game state (e.g., flipping a card)
app.post('/update-game', (req, res) => {
  const { playerId, cardId } = req.body;

  if (!playerId || !cardId) {
    return res.status(400).json({ error: 'Player ID and Card ID are required' });
  }

  // Example logic for updating the game state
  gameState.currentTurn = playerId;
  gameState.cards.push({ cardId, flippedBy: playerId });

  res.status(200).json({ message: 'Game state updated' });
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});