export interface ICard {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  }
 
 export interface IPot {
    amount: number; // The total amount in the pot
    contributors: {
      playerId: string; // The ID of the player contributing to the pot
      contribution: number; // The amount contributed by the player
    }[];
    winners: { 
      playerId: string; // The ID of the winning player
      amount: number;   // The amount the player won from this pot
    }[];
  }  
  

  export interface WPot {
    amount: number; // The total amount in the pot
    contributors: {
      playerId: string; // The ID of the player contributing to the pot
      contribution: number; // The amount contributed by the player
    }[];
    // Array of player IDs who are the winners for this pot
  }

  
  
  export interface IPlayer {
    userId: string; // Assuming string type for player ID, adjust as needed
    holeCards: ICard[];
    status: 'active' | 'folded' | 'all-in'; // Player status to determine eligibility
  }
  
  export interface IPlayerHand {
    playerId: string;
    hand: string; // The evaluated hand as a string (e.g., "straight-flush")
    handRank: number; // The ranking of the hand
    highCard: number; // The highest card in the hand
  }
  
  export interface ISidePot {
    amount: number;
    players: string[]; // Array of player IDs participating in this side pot
  }
  
  