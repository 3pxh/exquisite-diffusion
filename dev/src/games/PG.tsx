import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { useAuth } from "../AuthProvider";
import { PromptGuessGameEngine, State } from './engines/PromptGuessBase'
import { Room } from './engines/EngineBase'
import Scoreboard from './components/Scoreboard'
import AvatarPicker from './components/AvatarPicker';

const PG: Component<Room & {engine: PromptGuessGameEngine}> = (props) => {
  const { session, playerHandle, setPlayerHandle } = useAuth();
  const [inputVal, setInputVal] = createSignal<string>("")

  props.engine.updatePlayer({
    handle: playerHandle()
  });

  const playerState = () => { return props.engine.player().state; }

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
            <img class="GameHeader-avatar" src={props.engine.player().avatar ?? ''} alt={props.engine.player().handle} />
            <span>{props.engine.player().handle}!</span>
          </p>

          <p class="GameHeader-game">
            You're playing <strong>game name</strong>
          </p>

          {/* player state: {playerState()} {JSON.stringify(props.engine.player())} */}
        </div>
      </div>

      <Switch fallback={"Unrecognized Game State"}>
        <Match when={playerState() === State.Lobby}>
          <div class="GameLobby">
            <div class="_container">
              <p class="GameLobby-headline">
                Game Lobby
              </p>

              <AvatarPicker players={props.engine.players()} setAvatarUrl={(url) => {
                props.engine.updatePlayer({ avatar: url })
              }} />
              
              {props.engine.players && props.engine.players().length > 0 && 
                <ul class="GameLobby-players">
                  <For each={props.engine.players()}>{(p, i) => {
                    return (
                      <li class="GameLobby-player">
                        <img class="GameLobby-avatar" src={p.avatar ?? ''} alt={p.handle ?? "New player"} />
                        {p.handle ?? "New player"}
                      </li>
                    )
                  }}</For>
                </ul>
              }

              <Show when={props.engine.isHost}>
                <button onclick={() => props.engine.startGame(inputVal())}>Start</button>
              </Show>
            </div>
          </div>
        </Match>
        <Match when={playerState() === State.WritingPrompts}>
          {props.engine.renderPrompt()}
          <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
          <button onclick={() => props.engine.generate(inputVal())}>Make it so!</button>
        </Match>
        <Match when={playerState() === State.CreatingLies}>
          {props.engine.renderGeneration(props.engine.gameState.generations[0])}
          <Show when={props.engine.gameState.generations[0].player.id !== props.userId}
            fallback={"You are responsible for this masterpiece. Well done."}>
            <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
            <button onclick={() => props.engine.caption(inputVal())}>Fool others!</button>
          </Show>
        </Match>
        <Match when={playerState() === State.Voting}>
          {props.engine.renderGeneration(props.engine.gameState.generations[0])}
          <ol>
            <For each={props.engine.gameState.captions}>{(c, i) =>
              <li>
                <Switch>
                  <Match when={props.engine.gameState.generations[0].player.id === props.userId}>
                    <h3>{c.caption}</h3>
                  </Match>
                  <Match when={c.player === props.userId}>
                    <button style="opacity:.5;"><h3>{c.caption}</h3></button>
                  </Match>
                  <Match when={true}>
                    <button onclick={() => {props.engine.vote(c.player)}}><h3>{c.caption}</h3></button>
                  </Match>
                </Switch>
              </li>
            }</For>
          </ol> 
        </Match>
        <Match when={playerState() === State.Scoring}>
          <Scoreboard players={props.engine.players()} scores={props.engine.gameState.scores} />
          <Show when={props.isHost}>
            <button onclick={() => { props.engine.continueAfterScoring() }}>Continue</button>
          </Show>
        </Match>
        <Match when={playerState() === State.Finished}>
          <h2>Final Scores:</h2>
          <Scoreboard players={props.engine.players()} scores={props.engine.gameState.scores} />
        </Match>
        <Match when={playerState() === State.Waiting}>
          Waiting on other players.
        </Match>
      </Switch>

      <Show when={playerState() !== State.Lobby && playerState() !== State.Scoring}>
        <div class="PG-WaitingPlayers">
          <For each={props.engine.players()}>{(p, i) => {
            const gens = props.engine.gameState.generations;
            return <>
              <img class={p.state === State.Waiting || (gens.length > 0 && gens[0].player.id === p.id)
                 ? "PG-WaitingPlayers--Done" : "PG-WaitingPlayers--NotDone"} 
                   src={p.avatar} width="32" />
            </>
          }}</For>
        </div>
      </Show>

      <p style="color:red;">{props.engine.error()}</p>
      
    </>
	)
}

export default PG
