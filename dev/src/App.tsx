import { Component, createSignal, Switch, Match } from 'solid-js'
import { useAuth, AuthType } from "./AuthProvider";
import AuthSelection from './AuthSelection'

import NeoXPromptGuessHost from './games/NeoXPromptGuess'
import SDPromptGuessHost from './games/SDPromptGuess/Host'

import JoinGame from './JoinGame'
import GameSelection from './GameSelection'
import { GameType } from './GameTypes'

interface Game {
  roomId?: number,
  game: GameType
}

const RenderGame: Component<{game: Game}> = (props) => {
  return (
    <Switch>
      <Match when={props.game.game === GameType.NeoXPromptGuess}>
        <NeoXPromptGuessHost roomId={props.game.roomId} />
      </Match>
      <Match when={props.game.game === GameType.SDPromptGuess}>
        Game mode is under construction.
        {/* <SDPromptGuessHost roomId={props.roomId} /> */}
      </Match>
    </Switch>
  )
}

const App: Component = () => {
  const { session, authState } = useAuth();
  const [game, setGame] = createSignal<Game | null>(null)
  const chooseGame = (g: GameType, roomId?: number) => {
    setGame({
      game: g,
      roomId: roomId
    });
  }

	return (
    <div class="App">
      <Switch>
        <Match when={session() === null}>
          <AuthSelection />
        </Match>
        <Match when={session() !== null && game() === null && authState() === AuthType.ANON}>
          <p>You are logged in anonymously. Join a room below!</p>
          <JoinGame chooseGame={chooseGame} />
        </Match>
        <Match when={session() !== null && game() === null && authState() === AuthType.EMAIL}>
          <p>Logged in as {session()?.user.email}</p>
          <GameSelection chooseGame={chooseGame} />
          <h2>--- or ---</h2>
          <JoinGame chooseGame={chooseGame} />
        </Match>
        <Match when={session() !== null && game() !== null}>
          <RenderGame game={game()!} />
        </Match>
      </Switch>
    </div>
	)
}

export default App
