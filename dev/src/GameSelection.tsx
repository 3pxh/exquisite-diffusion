import { Component } from 'solid-js'
import { GameType } from './GameTypes'

const GameSelection: Component<{chooseGame: (g: GameType) => void}> = (props) => {
	return (
		<div class="GameSelection">
      <h2>Create a game:</h2>
      <button onclick={() => {props.chooseGame(GameType.NeoXPromptGuess)}}>
        <h3>Text Generation</h3>
        <p>Players seed a text generator, and try to fake out others based on the output texts.</p>
      </button>
      <button onclick={() => {props.chooseGame(GameType.SDPromptGuess)}}>
        <h3>Image Generation</h3>
        <p>Players seed an image generator, and try to fake out others based on the output images.</p>
      </button>
		</div>
	)
}

export default GameSelection