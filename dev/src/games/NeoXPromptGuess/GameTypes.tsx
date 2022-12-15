export interface PlayerHandle {
  handle: string,
  uuid: string
}
export interface TextCompletion {
  player: PlayerHandle,
  prompt: string,
  text: string
}
export interface CaptionData {
  player: PlayerHandle,
  caption: string
}
export interface Vote {
  vote: PlayerHandle,
  player: PlayerHandle
}
