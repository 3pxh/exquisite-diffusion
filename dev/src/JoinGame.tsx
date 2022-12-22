import { Component, createSignal, Switch, Match } from 'solid-js'
import { AuthSession } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

enum JoinState {
  ENTERING_CODE,
  JOINING,
  JOINED
}

const JoinGame: Component<{session: AuthSession | null}> = (props) => {
  const [state, setState] = createSignal<JoinState>(JoinState.ENTERING_CODE);
  const [shortcode, setShortcode] = createSignal<string>("");
  const [error, setError] = createSignal<string>("");

  // TODO: pass in prop handler to call upon successful join?

  const joinRoom = async () => {
    setState(JoinState.JOINING);
    const { data, error } = await supabase.functions.invoke("joinroom", {
      body: JSON.stringify({
        shortcode: shortcode(),
        userId: props.session?.user.id
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
      const GAME_TYPE = data.game;
      // TODO: load the appropriate game, message the room that you've joined
      setState(JoinState.JOINED);
    }
  }

	return (
		<div class="JoinGame">
      <Switch>
        <Match when={state() === JoinState.ENTERING_CODE}>
          <div>Room code: <input 
            style="text-transform: uppercase;"
            placeholder="LMAO"
            maxlength="4"
            onChange={(e) => setShortcode(e.currentTarget.value)}
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
