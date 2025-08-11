// Utility functions for managing cricket overs and innings

export interface OverPosition {
  inning: number;
  over: number;
  ball: number;
}

export interface TeamSwitch {
  shouldSwitchTeams: boolean;
  shouldAskForNewBatsmen: boolean;
  shouldAskForNewBowler: boolean;
  isInningComplete: boolean;
  isMatchComplete: boolean;
}

/**
 * Formats over display (e.g., 2.3 means 2 overs and 3 balls)
 * @param over - The over number
 * @param ball - The ball number (1-6)
 * @returns Formatted string like "2.3"
 */
export const formatOverDisplay = (over: number, ball: number): string => {
  return `${over}.${ball}`;
};

/**
 * Converts over and ball to decimal representation
 * @param over - The over number
 * @param ball - The ball number (1-6)
 * @returns Decimal representation (e.g., 2.3 = 2.5 overs)
 */
export const overToDecimal = (over: number, ball: number): number => {
  return over + (ball - 1) / 6;
};

/**
 * Converts decimal over to over and ball representation
 * @param decimalOver - Decimal representation (e.g., 2.5)
 * @returns Object with over and ball numbers
 */
export const decimalToOver = (decimalOver: number): { over: number; ball: number } => {
  const over = Math.floor(decimalOver);
  const ball = Math.round((decimalOver - over) * 6) + 1;
  return { over, ball };
};

/**
 * Calculates the next position after a ball
 * @param currentPosition - Current over position
 * @param totalOvers - Total overs allowed for the match
 * @param runs - Runs scored (for determining batsmen swap)
 * @returns Next position and team switch requirements
 */
export const calculateNextPosition = (
  currentPosition: OverPosition,
  totalOvers: number,
  runs: number
): { nextPosition: OverPosition; teamSwitch: TeamSwitch } => {
  const { inning, over, ball } = currentPosition;
  
  let nextInning = inning;
  let nextOver = over;
  let nextBall = ball + 1;
  
  // Check if over is complete
  if (nextBall > 6) {
    nextOver = nextOver + 1;
    nextBall = 1;
  }
  
  // Check if innings is complete (when over reaches totalOvers)
  if (nextOver >= totalOvers) {
    nextInning = nextInning + 1;
    nextOver = 0;
    nextBall = 1;
  }
  
  // Ensure we never exceed total overs in any innings
  if (nextOver >= totalOvers) {
    nextOver = totalOvers - 1;
    nextBall = 6;
  }
  
  // Determine team switching requirements
  const shouldSwitchTeams = nextBall === 1 && nextOver > over; // End of over
  const shouldAskForNewBatsmen = nextInning > inning; // New innings needs new batsmen
  const shouldAskForNewBowler = shouldSwitchTeams || nextInning > inning; // New bowler at end of over or new innings
  const isInningComplete = nextInning > inning;
  const isMatchComplete = nextInning > 2; // Assuming 2 innings match
  
  const nextPosition: OverPosition = {
    inning: nextInning,
    over: nextOver,
    ball: nextBall
  };
  
  const teamSwitch: TeamSwitch = {
    shouldSwitchTeams,
    shouldAskForNewBatsmen,
    shouldAskForNewBowler,
    isInningComplete,
    isMatchComplete
  };
  
  return { nextPosition, teamSwitch };
};

/**
 * Determines if batsmen should swap positions
 * @param runs - Runs scored on the ball
 * @param isEndOfOver - Whether this is the end of an over
 * @returns True if batsmen should swap
 */
export const shouldSwapBatsmen = (runs: number, isEndOfOver: boolean): boolean => {
  // Batsmen always swap at end of over
  if (isEndOfOver) return true;
  
  // Batsmen swap on odd runs
  return runs % 2 === 1;
};

/**
 * Validates if a position is within match limits
 * @param position - Over position to validate
 * @param totalOvers - Total overs allowed
 * @returns True if position is valid
 */
export const isValidPosition = (position: OverPosition, totalOvers: number): boolean => {
  if (position.inning < 1 || position.inning > 2) return false;
  if (position.over < 0 || position.over >= totalOvers) return false;
  if (position.ball < 1 || position.ball > 6) return false;
  return true;
};

/**
 * Gets the current over display string
 * @param position - Current over position
 * @returns Formatted over string
 */
export const getCurrentOverDisplay = (position: OverPosition): string => {
  if (position.inning > 2) return 'Match Complete';
  if (position.over === 0 && position.ball === 1) return 'Not Started';
  return formatOverDisplay(position.over, position.ball);
};

/**
 * Calculates overs remaining in current innings
 * @param position - Current over position
 * @param totalOvers - Total overs allowed
 * @returns Overs remaining as decimal
 */
export const getOversRemaining = (position: OverPosition, totalOvers: number): number => {
  if (position.inning > 2) return 0;
  if (position.inning === 1) {
    return totalOvers - overToDecimal(position.over, position.ball);
  }
  return totalOvers - overToDecimal(position.over, position.ball);
};

/**
 * Validates if a ball can be added to the current position
 * @param position - Current over position
 * @param totalOvers - Total overs allowed
 * @returns True if ball can be added
 */
export const canAddBall = (position: OverPosition, totalOvers: number): boolean => {
  if (position.inning > 2) return false; // Match complete
  if (position.inning === 2 && position.over >= totalOvers && position.ball >= 6) return false; // Second innings complete
  return true;
};

/**
 * Gets a summary of the current match state
 * @param position - Current over position
 * @param totalOvers - Total overs allowed
 * @returns Summary string
 */
export const getMatchStateSummary = (position: OverPosition, totalOvers: number): string => {
  if (position.inning > 2) return 'Match Complete';
  if (position.inning === 1) {
    const oversRemaining = getOversRemaining(position, totalOvers);
    return `1st Innings - ${getCurrentOverDisplay(position)} (${oversRemaining.toFixed(1)} overs remaining)`;
  }
  if (position.inning === 2) {
    const oversRemaining = getOversRemaining(position, totalOvers);
    return `2nd Innings - ${getCurrentOverDisplay(position)} (${oversRemaining.toFixed(1)} overs remaining)`;
  }
  return 'Match not started';
};
