import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { AbstractPlayer, Score } from '../engines/types';

const Scoreboard: Component<{
  scores: Record<AbstractPlayer["id"], Score>,
  players: AbstractPlayer[]
}> = (props) => {
  const playerInfo: Map<AbstractPlayer["id"], AbstractPlayer> = new Map();
  props.players.forEach((p: AbstractPlayer) => {
    playerInfo.set(p.id, p);
  });

  // const sortedScores = [...props.scores].sort((s1, s2) => {
  //   return s2.current - s1.current;
  // })

	return (
    <>
      <h3>Scores:</h3>
      <For each={props.players}>{(p, i) => {
        return <p>{props.scores[p.id].current}</p>
      }}</For>
    </>
	)
}

export default Scoreboard
