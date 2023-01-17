
export type AbstractPlayer = {
  uuid: string,
  handle: string,
  // avatar: string,
}

// Forgive me father for I have sinned.
export type AbstractPlayer2 = {
  id: string,
  handle: string,
  // avatar: string,
}

export type AbstractPlayerBase<T> = AbstractPlayer & T

export type Score = {
  player: AbstractPlayer['uuid'],
  current: number,
  previous: number
}
