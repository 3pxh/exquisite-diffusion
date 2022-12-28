export enum GameType {
  NeoXPromptGuess,
  SDPromptGuess
}

export type GameTypeString = "NeoXPromptGuess" | "SDPromptGuess"

export const GameTypeMap = {
  "NeoXPromptGuess": GameType.NeoXPromptGuess,
  "SDPromptGuess": GameType.SDPromptGuess,
}

export interface Room {
  roomId: number,
  shortcode: string,
  isHost: boolean,
}
