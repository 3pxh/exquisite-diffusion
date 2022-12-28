import { Component, createSignal } from 'solid-js'
import { supabase } from './supabaseClient'

import { GameType } from './GameTypes'
import { useAuth } from './AuthProvider';


const GameSelection: Component<{chooseGame: (g: GameType, roomId: number, shortcode: string, isHost: boolean) => void}> = (props) => {
  const { session } = useAuth();
  const [isCreatingRoom, setIsCreatingRoom] = createSignal<boolean>(false)

  const createRoom = async (game: GameType) => {
    setIsCreatingRoom(true);
    let shortcode = '';
    for ( var i = 0; i < 4; i++ ) {
      shortcode += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
    }
    let { data, error, status } = await supabase.from('rooms').insert({
      shortcode: shortcode,
      owner: session()?.user.id,
      game: GameType[game],
      host_state: "Lobby"
    }).select().single();
    if (data === null || error !== null) {
      setIsCreatingRoom(false)
      console.log(`Could not create room, status code ${status}. Check console for errors.`, error);
    } else {
      await supabase.from('participants').insert({
        user: session()?.user.id,
        room: data.id,
      });
      props.chooseGame(game, data.id, shortcode, true)
    }
  }

	return (
		<div class="GameSelection">
      {isCreatingRoom() ? 
      "Creating room..." :
      <>
      <h2>Create a game:</h2>
      <button onclick={() => {createRoom(GameType.NeoXPromptGuess)}}>
        <h3>Text Generation</h3>
        <p>Players seed a text generator, and try to fake out others based on the output texts.</p>
      </button>
      <button onclick={() => {createRoom(GameType.SDPromptGuess)}}>
        <h3>Image Generation</h3>
        <p>Players seed an image generator, and try to fake out others based on the output images.</p>
      </button>
      </>}
		</div>
	)
}

export default GameSelection