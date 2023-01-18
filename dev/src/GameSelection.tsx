import { Component, createSignal, For } from 'solid-js'
import { supabase } from './supabaseClient'

import { GameType } from './GameTypes'
import { useAuth } from './AuthProvider';

const GameSelection: Component<{chooseGame: (g: GameType, roomId: number, shortcode: string, isHost: boolean) => void}> = (props) => {
  const { session, setPlayerHandle } = useAuth();
  const [isCreatingRoom, setIsCreatingRoom] = createSignal<boolean>(false);
  const [gameType, setGameType] = createSignal<GameType>(GameType.PG);
  const [hostName, setHostName] = createSignal<string>('');

  const setNameAndChoose = async () => {
    if (hostName() !== '') {
      setPlayerHandle(hostName());
    }
    // TODO: host is not a player if they don't choose a name.
    // Perhaps the games should interpret this based on useAuth()'s playerHandle()
    createRoom(gameType());
  }

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
      // Somehow this gives infinite recursion on the RLS "Users can see other participants in their rooms"
      // let { error } = await supabase.from('participants').insert({
      //   user: session()?.user.id,
      //   room: data.id,
      // });
      // Despite the host having permission to create such a record.
      // Instead, we will invoke joinroom which has access to write the record.
      const { error } = await supabase.functions.invoke("joinroom", {
        body: JSON.stringify({
          shortcode: shortcode,
          userId: session()?.user.id
        })
      });
      props.chooseGame(game, data.id, shortcode, true)
    }
  }

  const games = [
    {type: GameType.NeoXPromptGuess, title: "False Starts", description: "How to begin the story?"},
    {type: GameType.SDPromptGuess, title: "Farsketched", description: "Imaaaagination!!"},
    {type: GameType.Gisticle, title: "Gisticle", description: "Listicles, the game."},
    {type: GameType.Hadron64, title: "Hadron 64", description: "Race to match patterns"},
    {type: GameType.PG, title: "PG", description: "Testing new engine"},
    {type: GameType.PGImage, title: "New Image Engine", description: "Test test"}
  ]

	return (
		<div class="GameSelection">
      {isCreatingRoom() ? 
      "Creating room..." :
      <>
      <h2>Create a game:</h2>
      <For each={games}>{(g) => {
        return (<>
        <button onclick={() => {setGameType(g.type)}} style={g.type === gameType() ? "border: 1px solid #0F0;" : ""}>
          <h3>{g.title}</h3>
          <p>{g.description}</p>
        </button>
        </>)
      }}</For>
      <div>
        <input placeholder='host_name' onchange={(e) => { setHostName(e.currentTarget.value) }} />
        <button onclick={() => {setNameAndChoose()}}>
          <h2>Start Game</h2>
        </button>
      </div>
      </>}
		</div>
	)
}

export default GameSelection