
export type AbstractPlayer = {
  uuid: string,
  handle: string,
}

export type AbstractPlayerBase<T> = AbstractPlayer & T

export type Score = {
  player: AbstractPlayer['uuid'],
  current: number,
  previous: number
}
