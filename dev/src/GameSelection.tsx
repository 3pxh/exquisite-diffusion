import { Component, createSignal, Switch, Match } from 'solid-js'
import App from './games/SDPromptGuess/App'
import NeoXPromptGuess from './games/NeoXPromptGuess/NeoXPromptGuess'

// TODO: detect mobile, and present join a room. After join, check the type
// and load the appropriate game.

enum GameType {
  NeoXPromptGuess,
  SDPromptGuess
}

const GameSelection: Component = () => {
	const [game, setGame] = createSignal<GameType | null>(null)

	return (
		<div class="container">
      <Switch>
        <Match when={game() === null}>
          <h2>Choose a game:</h2>
          <p>
            <button onclick={() => {setGame(GameType.NeoXPromptGuess)}}>Text Generation</button>
            -- Players seed a text generator, and try to fake out others based on the output texts.
          </p>
          <p>
            <button onclick={() => {setGame(GameType.SDPromptGuess)}}>Image Generation</button>
            -- Players seed an image generator, and try to fake out others based on the output images.
          </p>
        </Match>
        <Match when={game() === GameType.SDPromptGuess}>
          <App />
        </Match>
        <Match when={game() === GameType.NeoXPromptGuess}>
          <NeoXPromptGuess />
        </Match>
      </Switch>
		</div>
	)
}

export default GameSelection
