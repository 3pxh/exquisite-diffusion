import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../../supabaseClient'
import { PlayerHandle, CaptionData, DiffusionImage } from './GameTypes'

enum GameState {
  JoinRoom,
  Lobby,
  Waiting,
  CreatingImages,
  CaptioningImages,
  VotingCaptions,
  Finished
}


const Client: Component = () => {
  const [playerHandle, setPlayerHandle] = createSignal<PlayerHandle | null>(null)
  const [gameState, setGameState] = createSignal<GameState>(GameState.JoinRoom)
  const [roomShortcode, setRoomShortcode] = createSignal<string | null>(null)
  const [roomId, setRoomId] = createSignal<number | null>(null)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [captions, setCaptions] = createSignal<CaptionData[]>([])
  const [captionImages, setCaptionImages] = createSignal<DiffusionImage[]>([])

  const messageRoom = async (msg: any) => {
    // TODO: Guarantee that we have a room id, do error handling/reporting
    let { data, error, status } = await supabase.from('messages').insert({
      room: roomId(),
      // TODO: Make this less possible to collide with callers of messageRoom
      //  - I accidentally used "player" at one point to pass a vote -_-
      data: {...msg, player: playerHandle()}
    });
  }

  const subscribeToRoom = (id: number) => {
    supabase
      .channel(`public:rooms:id=eq.${id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` 
      }, payload => {
        console.log("got payload", payload)
        const msg = payload.new.data;
        if (msg.type === "AwaitingImages") {
          setGameState(GameState.CreatingImages);
        } else if (msg.type === "AwaitingCaptions") {
          setCaptionImages([msg.image])
          setGameState(GameState.CaptioningImages);
        } else if (msg.type === "VotingCaptions") {
          setCaptions(msg.captions.filter((c:CaptionData) => c.player.uuid !== playerHandle()?.uuid))
          setGameState(GameState.VotingCaptions);
        }
      }).subscribe();
  }

  const joinRoom = async () => {
    setPlayerHandle({
      handle: (document.getElementById("handle") as HTMLInputElement).value,
      uuid: crypto.randomUUID()
    });
    const shortcode = (document.getElementById("shortcode") as HTMLInputElement).value.toUpperCase();
    setGameState(GameState.Lobby);
    let { data, error, status } = await supabase
				.from('rooms')
				.select(`*`)
				.eq('shortcode', shortcode)
				.single();
    // TODO: sort by date and get the most recent room in case of collisions
    const id = data?.id;
    if (data === null || error !== null) {
      setGameState(GameState.JoinRoom);
      setErrorMessage(`Could not join room, status code ${status}`);
    } else {
      setRoomShortcode(shortcode);
      setRoomId(id);
      subscribeToRoom(id);
      messageRoom({type: "NewPlayer"});
    }
  }

  const diffuse = async () => {
    // Must store this, because the element goes away on state change.
    const p = (document.getElementById("diffusionPrompt") as HTMLInputElement).value;
    setGameState(GameState.Waiting);
    const { data, error } = await supabase.functions.invoke("diffuse", {
      body: JSON.stringify({
        room: roomId(),
        player: playerHandle(),
        secretPrompt: "",
        prompt: p
      })
    })
    if (error) {
      setErrorMessage(`Error when diffusing: ${error}`);
    }
  }

  const caption = async () => {
    const c = (document.getElementById("imageCaption") as HTMLInputElement).value
    messageRoom({ type: "CaptionResponse", caption: c });
    setGameState(GameState.Waiting);
  }

  const vote = async (player: PlayerHandle) => {
    messageRoom({ type: "CaptionVote", vote: player });
    setGameState(GameState.Waiting);
  }

	return (
		<>
      <Switch fallback={<p>Invalid game state.</p>}>
        <Match when={gameState() === GameState.JoinRoom}>
          <h2>Join a game</h2>
          <input value="" id="handle" placeholder="Name"></input>
          <input style="text-transform:uppercase;" value="" id="shortcode" placeholder="Room Code"></input>
          <button onclick={() => joinRoom()}>Join room</button>
        </Match>
        <Match when={gameState() === GameState.Lobby}>
          <Show when={roomShortcode() !== null && roomId() !== null} 
            fallback="Joining room...">
            <h2>Welcome</h2>
            <p>Only press once everyone is in the room!</p>
            <button onclick={() => {messageRoom({type: "StartGame"});}}>All Players In!</button>
          </Show>
        </Match>
        <Match when={gameState() === GameState.CreatingImages}>
          <h2>Make something strange!</h2>
          <input id="diffusionPrompt" placeholder="Describe an image..."></input>
          <button onclick={() => diffuse()}>Generate!</button>
        </Match>
        
        <Match when={gameState() === GameState.CaptioningImages}>
          <Show when={captionImages()[0].player.uuid !== playerHandle()?.uuid}
                fallback={"You are responsible for this masterpiece. Well done."} >
            <p>Describe:</p>
            <input id="imageCaption" type="text" placeholder="image description"></input>
            <button onclick={() => caption()}>Oh yeah!</button>
          </Show>
        </Match>
        <Match when={gameState() === GameState.VotingCaptions}>
          <Show when={captionImages()[0].player.uuid !== playerHandle()?.uuid}
                fallback={"You are still responsible for this masterpiece. Nice."} >
            <h2>Which one is the truth?</h2>
            <For each={captions()}>{(c, i) =>
                <p><button onclick={() => vote(c.player)}>{c.caption}</button></p>
            }</For>
          </Show>
        </Match>
        <Match when={gameState() === GameState.Waiting}>
          Waiting for other players to finish up...
        </Match>
        <Match when={gameState() === GameState.Finished}>
          <h2>Restart?</h2>
          TODO: allow for a restart from client
        </Match>
      </Switch>
      <Show when={errorMessage() !== null}>
        Error! {errorMessage()}
      </Show>
		</>
	)
}

export default Client
