import { Component, createSignal, For, Show } from 'solid-js'
import { supabase } from './supabaseClient'

import { GameType } from './GameTypes'
import { useAuth } from './AuthProvider';
import JoinGame from './JoinGame'

const GameSelection: Component<{chooseGame: (g: GameType, roomId: number, shortcode: string, isHost?: boolean) => void}> = (props) => {
  const { session, setPlayerHandle } = useAuth();
  const [isCreatingRoom, setIsCreatingRoom] = createSignal<boolean>(false);
  const [gameType, setGameType] = createSignal<GameType | null>(GameType.PG);
  const [hostName, setHostName] = createSignal<string>('');

  const setNameAndChoose = async () => {
    if (hostName() !== '') {
      setPlayerHandle(hostName());
    }
    // TODO: host is not a player if they don't choose a name.
    // Perhaps the games should interpret this based on useAuth()'s playerHandle()
    const g = gameType();
    if (g) {
      createRoom(g);
    }
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
    {type: GameType.PGImage, title: "Farsketched", description: "The original AI prompt guessing game!"},
    {type: GameType.PGGisticle, title: "Gisticle", description: "The best way to write listicles."},
    {type: GameType.PG, title: "What's Past is Prologue", description: "Begin a story and see where it goes."},
    {type: GameType.Hadron64, title: "Hadron 64", description: "Race to match patterns!"},
    {type: null, title: "Join a game", description: ""},

    {type: GameType.SDPromptGuess, title: "Farsketched V0", description: "Imaaaagination!!"},
    {type: GameType.Gisticle, title: "Gisticle V0", description: "Listicles, the game."},
    {type: GameType.NeoXPromptGuess, title: "False Starts V0", description: "How to begin the story?"},
  ]

	return (
		<div class="GameSelection">
      {isCreatingRoom() ? 
      "Creating room..." :
      <>
      <div class="GameSelection-Left">
      <h1>Choose a game:</h1>
      <For each={games}>{(g) => {
        return (<>
        <div classList={{
          "GameSelection-GameTitle": true,
          "GameSelection--Selected": g.type === gameType(),
          "GameSelection-JoinOption": g.type === null,
        }} onmouseenter={() => {setGameType(g.type)}}>
          {g.title}
        </div>
        </>)
      }}</For>
      </div>
      <div class="GameSelection-Right">
        <Show when={gameType() === null}>
          <JoinGame chooseGame={props.chooseGame} />
        </Show>
        <Show when={gameType() !== null}>
          <div class="GameSelection-Details-Title">
            {games.find(g => g.type === gameType())!.title}
          </div>
          <div class="GameSelection-Details-Description">
            {games.find(g => g.type === gameType())!.description}
          </div>
          <div class="GameSelection-Start">
            <input placeholder='host_name' onchange={(e) => { setHostName(e.currentTarget.value) }} />
            <button onclick={() => {setNameAndChoose()}}>
              Start Game
            </button>
          </div>
        </Show>
      </div>
      </>}
		</div>
	)
}

export default GameSelection