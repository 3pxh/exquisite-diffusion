import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { PromptGuessGameEngine, State } from './engines/PromptGuessBase'
import { Room } from './engines/EngineBase'
import Scoreboard from './components/Scoreboard'

const PG: Component<Room> = (props) => {
  const [inputVal, setInputVal] = createSignal<string>("")

  // We could totally pass in a game engine, allowing for subclassing and such,
  // e.g. replace the generate() function.
  const engine = new PromptGuessGameEngine({
    roomId: props.roomId,
    userId: props.userId,
    isHost: props.isHost,
  });

	return (
    <>
      <h3>
      Game: 
      player state: {engine.gameState.playerState}
      <Switch fallback={"Unrecognized Game State"}>
        <Match when={engine.gameState.playerState === State.Lobby}>
          Lobby
          <Show when={engine.isHost}>
            <button onclick={() => engine.startGame()}>Start</button>
          </Show>
        </Match>
        <Match when={engine.gameState.playerState === State.WritingPrompts}>
          <h2>Make something fun</h2>
          <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
          <button onclick={() => engine.generate(inputVal())}>Make it so!</button>
        </Match>
        <Match when={engine.gameState.playerState === State.CreatingLies}>
          <h2>What made this?</h2>
          {JSON.stringify(engine.gameState.generations[0])}
          <Show when={engine.gameState.generations[0].player.uuid !== props.userId}
            fallback={"You are responsible for this masterpiece. Well done."}>
            <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
            <button onclick={() => engine.caption(inputVal())}>Make it so!</button>
          </Show>
        </Match>
        <Match when={engine.gameState.playerState === State.Voting}>
          Which prompt made it?
          <ol>
            <For each={engine.gameState.captions}>{(c, i) =>
              <li><button onclick={() => {engine.vote(c.player)}}><h3>{c.caption}</h3></button></li>
            }</For>
          </ol> 
        </Match>
        <Match when={engine.gameState.playerState === State.Scoring}>
          <Scoreboard players={engine.gameState.players} scores={engine.gameState.scores} />
        </Match>
        <Match when={engine.gameState.playerState === State.Finished}>
          <h2>Final Scores:</h2>
          <Scoreboard players={engine.gameState.players} scores={engine.gameState.scores} />
        </Match>
        <Match when={engine.gameState.playerState === State.Waiting}>
          Waiting 
        </Match>
      </Switch>

      <Show when={engine.gameState.playerState !== State.Lobby}>
        <For each={engine.gameState.players}>{(p, i) => {
          return <p>{p.handle} is {p.state === State.Waiting ? 'done' : 'still working'}</p>
        }}</For>
      </Show>

      <For each={engine.gameState.history}>{(c, i) => {
        return <p>{JSON.stringify(c)}</p>
      }}</For>
      </h3>
    </>
	)
}

export default PG
