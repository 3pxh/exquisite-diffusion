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
            You're playing <strong>{props.engine.gameName}</strong>
          </p>

          {/* player state: {playerState()} {JSON.stringify(props.engine.player())} */}
        </div>
      </div>

      <Show when={playerState() === State.Lobby}>
        <div class="GameLobby">
          <div class="_container">
            <div style="display:flex;flex-direction:row;">
              <div>
                <p class="GameLobby-headline">
                  Choose your portrait
                </p>
                <AvatarPicker players={props.engine.players()} setAvatarUrl={(url) => {
                  props.engine.updatePlayer({ avatar: url })
                }} />
              </div>
              <div style="margin-left:20px;">
                <p class="GameLobby-headline">
                  Players in room
                </p>
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
                  <button style="margin:10px; padding:10px 30px;" onclick={() => props.engine.startGame(inputVal())}><h2>Start Game!</h2></button>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={playerState() !== State.Lobby}>
        <div class="PG-timer" style={`width: ${props.engine.timer.percentRemaining() > 0 ? props.engine.timer.percentRemaining() : 100}%`}></div>
        <div class="PG-Game">
          <div class="PG-Game-Left">
          <div class="PG-Game-Left-Prompt">
              <Switch fallback={"Unrecognized Game State"}>
                <Match when={playerState() === State.WritingPrompts}>
                  {props.engine.renderPrompt()}
                  <div style="margin-top: 10px;">
                    <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
                    <button onclick={() => props.engine.generate(inputVal())}>Make it so!</button>
                  </div>
                </Match>
                <Match when={playerState() === State.CreatingLies}>
                  <Show when={props.engine.gameState.generations.length > 0}
                    fallback={"Waiting on the AI..."}>
                    <Show when={props.engine.gameState.generations[0].player.id !== props.userId}
                      fallback={"You are responsible for this masterpiece. gj."}>
                      {props.engine.renderGenerationPrompt(props.engine.gameState.generations[0])}
                      <div style="margin-top: 10px;">
                        <input onchange={(e) => { setInputVal(e.currentTarget.value) }} />
                        <button onclick={() => props.engine.caption(inputVal())}>Fool others!</button>
                      </div>
                    </Show>
                  </Show>
                </Match>
                <Match when={playerState() === State.Waiting}>
                  Waiting on other players.
                </Match>
                <Match when={playerState() === State.Voting}>
                  {props.engine.renderGenerationPrompt(props.engine.gameState.generations[0])}
                </Match>
                <Match when={playerState() === State.Scoring}>
                  <>
                    {/* <h3>Who got it right?</h3> */}
                    The truth was: <strong>{props.engine.gameState.generations[0].prompt}</strong>
                  </>
                </Match>
              </Switch>
              <p class="PG-Game-Error">{props.engine.error()}</p>
            </div>
            <div class="PG-Game-Left-Generation">
              <Switch>
                <Match when={playerState() === State.WritingPrompts}>
                  <h2>Write a prompt above!</h2>
                  {/* Swap with a custom message per game */}
                </Match>
                <Match when={playerState() === State.CreatingLies || 
                            playerState() === State.Voting ||
                            playerState() === State.Scoring}>
                  <Show when={props.engine.gameState.generations.length > 0} fallback={"Waiting on the AI..."}>
                    {props.engine.renderGeneration(props.engine.gameState.generations[0])}
                  </Show>
                </Match>
              </Switch>
            </div>
          </div>
          <div class="PG-Game-Right">
            <Show when={playerState() !== State.Scoring}>
              <div class="PG-WaitingPlayers">
                <For each={props.engine.players()}>{(p, i) => {
                  const gens = props.engine.gameState.generations;
                  return <>
                    <img class={p.state === State.Waiting || (gens.length > 0 && gens[0].player.id === p.id)
                      ? "PG-WaitingPlayers--Done" : "PG-WaitingPlayers--NotDone"} 
                        src={p.avatar} />
                  </>
                }}</For>
              </div>
            </Show>
            <Switch>
              <Match when={playerState() === State.Voting}>
                <ol>
                  <For each={props.engine.gameState.captions}>{(c, i) =>
                    <li>
                      <Switch>
                        <Match when={props.engine.gameState.generations[0].player.id === props.userId}>
                        <h4>{c.caption}</h4>
                        </Match>
                        <Match when={c.player === props.userId}>
                          <button style="opacity:.5;">{c.caption}</button>
                        </Match>
                        <Match when={true}>
                          <button onclick={() => {props.engine.vote(c.player)}}>{c.caption}</button>
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
            </Switch>
          </div>
        </div>
      </Show>

      
      
    </>
	)
}

export default PG
