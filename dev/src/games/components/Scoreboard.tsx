import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { AvatarPlayer, Score } from '../engines/types';

const Scoreboard: Component<{
  scores: Record<AvatarPlayer["id"], Score>,
  players: AvatarPlayer[]
}> = (props) => {
	return (
    <>
      <h3>Scores:</h3>
      <For each={props.players.sort((p1, p2) => props.scores[p2.id].current - props.scores[p1.id].current)}>{(p, i) => {
        return <p><img src={p.avatar ?? ''} width="32" /> {props.scores[p.id].current}</p>
      }}</For>
    </>
	)
}

export default Scoreboard
