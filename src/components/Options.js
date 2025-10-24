import React from 'react';
import './Options.css';

const Options = ({
  selectedAgent,
  numUniqueImages,
  numCards,
  onAgentChange,
  onNumUniqueImagesChange,
  onNumCardsChange,
}) => {
  return (
    <div className="options-container">
      <label>
        Choose Agent:
        <select value={selectedAgent} onChange={onAgentChange}>
          <option value="easyAi">Easy AI</option>
          <option value="hardAi">Hard AI</option>
        </select>
      </label>
      <label>
        Number of Unique Images:
        <input
          type="number"
          value={numUniqueImages}
          onChange={onNumUniqueImagesChange}
          min="2"
          max={Math.floor(numCards / 2)}
        />
      </label>
      <label>
        Number of Cards:
        <input
          type="number"
          value={numCards}
          onChange={onNumCardsChange}
          min="4"
          max={numUniqueImages * 4}
          step="2"
        />
      </label>
    </div>
  );
};

export default Options;
