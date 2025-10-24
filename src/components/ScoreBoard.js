import React from 'react';
import './ScoreBoard.css';

const ScoreBoard = ({ playerScore, aiScore, aiType }) => {
  return (
    <div className="score-container">
      <h2>Player: {playerScore}</h2>
      <h2>{aiType}: {aiScore}</h2>
    </div>
  );
};

export default ScoreBoard;
