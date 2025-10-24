import React from 'react';
import './Card.css';

const Card = ({ image, isFlipped, onClick }) => {
  return (
    <div className={`card ${isFlipped ? 'flipped' : ''}`} onClick={onClick}>
      <div className="card-front">{image}</div>
      <div className="card-back">?</div>
    </div>
  );
};

export default Card;
