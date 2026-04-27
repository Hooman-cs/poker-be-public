export const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit OTP
  };

  export const generateGamerName = () => {
    const adjectives = [
      "Swift", "Silent", "Fierce", "Mighty", "Stealthy",
      "Shadow", "Wild", "Epic", "Thunder", "Crimson",
      "Vivid", "Rogue", "Blaze", "Iron", "Atomic",
      "Mystic", "Phantom", "Glitch", "Storm", "Nebula"
    ];
  
    const nouns = [
      "Warrior", "Hunter", "Ninja", "Dragon", "Viper",
      "Raven", "Knight", "Ghost", "Assassin", "Titan",
      "Samurai", "Rider", "Predator", "Sniper", "Hacker",
      "Wraith", "Cyclone", "Phoenix", "Juggernaut", "Reaper"
    ];
  
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 100000); // Random number between 0 and 9999
  
    return `${randomAdjective}${randomNoun}${randomNumber}`;
  }
  
 
  