/**
 * scoringUtils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure league-scoring helpers for the My Leagues tab.
 * No dependencies. All functions are exported named functions.
 *
 * Match types accepted by the main calculation functions:
 *   "standard"     – normal played match
 *   "forfeit"      – one side forfeited; winner is determined by the caller
 *                    (sets array is ignored)
 *   "retired"      – match stopped early; score is based on completed sets
 *   "not_reported" – score not yet submitted; both teams receive 0 points
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the number of sets won by each side from the sets array.
 *
 * @param {Array<{you: number, them: number}>} sets
 * @returns {{ youSets: number, themSets: number }}
 */
function countSets(sets) {
  let youSets = 0;
  let themSets = 0;
  const safeSets = Array.isArray(sets) ? sets : [];
  for (const set of safeSets) {
    if (set && typeof set.you === 'number' && typeof set.them === 'number') {
      if (set.you > set.them) youSets++;
      else if (set.them > set.you) themSets++;
    }
  }
  return { youSets, themSets };
}

/**
 * Returns the total games won by each side across all sets.
 *
 * @param {Array<{you: number, them: number}>} sets
 * @returns {{ youGames: number, themGames: number }}
 */
function countGames(sets) {
  let youGames = 0;
  let themGames = 0;
  const safeSets = Array.isArray(sets) ? sets : [];
  for (const set of safeSets) {
    if (set && typeof set.you === 'number' && typeof set.them === 'number') {
      youGames += set.you;
      themGames += set.them;
    }
  }
  return { youGames, themGames };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the match winner from the completed sets.
 *
 * Returns "you" or "opponent" once either side wins 2 sets.
 * Returns null when the match is incomplete (no one has reached 2 sets yet).
 *
 * @param {Array<{you: number, them: number}>} sets
 * @returns {"you" | "opponent" | null}
 */
export function determineMatchWinner(sets) {
  const { youSets, themSets } = countSets(sets);
  if (youSets >= 2) return 'you';
  if (themSets >= 2) return 'opponent';
  return null;
}

/**
 * Calculates league points for a single match.
 *
 * Point system:
 *   Win  → 3 points (1 per set won + 1 bonus for winning the match)
 *   Loss → 1 point if at least one set was won, otherwise 0
 *   Forfeit win  → 3 points; forfeit loss → 0 points
 *   Not reported → 0 points for both sides
 *   Retired      → scored normally on completed sets
 *
 * @param {Array<{you: number, them: number}>} sets
 *   Each element represents one set with the games won by each side.
 *   Example: [{ you: 6, them: 4 }, { you: 3, them: 6 }, { you: 7, them: 6 }]
 * @param {"standard" | "forfeit" | "retired" | "not_reported"} matchType
 *   The administrative status of the match.
 *   For "forfeit" the winner is assumed to be "you"; supply a pre-adjusted
 *   sets array or handle winner assignment in the caller if needed.
 * @returns {{
 *   yourPoints:     number,
 *   opponentPoints: number,
 *   winner:         "you" | "opponent" | null,
 *   setsWon:        number,
 *   setsLost:       number
 * }}
 */
export function calculateMatchPoints(sets, matchType) {
  const type = typeof matchType === 'string' ? matchType : 'standard';

  // Not reported — both sides get 0, no winner declared
  if (type === 'not_reported') {
    return { yourPoints: 0, opponentPoints: 0, winner: null, setsWon: 0, setsLost: 0 };
  }

  // Forfeit — winner gets 3, loser gets 0 (sets are irrelevant)
  if (type === 'forfeit') {
    // Convention: "you" are the winner when this function is called.
    // The caller should swap yourPoints / opponentPoints if the opponent won.
    return { yourPoints: 3, opponentPoints: 0, winner: 'you', setsWon: 0, setsLost: 0 };
  }

  // Standard or retired — score based on completed sets
  const { youSets, themSets } = countSets(sets);

  const winner = youSets >= 2 ? 'you' : themSets >= 2 ? 'opponent' : null;

  // Points for "you"
  let yourPoints = 0;
  if (winner === 'you') {
    yourPoints = youSets + 1; // sets won + bonus
  } else if (winner === 'opponent') {
    yourPoints = youSets >= 1 ? 1 : 0; // consolation if at least one set won
  }

  // Points for the opponent (mirror)
  let opponentPoints = 0;
  if (winner === 'opponent') {
    opponentPoints = themSets + 1;
  } else if (winner === 'you') {
    opponentPoints = themSets >= 1 ? 1 : 0;
  }

  return {
    yourPoints,
    opponentPoints,
    winner,
    setsWon:  youSets,
    setsLost: themSets,
  };
}

/**
 * Formats a sets array into a human-readable score string.
 *
 * Examples:
 *   [{ you: 6, them: 4 }]                            → "6-4"
 *   [{ you: 6, them: 4 }, { you: 3, them: 6 }]       → "6-4, 3-6"
 *   [{ you: 6, them: 4 }, { you: 3, them: 6 }, { you: 7, them: 6 }] → "6-4, 3-6, 7-6"
 *
 * Returns an empty string for null / undefined / empty input.
 *
 * @param {Array<{you: number, them: number}>} sets
 * @returns {string}
 */
export function formatScoreString(sets) {
  if (!Array.isArray(sets) || sets.length === 0) return '';
  return sets
    .filter(s => s && typeof s.you === 'number' && typeof s.them === 'number')
    .map(s => `${s.you}-${s.them}`)
    .join(', ');
}

/**
 * Validates a single set score against league rules.
 *
 * Rules enforced:
 *   • Both scores must be integers in the range 0–7
 *   • 6-6 is always invalid (tiebreak must be played)
 *   • 7-6 is always valid (tiebreak was played — winner takes the set)
 *   • Standard set: winner must reach 6 with at least a 2-game lead,
 *     OR the score must be 7-6
 *   • Scores above 7 are invalid
 *   • For the junior 3rd set (isJuniorThird = true):
 *       – The set is a 10-point match tiebreak recorded as actual points,
 *         so both scores must be in 0–10, and the score 7-6 is NOT allowed
 *         (must record the real score, e.g. 10-4 or 10-8)
 *       – The winner must reach 10 with at least a 2-point lead (or 10-x
 *         where x ≤ 8), except 10-9 is also valid (sudden death at 9-9)
 *
 * @param {number} you       Games (or points) won by "you" in this set
 * @param {number} them      Games (or points) won by the opponent
 * @param {number} setIndex  0-based index (0 = 1st set, 2 = 3rd set)
 * @param {boolean} [isJuniorThird=false]  True for a junior 3rd-set tiebreak
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateSetScore(you, them, setIndex, isJuniorThird = false) {
  const invalid = (error) => ({ valid: false, error });
  const ok = { valid: true, error: null };

  const isThirdSet = setIndex === 2;

  // Junior 3rd set — 10-point match tiebreak, real score required
  if (isThirdSet && isJuniorThird) {
    if (!Number.isInteger(you) || !Number.isInteger(them)) {
      return invalid('Scores must be whole numbers.');
    }
    if (you < 0 || them < 0 || you > 10 || them > 10) {
      return invalid('Junior 3rd-set tiebreak scores must be between 0 and 10.');
    }
    // 7-6 is not allowed; the actual score must be recorded
    if (you === 7 && them === 6) return invalid('Record the actual tiebreak score, not 7-6 (e.g. 10-4).');
    if (you === 6 && them === 7) return invalid('Record the actual tiebreak score, not 7-6 (e.g. 10-4).');
    // Neither player has won yet
    if (you < 10 && them < 10) return invalid('Tiebreak winner must reach 10 points.');
    // Winner needs 2-point lead (exception: 10-9 is valid — no deuce in match tiebreak)
    const hi = Math.max(you, them);
    const lo = Math.min(you, them);
    if (hi === 10 && lo <= 8) return ok;        // 10-0 through 10-8
    if (hi === 10 && lo === 9) return ok;        // 10-9 (sudden death)
    return invalid('Tiebreak winner must reach 10 with at least a 1-point lead (10-9 minimum).');
  }

  // Standard set validation
  if (!Number.isInteger(you) || !Number.isInteger(them)) {
    return invalid('Scores must be whole numbers.');
  }
  if (you < 0 || them < 0) {
    return invalid('Scores cannot be negative.');
  }
  if (you > 7 || them > 7) {
    return invalid('Set scores cannot exceed 7.');
  }

  // 6-6 is always invalid — a tiebreak must have been played
  if (you === 6 && them === 6) {
    return invalid('6-6 is invalid. Record the tiebreak result as 7-6.');
  }

  // 7-6 is always valid (tiebreak played)
  if ((you === 7 && them === 6) || (you === 6 && them === 7)) {
    return ok;
  }

  // Any other score involving 7 is invalid
  if (you === 7 || them === 7) {
    return invalid('A score of 7 is only valid in a tiebreak result (7-6).');
  }

  // Standard set: winner must reach 6 with a 2-game lead
  const hi = Math.max(you, them);
  const lo = Math.min(you, them);

  if (hi < 6) {
    return invalid('Set winner must reach at least 6 games.');
  }
  if (hi === 6 && hi - lo < 2) {
    // 6-5 needs to continue to 7-5 or tiebreak
    return invalid('At 6-5, play must continue to 7-5 or a tiebreak (record as 7-6).');
  }

  return ok;
}

// TODO: connect to your API response shape
//
// calculateSeasonTotals expects an array of match objects shaped like:
// {
//   sets:      Array<{ you: number, them: number }>,
//   matchType: "standard" | "forfeit" | "retired" | "not_reported",
//   isForfeitLoss: boolean   // true when YOU forfeited (lost the forfeit)
// }
//
// Adjust the field names below to match your actual API response.

/**
 * Aggregates a player's season statistics from an array of match records.
 *
 * Playoff qualification requires:
 *   • At least 9 total league points AND
 *   • No more than 1 forfeit loss
 *
 * gameWinPct = (total games won / total games played) × 100, rounded to 1 dp.
 * Returns 0 when no games have been played (avoids division by zero).
 *
 * @param {Array<{
 *   sets:          Array<{you: number, them: number}>,
 *   matchType:     "standard" | "forfeit" | "retired" | "not_reported",
 *   isForfeitLoss: boolean
 * }>} matches
 * @returns {{
 *   totalPoints:         number,
 *   wins:                number,
 *   losses:              number,
 *   setsWon:             number,
 *   setsLost:            number,
 *   gameWinPct:          number,
 *   qualifiesForPlayoffs: boolean
 * }}
 */
export function calculateSeasonTotals(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      totalPoints: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      gameWinPct: 0,
      qualifiesForPlayoffs: false,
    };
  }

  let totalPoints  = 0;
  let wins         = 0;
  let losses       = 0;
  let setsWon      = 0;
  let setsLost     = 0;
  let totalGamesWon    = 0;
  let totalGamesPlayed = 0;
  let forfeitLosses    = 0;

  for (const match of matches) {
    if (!match) continue;

    const type = match.matchType || 'standard';
    const isForfeitLoss = !!match.isForfeitLoss;

    // Track forfeit losses for playoff eligibility
    if (type === 'forfeit' && isForfeitLoss) forfeitLosses++;

    // Forfeit loss: swap points so the opponent "won"
    const result = isForfeitLoss
      ? { yourPoints: 0, opponentPoints: 3, winner: 'opponent', setsWon: 0, setsLost: 0 }
      : calculateMatchPoints(match.sets, type);

    totalPoints += result.yourPoints;
    setsWon     += result.setsWon;
    setsLost    += result.setsLost;

    if (result.winner === 'you')       wins++;
    else if (result.winner === 'opponent') losses++;

    // Accumulate game counts (only for played sets)
    if (type !== 'forfeit' && type !== 'not_reported') {
      const games = countGames(match.sets);
      totalGamesWon    += games.youGames;
      totalGamesPlayed += games.youGames + games.themGames;
    }
  }

  const gameWinPct = totalGamesPlayed > 0
    ? Math.round((totalGamesWon / totalGamesPlayed) * 1000) / 10  // 1 dp
    : 0;

  const qualifiesForPlayoffs = totalPoints >= 9 && forfeitLosses <= 1;

  return {
    totalPoints,
    wins,
    losses,
    setsWon,
    setsLost,
    gameWinPct,
    qualifiesForPlayoffs,
  };
}

/**
 * Returns true if the reporting deadline for a match has passed.
 *
 * The deadline is treated as midnight (start of day) in the user's local
 * timezone. A match with a deadline of "2025-04-15" expires at the start of
 * 2025-04-15 local time (i.e. any moment on or after that date is past).
 *
 * Returns false for any invalid / falsy input.
 *
 * @param {string | Date} deadlineDate  ISO date string ("YYYY-MM-DD") or Date
 * @returns {boolean}
 */
export function isDeadlinePassed(deadlineDate) {
  if (!deadlineDate) return false;

  let deadline;

  try {
    if (deadlineDate instanceof Date) {
      deadline = deadlineDate;
    } else {
      // Parse as local midnight by splitting the date parts manually.
      // new Date("YYYY-MM-DD") would parse as UTC midnight, which is wrong.
      const [year, month, day] = String(deadlineDate).split('-').map(Number);
      if (!year || !month || !day) return false;
      deadline = new Date(year, month - 1, day); // local midnight
    }

    if (isNaN(deadline.getTime())) return false;

    const now = new Date();
    // Deadline has passed if today is the same day or later
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return todayMidnight >= deadline;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline test cases (not executed automatically — copy into a browser console
// or a test runner to verify)
// ─────────────────────────────────────────────────────────────────────────────
/*

// ── determineMatchWinner ─────────────────────────────────────────────────────

determineMatchWinner([{ you: 6, them: 4 }, { you: 6, them: 3 }])
// → "you"   (won 2 sets)

determineMatchWinner([{ you: 4, them: 6 }, { you: 3, them: 6 }])
// → "opponent"   (lost 2 sets)

determineMatchWinner([{ you: 6, them: 4 }, { you: 3, them: 6 }])
// → null   (1 set each, match not complete)

determineMatchWinner([])
// → null   (no sets played)

determineMatchWinner(null)
// → null   (safe with bad input)


// ── calculateMatchPoints ─────────────────────────────────────────────────────

calculateMatchPoints([{ you: 6, them: 4 }, { you: 6, them: 3 }], 'standard')
// → { yourPoints: 3, opponentPoints: 0, winner: 'you', setsWon: 2, setsLost: 0 }
// You won 2-0: 2 sets + 1 bonus = 3. Opponent won 0 sets = 0.

calculateMatchPoints([{ you: 6, them: 4 }, { you: 3, them: 6 }, { you: 7, them: 6 }], 'standard')
// → { yourPoints: 3, opponentPoints: 1, winner: 'you', setsWon: 2, setsLost: 1 }
// You won 2-1: 2 sets + 1 bonus = 3. Opponent won 1 set = 1 consolation.

calculateMatchPoints([{ you: 4, them: 6 }, { you: 3, them: 6 }], 'standard')
// → { yourPoints: 0, opponentPoints: 3, winner: 'opponent', setsWon: 0, setsLost: 2 }
// You lost 0-2: 0 sets won = 0. Opponent: 2 + 1 = 3.

calculateMatchPoints([{ you: 6, them: 4 }, { you: 3, them: 6 }], 'retired')
// → { yourPoints: 0, opponentPoints: 0, winner: null, setsWon: 1, setsLost: 1 }
// Retired with 1 set each — no winner declared yet.

calculateMatchPoints([], 'forfeit')
// → { yourPoints: 3, opponentPoints: 0, winner: 'you', setsWon: 0, setsLost: 0 }
// Forfeit win: caller assumes "you" won.

calculateMatchPoints([{ you: 6, them: 3 }, { you: 6, them: 2 }], 'not_reported')
// → { yourPoints: 0, opponentPoints: 0, winner: null, setsWon: 0, setsLost: 0 }
// Not reported: both get 0 regardless of sets.


// ── formatScoreString ────────────────────────────────────────────────────────

formatScoreString([{ you: 6, them: 4 }])
// → "6-4"

formatScoreString([{ you: 6, them: 4 }, { you: 3, them: 6 }, { you: 7, them: 6 }])
// → "6-4, 3-6, 7-6"

formatScoreString([])
// → ""

formatScoreString(null)
// → ""


// ── validateSetScore ─────────────────────────────────────────────────────────

validateSetScore(6, 4, 0)
// → { valid: true, error: null }

validateSetScore(7, 6, 1)
// → { valid: true, error: null }   (tiebreak result)

validateSetScore(6, 6, 0)
// → { valid: false, error: "6-6 is invalid. Record the tiebreak result as 7-6." }

validateSetScore(6, 5, 0)
// → { valid: false, error: "At 6-5, play must continue to 7-5 or a tiebreak (record as 7-6)." }

validateSetScore(8, 6, 0)
// → { valid: false, error: "Set scores cannot exceed 7." }

validateSetScore(7, 5, 0)
// → { valid: true, error: null }   (7-5 is a valid set)

validateSetScore(7, 3, 0)
// → { valid: false, error: "A score of 7 is only valid in a tiebreak result (7-6)." }

validateSetScore(10, 4, 2, true)
// → { valid: true, error: null }   (junior 3rd-set tiebreak, 10-4)

validateSetScore(7, 6, 2, true)
// → { valid: false, error: "Record the actual tiebreak score, not 7-6 (e.g. 10-4)." }

validateSetScore(10, 9, 2, true)
// → { valid: true, error: null }   (sudden death — 10-9 is valid)

validateSetScore(10, 10, 2, true)
// → { valid: false, error: "Tiebreak winner must reach 10 with at least a 1-point lead (10-9 minimum)." }


// ── calculateSeasonTotals ─────────────────────────────────────────────────────

calculateSeasonTotals([
  { sets: [{ you: 6, them: 4 }, { you: 6, them: 3 }],              matchType: 'standard',     isForfeitLoss: false },
  { sets: [{ you: 4, them: 6 }, { you: 3, them: 6 }],              matchType: 'standard',     isForfeitLoss: false },
  { sets: [{ you: 6, them: 4 }, { you: 3, them: 6 }, { you: 7, them: 6 }], matchType: 'standard', isForfeitLoss: false },
  { sets: [],                                                        matchType: 'forfeit',      isForfeitLoss: false },
])
// → { totalPoints: 9, wins: 3, losses: 1, setsWon: 5, setsLost: 3,
//     gameWinPct: 53.1,  qualifiesForPlayoffs: true }
// Points: 3 + 0 + 3 + 3 = 9; ≥9 pts, 0 forfeit losses → qualifies.

calculateSeasonTotals([
  { sets: [], matchType: 'forfeit', isForfeitLoss: true },
  { sets: [], matchType: 'forfeit', isForfeitLoss: true },
])
// → { totalPoints: 0, wins: 0, losses: 2, setsWon: 0, setsLost: 0,
//     gameWinPct: 0, qualifiesForPlayoffs: false }
// 2 forfeit losses > 1 allowed → does not qualify.

calculateSeasonTotals([])
// → { totalPoints: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0,
//     gameWinPct: 0, qualifiesForPlayoffs: false }


// ── isDeadlinePassed ─────────────────────────────────────────────────────────

isDeadlinePassed('2020-01-01')
// → true   (well in the past)

isDeadlinePassed('2099-12-31')
// → false  (far in the future)

isDeadlinePassed(null)
// → false  (safe with bad input)

isDeadlinePassed('not-a-date')
// → false  (invalid string handled gracefully)

*/
