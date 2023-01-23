import { Component, createEffect, createSignal, For, Show } from 'solid-js'
import { supabase } from './supabaseClient'

import { GameType } from './GameTypes'
import { useAuth } from './AuthProvider';
import JoinGame from './JoinGame'

const GAMES = [
  {type: GameType.PGImage, title: "Farsketched", description: "The original AI prompt guessing game!", imageFolder: "far-sketched-landscapes"},
  {type: GameType.PGGisticle, title: "Gisticle", description: "The best way to write listicles.", imageFolder: "gisticle-g"},
  {type: GameType.Tresmojis, title: "Tresmojis", description: "What made the emojis?"},
  {type: GameType.PG, title: "Past is Prologue", description: "Begin a story and see where it goes."},
  {type: GameType.Hadron64, title: "Hadron 64", description: "Race to match patterns!"},
  {type: null, title: "Join a game", description: ""},

  {type: GameType.SDPromptGuess, title: "Farsketched V0", description: "Imaaaagination!!"},
  {type: GameType.Gisticle, title: "Gisticle V0", description: "Listicles, the game."},
  {type: GameType.NeoXPromptGuess, title: "False Starts V0", description: "How to begin the story?"},
]

const gameUrls: { [key: number]: string[] } = {};
GAMES.forEach(g => {
  if (g.imageFolder) {
    supabase
      .storage
      .from('game-album-art')
      .list(g?.imageFolder, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      }).then(({ data, error }) => {
        gameUrls[g.type] = data?.slice(1).map(d => d.name) ?? [];
      })
  }
});

type GameInfo = {type: GameType | null, title: string, description: string, imageFolder?: string};

const GameDetails: Component<{game: GameType}> = (props) => {
  const [image, setImage] = createSignal<string | null>(null);
  const [game, setGame] = createSignal<GameInfo | null>(null);
  
  const chooseOne = <T,>(A: T[]): T => {
    return A[Math.floor(Math.random() * A.length)];
  }

  createEffect(() => {
    setGame(GAMES.find(g => g.type === props.game)!)
    if (gameUrls[game()?.type!]) {
      const BUCKET = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/game-album-art/${game()?.imageFolder}`
      setImage(`${BUCKET}/${chooseOne((gameUrls[game()?.type!]))}`);
    } else {
      setImage(null);
    }
  })
  
  return (<>
    <div class="GameSelection-Details-Title">
      {game()?.title}
    </div>
    <div class="GameSelection-Details-Description">
      {game()?.description}
    </div>
      <img width="400" src={image() ?? ''} />
  </>)
} 

const GameSelection: Component<{chooseGame: (g: GameType, roomId: number, shortcode: string, isHost?: boolean) => void}> = (props) => {
  const { session, setPlayerHandle } = useAuth();
  const [isCreatingRoom, setIsCreatingRoom] = createSignal<boolean>(false);
  const [gameType, setGameType] = createSignal<GameType | null>(GameType.PGImage);
  const [hostName, setHostName] = createSignal<string>('');

  const setNameAndChoose = async () => {
    if (hostName() !== '') {
      setPlayerHandle(hostName());
    }
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

	return (
		<div class="GameSelection">
      {isCreatingRoom() ? 
      "Creating room..." :
      <>
      <div class="GameSelection-Left">
        <h1>Choose a game</h1>
        <For each={GAMES}>{(g) => {
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
        <div class="GameSelection-LeftFooter">
          Join us in making the fun!
          <ul>
            <li><a href="https://discord.gg/XwfUZTjS2p" target="_blank">Join the Discord</a></li>
            <li><a href="https://forms.gle/71FD149ktFhyYKT1A" target="_blank">Send feedback</a></li>
            <li>Contact: g@3pxh.com</li>
          </ul>
        </div>
      </div>
      <div class="GameSelection-Right">
        <Show when={gameType() === null}>
          <JoinGame chooseGame={props.chooseGame} />
        </Show>
        <Show when={gameType() !== null}>
          <GameDetails game={gameType()!} />
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