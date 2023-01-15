import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { AbstractPlayer, Score } from '../engines/types';

const Scoreboard: Component<{
  scores: Score[],
  players: AbstractPlayer[]
}> = (props) => {
  const playerInfo: Map<AbstractPlayer["uuid"], AbstractPlayer> = new Map();
  props.players.forEach((p: AbstractPlayer) => {
    playerInfo.set(p.uuid, p);
  });

  const sortedScores = [...props.scores].sort((s1, s2) => {
    return s2.current - s1.current;
  })

	return (
    <>
      <For each={sortedScores}>{(s, i) => {
        return <p>{playerInfo.get(s.player)?.handle}: {s.current}</p>
      }}</For>
    </>
	)
}

export default Scoreboard
