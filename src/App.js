import { useState, useEffect } from 'react';
import './App.css';
import ReactModal from 'react-modal';
import { io } from 'socket.io-client';
import Card from './components/Card';
import ScoreBoard from './components/ScoreBoard';
import HighScores from './components/HighScores';
import Options from './components/Options';

ReactModal.setAppElement('#root'); // Set the app element for accessibility

const socket = io(); // Automatically connects to the same host and port as the frontend

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
  const [playAgainstAI, setPlayAgainstAI] = useState('easy'); // Default to playing against easy AI
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState(''); // Game code for joining specific games
  const [playerId, setPlayerId] = useState(null); // Unique ID for the current player
  const [aiMemory, setAiMemory] = useState({}); // Memory for hard AI
  const [numMatches, setNumMatches] = useState(8); // Default number of matches

  useEffect(() => {
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
        if (playAgainstAI === 'hard') {
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
  }, [flippedCards]);

  const initializeGame = () => {
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

  const handleCardClick = (index) => {
    if (flippedCards.length === 2 || flippedCards.includes(index) || matchedCards.includes(index)) {
      return; // Prevent invalid clicks
    }

    if (players[currentPlayerIndex].name === 'AI') {
      return; // Prevent AI from clicking
    }

    setFlippedCards((prev) => [...prev, index]);
  };

  const handleAIMove = () => {
    if (playAgainstAI === 'easy') {
      handleEasyAIMove();
    } else if (playAgainstAI === 'hard') {
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

  const cards = shuffledImages.map((image, index) => (
    <Card
      key={index}
      image={image}
      isFlipped={flippedCards.includes(index) || matchedCards.includes(index)}
      onClick={() => handleCardClick(index)}
    />
  ));

  return (
    <div className="App">
      <header className="App-header">
        <h2>Multiplayer Memory Game</h2>
        <ScoreBoard playerScore={players[0].score} aiScore={players[1].score} aiType={playAgainstAI === 'easy' ? 'Easy AI' : 'Hard AI'} />
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
        <ReactModal
          isOpen={isModalOpen}
          onRequestClose={() => setIsModalOpen(false)}
          className="modal"
          overlayClassName="overlay"
        >
          <h2>Game Setup</h2>
          <label>
            Play against:
            <select value={playAgainstAI} onChange={(e) => setPlayAgainstAI(e.target.value)}>
              <option value="easy">Easy AI</option>
              <option value="hard">Hard AI</option>
            </select>
          </label>
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
        </ReactModal>
      </header>
    </div>
  );
}

export default App;



