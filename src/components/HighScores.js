import React from 'react';
import './HighScores.css';

const HighScores = ({ highScores }) => {
  return (
    <div className="high-scores">
      <h2>High Scores</h2>
      <ul>
        {highScores.map((entry, index) => (
          <li key={index}>
            {index + 1}. {entry.name}: {entry.tries} tries
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HighScores;
