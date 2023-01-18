import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { useAuth } from "../AuthProvider";
import { PromptGuessGameEngine, State } from './engines/PromptGuessBase'
import { Room } from './engines/EngineBase'
import Scoreboard from './components/Scoreboard'

const PG: Component<Room> = (props) => {
  const { session, playerHandle, setPlayerHandle } = useAuth();
  const [inputVal, setInputVal] = createSignal<string>("")

  // We could totally pass in a game engine, allowing for subclassing and such,
  // e.g. replace the generate() function.
  const engine = new PromptGuessGameEngine({
    roomId: props.roomId,
    userId: props.userId,
    isHost: props.isHost,
    shortcode: props.shortcode,
  });

  engine.updatePlayer({
    handle: playerHandle()
  });

  const playerState = () => { return engine.player().state; }

	return (
    <>
      <div class="GameHeader">
        <div class="_container">
          <p class="GameHeader-room">
            <strong>Room code: </strong>
            <span class="GameHeader-room-code">
              {props.shortcode}
            </span>
          </p>

          <p class="GameHeader-player">
            <span>Hey, </span>
            <img class="GameHeader-avatar" src="/src/assets/avatars/1.png" alt={engine.player().handle} />
            <span>{engine.player().handle}!</span>
          </p>

          <p class="GameHeader-game">
            You're playing <strong>game name</strong>
          </p>

          {/* player state: {playerState()} {JSON.stringify(engine.player())} */}
        </div>
      </div>

      <Switch fallback={"Unrecognized Game State"}>
        <Match when={playerState() === State.Lobby}>
          <div class="GameLobby">
            <div class="_container">
              <p class="GameLobby-headline">
                Game Lobby
              </p>

              {engine.players && engine.players().length > 0 && 
                <ul class="GameLobby-players">
                  <For each={engine.players()}>{(p, i) => {
                    return (
                      <li class="GameLobby-player">
                        <img class="GameLobby-avatar" src="/src/assets/avatars/1.png" alt={p.handle ?? "New player"} />
                        {p.handle ?? "New player"}
                      </li>
                    )
                  }}</For>
                </ul>
              }

              <Show when={engine.isHost}>
                <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
                <button onclick={() => engine.startGame(inputVal())}>Start</button>
              </Show>
            </div>
          </div>
        </Match>

        <Match when={playerState() === State.WritingPrompts}>
          <div class="_container">
            <h2>Make something fun</h2>

            <form>
              <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
              <button onclick={() => engine.generate(inputVal())}>Make it so!</button>
            </form>
          </div>
        </Match>

        <Match when={playerState() === State.CreatingLies}>
          <h2>What made this?</h2>
          {JSON.stringify(engine.gameState.generations[0])}
          <Show when={engine.gameState.generations[0].player.id !== props.userId}
            fallback={"You are responsible for this masterpiece. Well done."}>
            <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
            <button onclick={() => engine.caption(inputVal())}>Make it so!</button>
          </Show>
        </Match>

        <Match when={playerState() === State.Voting}>
          Which prompt made it?
          <ol>
            <For each={engine.gameState.captions}>{(c, i) =>
              <li><button onclick={() => {engine.vote(c.player)}}><h3>{c.caption}</h3></button></li>
            }</For>
          </ol> 
        </Match>

        <Match when={playerState() === State.Scoring}>
          <Scoreboard players={engine.players()} scores={engine.gameState.scores} />
          <Show when={props.isHost}>
            <button onclick={() => { engine.continueAfterScoring() }}>Continue</button>
          </Show>
        </Match>

        <Match when={playerState() === State.Finished}>
          <h2>Final Scores:</h2>
          <Scoreboard players={engine.players()} scores={engine.gameState.scores} />
        </Match>

        <Match when={playerState() === State.Waiting}>
          Waiting 
        </Match>
      </Switch>

      <div class="_container">
        <Show when={playerState() !== State.Lobby}>
          <For each={engine.players()}>{(p, i) => {
            return <p>{p.handle} is {p.state === State.Waiting ? 'done' : 'still working'}</p>
          }}</For>
        </Show>
      </div>
    </>
	)
}

export default PG
