import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { AvatarPlayer, Score } from '../engines/types';

const Scoreboard: Component<{
  scores: Record<AvatarPlayer["id"], Score>,
  players: AvatarPlayer[],
}> = (props) => {

  // What do we want to show here?
  // Each player's total score (done)
  // Who each player fooled? And with what?

  // It would be nice if the previous options stayed the same??
  // Yes. Display all the captions, put who wrote each one on it, as well as who picked each
  // Give the truth a green background.

  // This scoreboard only renders the cumulative scores (and possibly shows the differences)

	return (
    <>
      <h3>Scores:</h3>
      <div class="Scoreboard">
        <For each={props.players.sort((p1, p2) => props.scores[p2.id].current - props.scores[p1.id].current)}>{(p, i) => {
          return <div class="Scoreboard-Row">
            {i()+1}: 
            <img class="Scoreboard-Avatar" src={p.avatar ?? ''} /> 
            {props.scores[p.id].current} 
            {props.scores[p.id].current !== props.scores[p.id].previous ? ` (+${props.scores[p.id].current - props.scores[p.id].previous})` : ''}
          </div>
        }}</For>
      </div>
    </>
	)
}

export default Scoreboard
