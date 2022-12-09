import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from './supabaseClient'
import { AuthSession } from '@supabase/supabase-js'
import Auth from './Auth'

enum GameRole {
  Host,
  Client
}

// TODO: split game states into host and client states?
// Serve two different pages. Obvi.
enum GameState {
  Pregame,
  Login, // For hosts only
  JoinRoom, // For clients only
  Lobby,
  Introduction,
  CreatingImages, // Client
  AwaitingImages, // Host
  DoneCreating,
  CaptioningImages,
  Scoring
}

interface ImageData {
  handle: string,
  url: string
}

const App: Component = () => {
	const [session, setSession] = createSignal<AuthSession | null>(null)
  const [playerHandle, setPlayerHandle] = createSignal<string>(crypto.randomUUID())
  const [gameState, setGameState] = createSignal<GameState>(GameState.Pregame)
  const [gameRole, setGameRole] = createSignal<GameRole | null>(null)
  const [roomShortcode, setRoomShortcode] = createSignal<string | null>(null)
  const [roomId, setRoomId] = createSignal<number | null>(null)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [players, setPlayers] = createSignal<string[]>([])
  const [images, setImages] = createSignal<ImageData[]>([])
  const [drawPrompt, setDrawPrompt] = createSignal<string | null>(null)

	createEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session)
		})

		supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session)
		})
	})

  const messageRoom = async (msg: any) => {
    // TODO: Guarantee that we have a room id, do error handling/reporting
    let { data, error, status } = await supabase.from('messages').insert({
      room: roomId(),
      data: {...msg, role: gameRole(), handle: playerHandle()}
    });
  }

  const makeShortcode = () => {
    let shortcode = '';
    for ( var i = 0; i < 4; i++ ) {
      shortcode += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
    }
    return shortcode;
  }

  const createRoom = async () => {
    const shortcode = makeShortcode();
    let { data, error, status } = await supabase.from('rooms').insert({
      shortcode: shortcode,
      host_state: GameState[GameState.Lobby] // Convert to string in case the enum changes
    }).select().single();
    console.log("created room", data)
    if (data === null || error !== null) {
      setErrorMessage(`Could not create room, status code ${status}. Check console for errors.`);
      console.log(error);
    } else {
      stateChangeLobby(shortcode, data.id);
    }
  }

  const chooseRole = async (role: GameRole) => {
    // TODO: disable the create a room button so they don't click it twice while DB goes
    setGameRole(role);
    if (role == GameRole.Host) {
      if (session()) {
        createRoom();
      } else {
        setGameState(GameState.Login);
      }
    } else if (role === GameRole.Client) {
      setGameState(GameState.JoinRoom)
    }
  }

  const subscribeToRoom = (id: number) => {
    supabase
      .channel(`public:messages:room=eq.${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${id}` 
      }, payload => {
        console.log("got payload", payload)
        const msg = payload.new.data;
        const hostingLobby = gameRole() === GameRole.Host && gameState() === GameState.Lobby;
        if (msg.type === "NewPlayer" && hostingLobby) {
          setPlayers(players().concat([msg.handle]));
        } else if (msg.type === "StartGame") {
          setGameState(GameState.Introduction);
          if (gameRole() === GameRole.Host) {
            window.setTimeout(() => {
              setGameState(GameState.AwaitingImages);
              messageRoom({
                type: "Prompts",
                prompts: players().map(p => {
                  return {
                    handle: p, 
                    prompt: crypto.randomUUID()
                  }
                })
              });
            }, 2000);
            // We hope all players receive the message in time?
            // Perhaps host broadcasting the game state each step would help if someone drops
          }
        } else if (msg.type === "Prompts" && gameRole() === GameRole.Client) {
          setGameState(GameState.CreatingImages);
          const myPrompt = msg.prompts.find(pr => pr.handle === playerHandle());
          setDrawPrompt(myPrompt.prompt);
        } else if (msg.type === "GeneratedImage" && gameRole() === GameRole.Host) {
          setImages(images().concat(msg));
        }
      }).subscribe();
  }

  const joinRoom = async () => {
    const shortcode = document.getElementById("shortcode")?.value.toUpperCase();
    let { data, error, status } = await supabase
				.from('rooms')
				.select(`*`)
				.eq('shortcode', shortcode)
				.single();
    // TODO: sort by date and get the most recent room in case of collisions
    const id = data?.id;
    if (data === null || error !== null) {
      setErrorMessage(`Could not join room, status code ${status}. Check console for errors.`);
      console.log(error);
    } else {
      stateChangeLobby(shortcode, id);
      messageRoom({type: "NewPlayer", data: {handle: playerHandle()}});
    }
  }

  const stateChangeLobby = (shortcode: string, id: number) => {
    setRoomShortcode(shortcode);
    setRoomId(id)
    setGameState(GameState.Lobby);
    subscribeToRoom(id);
  }

  const startGame = () => {
    // Sent by the client.
    messageRoom({
      type: "StartGame"
    });
  }

  const diffuse = async () => {
    // Perhaps we want to let the edge function send this message.
    // That way it'll only happen once the image is done.
    // messageRoom({
    //   type: "ImageGenerated"
    // })
    console.log("sending prompt", document.getElementById("diffusionPrompt")?.value)
    const { data, error } = await supabase.functions.invoke("diffuse", {
      body: JSON.stringify({
        room: roomId(),
        handle: playerHandle(),
        hiddenPrompt: drawPrompt(),
        prompt: document.getElementById("diffusionPrompt")?.value
      })
    })
    console.log("Finished invocation:", data, error)
    setGameState(GameState.DoneCreating);
    
  }

	return (
		<div class="container" style={{ padding: '50px 0 100px 0' }}>
      <Switch fallback={<p>Invalid game state.</p>}>
        <Match when={gameState() === GameState.Pregame}>
          <button onclick={() => chooseRole(GameRole.Host)}>Create New Game</button>
          <button onclick={() => chooseRole(GameRole.Client)}>Join A Game</button>
        </Match>
        <Match when={gameState() === GameState.Login}>
          {!session() 
            ? <Auth /> 
            : <><button onclick={() => createRoom()}>Create New Game</button>{errorMessage()}</>}
        </Match>
        <Match when={gameState() === GameState.JoinRoom}>
          Enter room code: <input style="text-transform:uppercase;" value="" id="shortcode" placeholder="Room Code"></input>
          <button onclick={() => joinRoom()}>Join room</button>
          {errorMessage()}
        </Match>
        <Match when={gameState() === GameState.Lobby}>
          <Show when={gameRole() === GameRole.Host} >
            <h2>Room code: {roomShortcode()}</h2>
            {players().length} in lobby
          </Show>
          <Show when={gameRole() === GameRole.Client} >
            Welcome to the lobby. When all players are in, hit the button!
            <button onclick={() => startGame()}>Let's gooooooooooooo</button>
          </Show>
        </Match>
        <Match when={gameState() === GameState.Introduction}>
          Generating prompts...
        </Match>
        <Match when={gameState() === GameState.AwaitingImages}>
          <For each={images()}>{(img, i) =>
              <img src={img.url} alt={img.handle}></img>
          }</For>
        </Match>
        <Match when={gameState() === GameState.CreatingImages}>
          {drawPrompt()}
          <textarea id="diffusionPrompt" placeholder="Describe an image of your prompt..."></textarea>
          <button onclick={() => diffuse()}>Generate!</button>
        </Match>
        <Match when={gameState() === GameState.DoneCreating}>
          Waiting for other players to finish up...
        </Match>
      </Switch>
      
			
		</div>
	)
}

export default App
