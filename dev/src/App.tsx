import { Component, Switch, Match } from 'solid-js'
import { useAuth, AuthType } from "./AuthProvider";
import AuthSelection from './AuthSelection'

import Host from './games/NeoXPromptGuess/Host'
import JoinGame from './JoinGame'


const App: Component = () => {
  const { session, authState } = useAuth();

	return (
    <div class="App">
      <Switch>
        <Match when={session() === null}>
          <AuthSelection />
        </Match>
        <Match when={session() !== null && authState() === AuthType.ANON}>
          {/* ROOM JOIN on Anon auth */}
          <p>You are logged in anonymously. Join a room below!</p>
          <JoinGame session={session()} />
        </Match>
        <Match when={session() !== null && authState() === AuthType.EMAIL}>
          {/* CREATE OR JOIN */}
          <p>Room creating</p>
          {/* TODO: options for choosing a game to create a room + join a room widget */}
          <Host />
        </Match>
      </Switch>
    </div>
	)
}

export default App
