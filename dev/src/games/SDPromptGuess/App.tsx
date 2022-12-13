import { Component, createSignal, Switch, Match } from 'solid-js'
import Host from './Host'
import Client from './Client'

enum GameRole {
  Host,
  Client
}



const App: Component = () => {
	const [role, setRole] = createSignal<GameRole | null>(null)

	return (
		<div class="container">
      <Switch>
        <Match when={role() === null}>
          <button onclick={() => {setRole(GameRole.Host)}}>Create New Game</button>
          <button onclick={() => {setRole(GameRole.Client)}}>Join A Game</button>
        </Match>
        <Match when={role() === GameRole.Host}>
          <Host />
        </Match>
        <Match when={role() === GameRole.Client}>
          <Client />
        </Match>
      </Switch>
		</div>
	)
}

export default App
