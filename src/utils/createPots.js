

export const convertRoundsToTotalBets = (rounds) => {
    const totalBets = {};

    // Iterate through each round
    rounds.forEach(round => {
      round.actions.forEach(action => {
        const { userId, amount, action: playerAction } = action;

        // If player doesn't exist in totalBets, initialize their entry
        if (!totalBets[userId]) {
          totalBets[userId] = { amount: 0, lastAction: '' };
        }

        // Add the amount to the player's total and update their last action
        totalBets[userId].amount += amount;
        totalBets[userId].lastAction = playerAction;
      });
    });

    return totalBets;
  }
  
 const createPots = (rounds) => {
    let pots = []; // This will hold the pots as they are created
    let totalBets = convertRoundsToTotalBets(rounds);
    while (true) {
        
        // Get all the remaining players with non-zero bets
        let remainingPlayers = Object.keys(totalBets).filter(
            (player) => totalBets[player].amount > 0
        );

        // If no more players with bets, we are done
        if (remainingPlayers.length === 0) {
            break;
        }

        // Find the minimum non-zero bet from the remaining players
        let minBet = Math.min(
            ...remainingPlayers.map((player) => totalBets[player].amount)
        );

        // Check if there are any players with all-in bets
        const allInPlayers = remainingPlayers.filter(
            (player) => totalBets[player].lastAction === 'all-in'
        );

        // Create a new pot
        let newPot = {
            amount: 0,
            contributors: [], // Players contributing to this pot
        };

        // If there are all-in players, create a pot with the minimum bet
        if (allInPlayers.length > 0) {
            remainingPlayers.forEach((player) => {

                // Every player contributes at least the minimum bet, or their remaining bet if they are all-in
                let contribution = Math.min(totalBets[player].amount, minBet);

                // Add contribution to the pot
                newPot.amount += contribution;

                // Track the contributors
                if (contribution > 0) {
                    newPot.contributors.push({
                        playerId: player,
                        contribution: contribution,
                    });
                }

                // Subtract the contribution from the player's total bet
                totalBets[player].amount -= contribution;
            });
        } else {
            // If there are no all-in players, take all remaining amounts for this pot
            remainingPlayers.forEach((player) => {
                let contribution = totalBets[player].amount;

                if (totalBets[player].lastAction === 'fold') {
                    // Folded players contribute up to their remaining amount
                    contribution = Math.min(contribution, minBet);
                }
                // Add contribution to the pot
                newPot.amount += contribution;

                // Track the contributors if they are contributing something
                if (contribution > 0) {
                    newPot.contributors.push({
                        playerId: player,
                        contribution: contribution,
                    });
                }

                // Subtract the contribution from the player's total bet
                totalBets[player].amount = 0; // Set their amount to zero after adding to pot
            });
        }

        // Add the newly created pot to the pots array
        pots.push(newPot);
    }

    return pots;
}

export default createPots ;

 