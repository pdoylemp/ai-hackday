const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});

// Game state container
const games = {};
const baseImages = [
  '🍎','🍌','🍇','🍓','🍒','🍍','🥝','🍉',
  '🍋','🍑','🍏','🍈','🍔','🍕','🍩','🍪'
];

function shufflePairs(numMatches) {
  const sel = baseImages.slice(0, numMatches);
  const arr = [...sel, ...sel];
  return arr.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('debugPing', (p) => console.log('debugPing', p));

  socket.on('joinGame', ({ gameCode, name }, ack) => {
    if (!gameCode) {
      socket.emit('errorMessage', 'Game code required');
      return;
    }
    if (!games[gameCode]) {
      games[gameCode] = {
        gameCode,
        numMatches: 8,
        shuffledImages: [],
        flippedCards: [],
        matchedCards: [],
        players: [],
        currentPlayerIndex: 0,
        gameWon: false
      };
    }
    const game = games[gameCode];
    if (!game.players.find(p => p.id === socket.id)) {
      game.players.push({ id: socket.id, name, score: 0 });
      socket.join(gameCode);
      io.to(gameCode).emit('playerJoined', game.players);
      ack && ack({ host: game.players.length === 1 });
    } else {
      ack && ack({ host: game.players[0].id === socket.id });
    }
    socket.emit('gameState', game);
    console.log('joinGame', gameCode, 'players:', game.players.length);
    // Broadcast full state (not just player list) so second client sees current players
    io.to(gameCode).emit('gameState', games[gameCode]);
  });

  socket.on('initializeGame', ({ gameCode, numMatches }) => {
    const game = games[gameCode];
    if (!game) {
      socket.emit('errorMessage', 'Game not found');
      return;
    }
    game.numMatches = numMatches || game.numMatches;
    game.shuffledImages = shufflePairs(game.numMatches);
    game.flippedCards = [];
    game.matchedCards = [];
    game.players = game.players.map(p => ({ ...p, score: 0 }));
    game.currentPlayerIndex = 0;
    game.gameWon = false;
    io.to(gameCode).emit('gameState', game);
    console.log('initializeGame', gameCode, 'numMatches:', game.numMatches);
  });

  socket.on('cardFlip', ({ gameCode, index }) => {
    const game = games[gameCode];
    if (!game) return;
    if (game.gameWon) return;
    const current = game.players[game.currentPlayerIndex];
    if (!current || current.id !== socket.id) return;
    if (game.flippedCards.length === 2 ||
        game.flippedCards.includes(index) ||
        game.matchedCards.includes(index)) return;

    // First card
    game.flippedCards.push(index);
    io.to(gameCode).emit('gameState', game);

    if (game.flippedCards.length === 2) {
      // Second card shown to clients
      io.to(gameCode).emit('gameState', game);
      const [a, b] = game.flippedCards;
      const isMatch = game.shuffledImages[a] === game.shuffledImages[b];

      setTimeout(() => {
        if (isMatch) {
          current.score += 1;
          game.matchedCards.push(a, b);
          game.flippedCards = [];
          if (game.matchedCards.length === game.shuffledImages.length) {
            game.gameWon = true;
          }
          // same player keeps turn
        } else {
          game.flippedCards = [];
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }
        io.to(gameCode).emit('gameState', game);
      }, 900); // delay to allow users to see both cards
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    Object.keys(games).forEach(code => {
      const g = games[code];
      const idx = g.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        g.players.splice(idx, 1);
        if (g.currentPlayerIndex >= g.players.length) g.currentPlayerIndex = 0;
        io.to(code).emit('playerJoined', g.players);
        io.to(code).emit('gameState', g);
        if (g.players.length === 0) {
          delete games[code];
          console.log('Removed empty game', code);
        }
      }
    });
  });
});

// Simple health endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

server.listen(3001, () => console.log('Server listening on http://localhost:3001'));