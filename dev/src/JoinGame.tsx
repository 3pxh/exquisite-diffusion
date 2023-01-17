import { Component, createSignal, Switch, Match } from 'solid-js'
import { supabase } from './supabaseClient'
import { useAuth } from "./AuthProvider";
import { GameType, GameTypeMap, GameTypeString } from './GameTypes'

enum JoinState {
  ENTERING_CODE,
  JOINING,
  JOINED
}

const JoinGame: Component<{chooseGame: (g: GameType, roomId: number, shortcode: string) => void}> = (props) => {
  const { session, setPlayerHandle } = useAuth();

  const [state, setState] = createSignal<JoinState>(JoinState.ENTERING_CODE);
  const [shortcode, setShortcode] = createSignal<string>("");
  const [name, setName] = createSignal<string>("");
  const [error, setError] = createSignal<string>("");

  const joinRoom = async () => {
    setPlayerHandle(name());
    setState(JoinState.JOINING);
    const { data, error } = await supabase.functions.invoke("joinroom", {
      body: JSON.stringify({
        shortcode: shortcode(),
        userId: session()?.user.id
      })
    });
    const roomId = data?.roomId;
    if (error) {
      setError(error);
    } else if (data.roomId === null) {
      // Try rejoining -- if they already joined and are authed (session!) they have read access
      const { data, error } = await supabase.from('rooms').select('*').eq('shortcode', shortcode()).single();
      if (!error && data.id !== null) {
        props.chooseGame(GameTypeMap[data.game as GameTypeString], data.id, shortcode());
      } else {
        setError(`Room ${shortcode()} not a Lobby, try again.`);
        setState(JoinState.ENTERING_CODE);  
      }
    } else {
      const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single()
      props.chooseGame(GameTypeMap[data.game as GameTypeString], roomId, shortcode());
      setState(JoinState.JOINED);
    }
  }

	return (
		<form class="JoinGame">
      <Switch>
        <Match when={state() === JoinState.ENTERING_CODE}>
          <h2 class="JoinGame-headline">
            Join or Re-join a game
          </h2>
          
          <div class="JoinGame-item">
            <label class="JoinGame-label" for="code">
              Room code
            </label>

            <input
              id="code"
              name="code"
              class="JoinGame-input -code"
              placeholder="LMAO"
              maxlength="4"
              onChange={(e) => setShortcode(e.currentTarget.value.toUpperCase())}
            />
          </div>

          <div class="JoinGame-item">
            <label class="JoinGame-label" for="name">
              Name
            </label>
            
            <input
              id="name"
              name="name"
              class="JoinGame-input"
              placeholder="happy_ewok"
              onChange={(e) => setName(e.currentTarget.value)}
            />
          </div>

          <button 
            class="JoinGame-button"
            onclick={() => joinRoom()}
          >
            Join Game
          </button>
        </Match>

        <Match when={state() === JoinState.JOINING}>
          <p>Joining game...</p>
        </Match>

        <Match when={state() === JoinState.JOINED}>
          <p>You've joined the game.</p>
        </Match>
      </Switch>

      <p class="JoinGame-error">
        {error()}
      </p>
		</form>
	)
}

export default JoinGame
