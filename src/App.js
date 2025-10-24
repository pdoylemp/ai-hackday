import { useState, useEffect } from 'react';
import './App.css';
import ReactModal from 'react-modal';
import { io } from 'socket.io-client';
import Card from './components/Card';
import ScoreBoard from './components/ScoreBoard';
import HighScores from './components/HighScores';
import Options from './components/Options';

ReactModal.setAppElement('#root'); // Set the app element for accessibility

const socket = io('http://localhost:3001', {
  path: '/socket.io',
  transports: ['websocket'],
  autoConnect: true,
}); // Automatically connects to the same host and port as the frontend

function App() {
  const images = [
    '🍎', '🍌', '🍇', '🍓', 
    '🍒', '🍍', '🥝', '🍉',
    '🍋', '🍑', '🍏', '🍈',
    '🍔', '🍕', '🍩', '🍪'
  ];

  const [shuffledImages, setShuffledImages] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedCards, setMatchedCards] = useState([]);
  const [gameWon, setGameWon] = useState(false);
  const [players, setPlayers] = useState([{ name: 'Player', score: 0 }, { name: 'AI', score: 0 }]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0); // Track the current player's turn
  const [isModalOpen, setIsModalOpen] = useState(true); // Open modal by default for game setup
  const [opponentType, setOpponentType] = useState('easy'); // 'easy' | 'hard' | 'multi'
  const [showMultiplayerSetup, setShowMultiplayerSetup] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState(''); // Game code for joining specific games
  const [playerId, setPlayerId] = useState(null); // Unique ID for the current player
  const [aiMemory, setAiMemory] = useState({}); // Memory for hard AI
  const [numMatches, setNumMatches] = useState(8); // Default number of matches
  const [isHost, setIsHost] = useState(false);
  // Add gameStarted helper
  const gameStarted = shuffledImages.length > 0;

  const OPPONENT_OPTIONS = [
    { value: 'easy', label: 'Easy AI' },
    { value: 'hard', label: 'Hard AI' },
    { value: 'multi', label: 'Multiplayer' },
  ];

  useEffect(() => {
    console.log('Opponent type:', opponentType);
  }, [opponentType]);

  const generateGameCode = () =>
    Math.random().toString(36).substring(2, 7).toUpperCase();

  const createMultiplayerGame = () => {
    if (opponentType !== 'multi') return;
    const newCode = generateGameCode();
    setGameCode(newCode);
    const hostName = playerName || 'Host';
    console.log('Creating game', newCode);
    socket.emit('joinGame', { gameCode: newCode, name: hostName }, (resp) => {
      console.log('joinGame ack', resp);
      if (resp?.host) {
        setIsHost(true);
        // Host auto-initialize after creating code (optional: defer to manual start)
        socket.emit('initializeGame', { gameCode: newCode, numMatches });
      }
    });
    setIsModalOpen(false);
  };

  // Multiplayer socket listeners
  useEffect(() => {
    if (opponentType !== 'multi') return;
    console.log('Attaching multiplayer listeners for gameCode:', gameCode);
    socket.emit('debugPing', { ts: Date.now() });
    socket.on('gameState', (state) => {
      console.log('Received gameState');
      // Server drives authoritative state
      setShuffledImages(state.shuffledImages);
      setMatchedCards(state.matchedCards);
      setFlippedCards(state.flippedCards);
      setPlayers(state.players);
      setCurrentPlayerIndex(state.currentPlayerIndex);
      setGameWon(state.gameWon);
      setNumMatches(state.numMatches);
    });
    socket.on('playerJoined', (playersList) => {
      console.log('playerJoined', playersList);
      setPlayers(playersList);
    });
    socket.on('errorMessage', (msg) => {
      console.error('Server errorMessage:', msg);
    });
    return () => {
      socket.off('gameState');
      socket.off('playerJoined');
      socket.off('errorMessage');
    };
  }, [opponentType, gameCode]);

  // AI flow guarded: skip if multiplayer
  useEffect(() => {
    if (opponentType === 'multi') return; // multiplayer handled by server
    if (flippedCards.length === 2) {
      const [firstIndex, secondIndex] = flippedCards;
      let matchFound = false;

      if (shuffledImages[firstIndex] === shuffledImages[secondIndex]) {
        const updatedPlayers = [...players];
        updatedPlayers[currentPlayerIndex].score += 1;

        setMatchedCards((prev) => [...prev, firstIndex, secondIndex]);
        setPlayers(updatedPlayers);
        matchFound = true;

        if (matchedCards.length + 2 === shuffledImages.length) {
          setGameWon(true);
        }
      } else {
        // Update AI memory for hard AI (even if it's the player's turn)
        if (opponentType === 'hard') {
          setAiMemory((prev) => ({
            ...prev,
            [firstIndex]: shuffledImages[firstIndex],
            [secondIndex]: shuffledImages[secondIndex],
          }));
        }
      }

      setTimeout(() => {
        setFlippedCards([]); // Reset flipped cards first

        setTimeout(() => {
          if (matchFound) {
            // Let the current player (Player or AI) take another turn if they made a successful match
            if (players[currentPlayerIndex].name === 'AI') {
              handleAIMove();
            }
          } else {
            // Move to the next player
            const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            setCurrentPlayerIndex(nextPlayerIndex);

            // If the next player is the AI, let it take its turn
            if (players[nextPlayerIndex].name === 'AI') {
              handleAIMove();
            }
          }
        }, 100); // Add a slight delay to ensure flippedCards is cleared
      }, 1000);
    }
  }, [flippedCards, opponentType]);

  const joinMultiplayerGame = () => {
    if (opponentType !== 'multi') return;
    if (!gameCode.trim()) return;
    console.log('Joining game', gameCode);
    socket.emit('joinGame', { gameCode, name: playerName || 'Player' }, (resp) => {
      console.log('joinGame ack', resp);
      if (resp?.host) setIsHost(true);
    });
    setIsModalOpen(false);
  };

  const initializeMultiplayerGame = () => {
    if (opponentType !== 'multi') return;
    if (!isHost || !gameCode) return;
    socket.emit('initializeGame', {
      gameCode,
      numMatches,
    });
  };

  // Adjust initializeGame: use AI path only when opponentType !== 'multi'
  const initializeGame = () => {
    if (opponentType === 'multi') {
      initializeMultiplayerGame();
      return;
    }
    const totalCards = numMatches * 2; // Dynamically set the total number of cards
    const selectedImages = images.slice(0, numMatches);
    const repeatedImages = Array(2).fill(selectedImages).flat();
    const shuffled = repeatedImages.sort(() => Math.random() - 0.5);

    setShuffledImages(shuffled);
    setFlippedCards([]);
    setMatchedCards([]);
    setPlayers([{ name: 'Player', score: 0 }, { name: 'AI', score: 0 }]);
    setCurrentPlayerIndex(0);
    setGameWon(false);
    setIsModalOpen(false);
    setAiMemory({});
  };

  // Card click: delegate to server in multiplayer
  const handleCardClick = (index) => {
    if (opponentType === 'multi') {
      if (!gameCode) return;
      // Prevent redundant client flips (server authoritative)
      if (matchedCards.includes(index) || flippedCards.includes(index)) return;
      socket.emit('cardFlip', { gameCode, index });
      return;
    }
    if (flippedCards.length === 2 || flippedCards.includes(index) || matchedCards.includes(index)) {
      return; // Prevent invalid clicks
    }

    if (players[currentPlayerIndex].name === 'AI') {
      return; // Prevent AI from clicking
    }

    setFlippedCards((prev) => [...prev, index]);
  };

  const handleAIMove = () => {
    if (opponentType === 'multi') return;
    if (opponentType === 'easy') {
      handleEasyAIMove();
    } else if (opponentType === 'hard') {
      handleHardAIMove();
    }
  };

  const handleEasyAIMove = () => {
    const availableCards = shuffledImages
      .map((_, index) => index)
      .filter((index) => !flippedCards.includes(index) && !matchedCards.includes(index));

    if (availableCards.length > 1) {
      const randomIndex1 = Math.floor(Math.random() * availableCards.length);
      const randomIndex2 = Math.floor(Math.random() * (availableCards.length - 1));
      const firstCard = availableCards[randomIndex1];
      const secondCard = availableCards[randomIndex2 >= randomIndex1 ? randomIndex2 + 1 : randomIndex2];

      setFlippedCards([firstCard, secondCard]);
    }
  };

  const handleHardAIMove = () => {
    const availableCards = shuffledImages
      .map((_, index) => index)
      .filter((index) => !flippedCards.includes(index) && !matchedCards.includes(index));

    // Check AI memory for a guaranteed match
    for (let i = 0; i < availableCards.length; i++) {
      for (let j = i + 1; j < availableCards.length; j++) {
        if (
          aiMemory[availableCards[i]] &&
          aiMemory[availableCards[j]] &&
          aiMemory[availableCards[i]] === aiMemory[availableCards[j]]
        ) {
          setFlippedCards([availableCards[i], availableCards[j]]);
          return;
        }
      }
    }

    // If no guaranteed match, pick two random cards
    handleEasyAIMove();
  };

  const getWinner = () => {
    const maxScore = Math.max(...players.map((player) => player.score));
    const winners = players.filter((player) => player.score === maxScore);

    if (winners.length === 1) {
      return `${winners[0].name} wins!`;
    } else {
      return `It's a tie between ${winners.map((player) => player.name).join(' and ')}!`;
    }
  };

  const openSetup = () => setIsModalOpen(true);

  const cards = shuffledImages.map((image, index) => (
    <Card
      key={index}
      image={image}
      isFlipped={flippedCards.includes(index) || matchedCards.includes(index)}
      onClick={() => handleCardClick(index)}
    />
  ));
  
  console.log(OPPONENT_OPTIONS);

  useEffect(() => {
    // Basic lifecycle logging
    socket.on('connect', () => console.log('Socket connected:', socket.id));
    socket.on('disconnect', (r) => console.log('Socket disconnected:', r));
    socket.on('connect_error', (err) => console.error('Socket connect_error:', err.message));
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, []);

  // Reset players when opponent type changes
  useEffect(() => {
    if (opponentType === 'multi') {
      setPlayers([]);       // multiplayer players will arrive from server
      setIsHost(false);
      setGameWon(false);
      setMatchedCards([]);
      setFlippedCards([]);
    } else {
      setPlayers([{ name: 'Player', score: 0 }, { name: 'AI', score: 0 }]);
      setIsHost(false);
      setGameCode('');
    }
  }, [opponentType]);

  // Safe derived scores for scoreboard
  const playerScore = players[0]?.score ?? 0;
  const opponentScore = opponentType === 'multi'
    ? (players[1]?.score ?? 0)
    : (players[1]?.score ?? 0); // still second slot for AI
  const opponentLabel = opponentType === 'multi'
    ? 'Multiplayer'
    : (opponentType === 'easy' ? 'Easy AI' : 'Hard AI');

  return (
    <div className="App">
      <header className="App-header">
        <h2>Multiplayer Memory Game</h2>
        {opponentType === 'multi' && gameCode && (
          <div style={{ marginBottom: 10, padding: '4px 10px', borderRadius: 6, background: '#eef', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span>Game Code: <strong>{gameCode}</strong></span>
            <button onClick={() => navigator.clipboard.writeText(gameCode)}>Copy</button>
          </div>
        )}

        {/* Scores only after gameStarted */}
        {gameStarted && (
          opponentType === 'multi' ? (
            <div style={{ display: 'flex', gap: 16, marginTop: 4, marginBottom: 4 }}>
              {players.map((p, i) => (
                <div
                  key={p.id || p.name + i}
                  style={{
                    fontWeight: i === currentPlayerIndex ? 'bold' : 'normal',
                    padding: '4px 10px',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    background: i === currentPlayerIndex ? '#f0f6ff' : '#fff',
                    minWidth: 90
                  }}
                >
                  <div style={{ fontSize: 12 }}>{p.name}</div>
                  <div style={{ fontSize: 18 }}>{p.score}</div>
                </div>
              ))}
            </div>
          ) : (
            <ScoreBoard
              playerScore={playerScore}
              aiScore={opponentScore}
              aiType={opponentLabel}
            />
          )
        )}

        {/* Current turn line (only when game has started) */}
        {gameStarted && players.length > 0 && (
          <div style={{ marginBottom: 12, fontStyle: 'italic' }}>
            Current Turn: {players[currentPlayerIndex]?.name}
          </div>
        )}

        {/* Removed default pre-game score view */}
        <div className="card-grid">{cards}</div>
        {gameWon && (
          <div className="game-over">
            <h2>Game Over!</h2>
            <h3>{getWinner()}</h3>
            <button className="play-again" onClick={initializeGame}>
              Play Again
            </button>
          </div>
        )}
        <button
          style={{ position: 'absolute', top: 12, right: 12 }}
          onClick={openSetup}
        >
          Setup
        </button>
        <div style={{ position: 'absolute', top: 12, left: 12 }}>
          <select
            value={opponentType}
            onChange={(e) => {
              const val = e.target.value;
              setOpponentType(val);
              setShowMultiplayerSetup(val === 'multi');
            }}
          >
            {OPPONENT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <ReactModal
          isOpen={isModalOpen}
          onRequestClose={() => setIsModalOpen(false)}
          className="modal"
          overlayClassName="overlay"
        >
          <h2>Game Setup</h2>
          <label>
            Play Against:
            <select
              value={opponentType}
              onChange={(e) => {
                const val = e.target.value;
                setOpponentType(val);
                setShowMultiplayerSetup(val === 'multi');
              }}
            >
              {OPPONENT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {opponentType !== 'multi' && (
            <>
              <label>
                Number of Matches: {numMatches}
                <input
                  type="range"
                  value={numMatches}
                  onChange={(e) => setNumMatches(parseInt(e.target.value))}
                  min="1"
                  max="16"
                />
              </label>
              <button onClick={initializeGame}>Start Game</button>
            </>
          )}

          {showMultiplayerSetup && (
            <>
              <label>
                Your Name:
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Name"
                />
              </label>
              {gameCode && isHost && (
                <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                  Active Game Code: <strong>{gameCode}</strong>
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => navigator.clipboard.writeText(gameCode)}
                  >
                    Copy
                  </button>
                </div>
              )}
              {/* Added manual game code entry */}
              {!isHost && (
                <label>
                  Enter Game Code:
                  <input
                    type="text"
                    value={gameCode}
                    onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC12"
                  />
                </label>
              )}
              <label>
                Number of Matches: {numMatches}
                <input
                  type="range"
                  value={numMatches}
                  onChange={(e) => setNumMatches(parseInt(e.target.value))}
                  min="1"
                  max="16"
                  disabled={!isHost}
                />
              </label>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button onClick={createMultiplayerGame} disabled={isHost}>
                  {isHost ? 'Game Created' : 'Create & Start New Game'}
                </button>
                <button onClick={joinMultiplayerGame} disabled={isHost || !gameCode}>
                  Join Existing Game
                </button>
                {isHost && gameCode && (
                  <button onClick={initializeMultiplayerGame}>Re-Start / Reset Game</button>
                )}
                {!isHost && gameCode && (
                  <span style={{ fontSize: '0.85rem' }}>Enter code and click Join.</span>
                )}
              </div>
            </>
          )}
        </ReactModal>
      </header>
    </div>
  );
}

export default App;



