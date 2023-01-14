import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { PromptGuessGameEngine } from './engines/PromptGuessBase'
import { Room } from './engines/EngineBase'

const PG: Component<Room> = (props) => {
  const engine = new PromptGuessGameEngine({
    roomId: props.roomId,
    userId: props.userId,
    isHost: props.isHost,
  });

	return (
    <>
      <h3>
      Game: 
      <button onclick={() => engine.hello()}>Hello.</button>
      <button onclick={() => engine.goodbye()}>Goodbye.</button>
      Clicks: {engine.gameState.numClicks}

      <For each={engine.gameState.history}>{(c, i) => {
        return <p>{JSON.stringify(c)}</p>
      }}</For>
      </h3>
    </>
	)
}

export default PG
