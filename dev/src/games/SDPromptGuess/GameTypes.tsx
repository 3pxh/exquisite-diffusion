export interface PlayerHandle {
  handle: string,
  uuid: string
}
export interface DiffusionImage {
  player: PlayerHandle,
  url: string,
  secretPrompt: string,
  prompt: string,
}
export interface CaptionData {
  player: PlayerHandle,
  caption: string
}
export interface Vote {
  vote: PlayerHandle,
  player: PlayerHandle
}
