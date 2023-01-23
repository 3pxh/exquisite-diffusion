export enum GameType {
  NeoXPromptGuess,
  SDPromptGuess,
  Hadron64,
  Gisticle,
  PG,
  PGImage,
  PGGisticle,
  Tresmojis
}

export type GameTypeString = "NeoXPromptGuess" | "SDPromptGuess" | 
  "Hadron64" | "Gisticle" | "PG" | "PGImage" | "PGGisticle" |
  "Tresmojis"

export const GameTypeMap = {
  "NeoXPromptGuess": GameType.NeoXPromptGuess,
  "SDPromptGuess": GameType.SDPromptGuess,
  "Hadron64": GameType.Hadron64,
  "Gisticle": GameType.Gisticle,
  "PG": GameType.PG,
  "PGImage": GameType.PGImage,
  "PGGisticle": GameType.PGGisticle,
  "Tresmojis": GameType.Tresmojis,
}

export interface Room {
  roomId: number,
  shortcode: string,
  isHost: boolean,
  gameType: GameType,
}
