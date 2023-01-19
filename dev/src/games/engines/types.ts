
export type AbstractPlayer = {
  id: string,
}

export type AbstractPlayerBase<T> = AbstractPlayer & T

export type AvatarPlayer = AbstractPlayer & {
  avatar?: string,
}

export type Score = {
  player: AbstractPlayer['id'],
  current: number,
  previous: number
}
