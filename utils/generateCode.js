module.exports = function generateCode() {
  const words = [
    'Whale', 'Tycoon', 'Hello', 'Mom', 'Bro', 'New', 'Duck', 'Robot',
    'Banana', 'Cool', 'Jazz', 'Tiger', 'Pizza', 'Galaxy', 'Ninja',
    'Cactus', 'Magic', 'Storm', 'Shadow', 'Echo'
  ];

  // Shuffle the array
  const shuffled = words.sort(() => 0.5 - Math.random());

  // Take the first 5 unique words
  return shuffled.slice(0, 5).join(' ');
};