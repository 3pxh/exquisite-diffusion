
export type AbstractPlayer = {
  id: string,
}

export type AbstractPlayerBase<T> = AbstractPlayer & T

export type Score = {
  player: AbstractPlayer['id'],
  current: number,
  previous: number
}
