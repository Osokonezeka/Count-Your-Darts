export interface BracketMatchLike<TPlayer> {
  id: string;
  round?: number;
  matchIndex?: number;
  bracket?: string;
  player1?: TPlayer | null;
  player2?: TPlayer | null;
  winner?: TPlayer | null;
  nextMatchId?: string | null;
  nextMatchSlot?: "p1" | "p2" | null;
  loserDropMatchId?: string | null;
  loserDropSlot?: "p1" | "p2" | null;
  isBye?: boolean;
  isThirdPlace?: boolean;
}

export function advanceBracketAfterMatchWin<
  TPlayer extends { id: string },
  TMatch extends BracketMatchLike<TPlayer>,
>(bracket: TMatch[], matchId: string, winner: TPlayer, loser?: TPlayer | null): void {
  const idx = bracket.findIndex((m) => m.id === matchId);
  if (idx === -1) return;
  const match = bracket[idx];
  match.winner = winner;

  if (match.nextMatchId) {
    const nIdx = bracket.findIndex((m) => m.id === match.nextMatchId);
    if (nIdx > -1) {
      if (match.nextMatchSlot === "p1") bracket[nIdx].player1 = winner;
      else if (match.nextMatchSlot === "p2") bracket[nIdx].player2 = winner;
      else if ((match.matchIndex || 0) % 2 === 0) bracket[nIdx].player1 = winner;
      else bracket[nIdx].player2 = winner;
    }
  }

  if (match.loserDropMatchId && loser) {
    const dIdx = bracket.findIndex((m) => m.id === match.loserDropMatchId);
    if (dIdx > -1) {
      if (match.loserDropSlot === "p1") bracket[dIdx].player1 = loser;
      else bracket[dIdx].player2 = loser;
    }
  }

  if (match.bracket === "gf" && match.round === 1) {
    const gfRound2 = bracket.find((m) => m.bracket === "gf" && m.round === 2);
    if (gfRound2) {
      if (winner.id === match.player1?.id) {
        gfRound2.isBye = true;
        gfRound2.winner = winner;
      } else {
        gfRound2.player1 = match.player1 ?? null;
        gfRound2.player2 = match.player2 ?? null;
      }
    }
  }

  const totalRounds = Math.max(...bracket.map((m) => m.round || 0));
  if (loser && match.round === totalRounds - 1) {
    const thirdPlaceIdx = bracket.findIndex((m) => m.isThirdPlace);
    if (thirdPlaceIdx > -1) {
      if ((match.matchIndex || 0) % 2 === 0)
        bracket[thirdPlaceIdx].player1 = loser;
      else bracket[thirdPlaceIdx].player2 = loser;
    }
  }
}
