import { Component, createSignal, Switch, Match } from 'solid-js'
import { supabase } from './supabaseClient'
import { useAuth } from "./AuthProvider";
import { GameType, GameTypeMap, GameTypeString } from './GameTypes'

enum JoinState {
  ENTERING_CODE,
  JOINING,
  JOINED
}

const JoinGame: Component<{chooseGame: (g: GameType, roomId?: number) => void}> = (props) => {
  const { session, setPlayerHandle } = useAuth();

  const [state, setState] = createSignal<JoinState>(JoinState.ENTERING_CODE);
  const [shortcode, setShortcode] = createSignal<string>("");
  const [name, setName] = createSignal<string>("");
  const [error, setError] = createSignal<string>("");

  // TODO: pass in prop handler to call upon successful join?

  const joinRoom = async () => {
    setPlayerHandle(name());
    setState(JoinState.JOINING);
    const { data, error } = await supabase.functions.invoke("joinroom", {
      body: JSON.stringify({
        shortcode: shortcode().toUpperCase(),
        userId: session()?.user.id
      })
    });
    const roomId = data?.roomId;
    if (error) {
      setError(error);
    } else if (data.roomId === null) {
      setError(`Room ${shortcode().toUpperCase()} not a Lobby, try again.`);
      setState(JoinState.ENTERING_CODE);
    } else {
      const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single()
      // TODO: set the player's name somewhere so when we send a NewPlayer message we pass it along.
      // We could store it on the AuthProvider..........
      props.chooseGame(GameTypeMap[data.game as GameTypeString], roomId);
      setState(JoinState.JOINED); // Redundant since choosing the game should stop showing this view.
    }
  }

	return (
		<div class="JoinGame">
      <Switch>
        <Match when={state() === JoinState.ENTERING_CODE}>
          <h2>Join a game</h2>
          <div>Room code: <input 
            style="text-transform: uppercase;"
            placeholder="LMAO"
            maxlength="4"
            onChange={(e) => setShortcode(e.currentTarget.value)}
          /></div>
          <div>Name: <input 
            placeholder="happy_ewok"
            onChange={(e) => setName(e.currentTarget.value)}
          /></div>
          <button onclick={() => joinRoom()}>Join game</button>
        </Match>
        <Match when={state() === JoinState.JOINING}>
          <p>Joining game...</p>
        </Match>
        <Match when={state() === JoinState.JOINED}>
          <p>You've joined the game.</p>
        </Match>
      </Switch>
      <p>{error()}</p>
		</div>
	)
}

export default JoinGame
