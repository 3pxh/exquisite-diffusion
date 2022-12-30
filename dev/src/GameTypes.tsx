export enum GameType {
  NeoXPromptGuess,
  SDPromptGuess,
  Hadron64,
}

export type GameTypeString = "NeoXPromptGuess" | "SDPromptGuess" | "Hadron64"

export const GameTypeMap = {
  "NeoXPromptGuess": GameType.NeoXPromptGuess,
  "SDPromptGuess": GameType.SDPromptGuess,
  "Hadron64": GameType.Hadron64,
}

export interface Room {
  roomId: number,
  shortcode: string,
  isHost: boolean,
}
