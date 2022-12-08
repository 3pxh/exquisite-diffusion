import { Component, createEffect, createSignal, Switch, Match } from 'solid-js'
import { supabase } from './supabaseClient'
import { AuthSession } from '@supabase/supabase-js'
import Auth from './Auth'

enum GameRole {
  Host,
  Client
}

enum GameState {
  Pregame,
  Login, // For hosts only
  JoinRoom, // For clients only
  Lobby,
  Introduction,
  CreatingImages,
  CaptioningImages,
  Scoring
}

const App: Component = () => {
	const [session, setSession] = createSignal<AuthSession | null>(null)
  const [gameState, setGameState] = createSignal<GameState>(GameState.Pregame)
  const [gameRole, setGameRole] = createSignal<GameRole | null>(null)
  const [roomShortcode, setRoomShortcode] = createSignal<string | null>(null)
  const [roomId, setRoomId] = createSignal<number | null>(null)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [nPlayers, setNPlayers] = createSignal<number>(0)

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
    console.log("messaging room", roomId())
    let { data, error, status } = await supabase.from('messages').insert({
      room: roomId(),
      data: msg
    });
  }

  const makeShortcode = () => {
    let shortcode = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var charactersLength = chars.length;
    for ( var i = 0; i < 4; i++ ) {
      shortcode += chars.charAt(Math.floor(Math.random() * chars.length));
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
        console.log("Payload!", payload);
        if (payload.new.data.type === "NewPlayer") {
          setNPlayers(nPlayers() + 1)
        }
      }).subscribe();
    console.log("subscribed to room", id);
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
      messageRoom({type: "NewPlayer"});
    }
  }

  const stateChangeLobby = (shortcode: string, id: number) => {
    setRoomShortcode(shortcode);
    setRoomId(id)
    setGameState(GameState.Lobby);
    subscribeToRoom(id);
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
          {gameRole() === GameRole.Host 
            ? <>{nPlayers()} in lobby, to join: {roomShortcode()}</> 
            : "Waiting for other players"}
        </Match>
      </Switch>
      
			
		</div>
	)
}

export default App
