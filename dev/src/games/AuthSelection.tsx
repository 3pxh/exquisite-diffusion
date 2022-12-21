import { Component, createEffect, createSignal, Switch, Match } from 'solid-js'
import { AuthSession } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

import Host from './NeoXPromptGuess/Host'
import JoinGame from './JoinGame'

enum AuthType {
  ANON,
  EMAIL
}

// TODO: auto-anon when on mobile?
const AuthSelection: Component = () => {
	const [session, setSession] = createSignal<AuthSession | null>(null);
  const [email, setEmail] = createSignal<string>("");
  const [authState, setAuthState] = createSignal<AuthType | null>(null);

  const updateSession = (s: AuthSession | null) => {
    if (s !== null && session()?.user.id !== s?.user.id) {
      setSession(s);
      if (s?.user.email?.includes("anon.3pxh.com")) {
        setAuthState(AuthType.ANON);
      } else {
        setAuthState(AuthType.EMAIL);
      }
    }
  }

  createEffect(async () => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			updateSession(session);
		})

		supabase.auth.onAuthStateChange((_event, session) => {
      updateSession(session);
		})
	})

  const authenticate = async (t: AuthType) => {
    if (t === AuthType.ANON) {
      setAuthState(AuthType.ANON);
      const user = {
        email: `${crypto.randomUUID()}@anon.3pxh.com`, 
        password: crypto.randomUUID()
      }
      const { data, error } = await supabase.auth.signUp(user);
      setSession(data.session)
      if (error) {
        throw error
      }
    } else if (t === AuthType.EMAIL) {
      const { error } = await supabase.auth.signInWithOtp({ email: email() })
			if (error) throw error
      setAuthState(AuthType.EMAIL);
    }
  }

	return (
		<div class="AuthSelection">
      <Switch>
        <Match when={session() === null && authState() === null}>
          <h2>Exquisite Diffusion</h2>
          <div class="AuthSelection-AuthType">
            <input 
              id="userEmail" 
              placeholder="frodo@baggins.com"
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <button onclick={() => authenticate(AuthType.EMAIL)}>Sign in with email</button>
            <p>Needed to host a game, also to save and view your previous games</p>
          </div>
          <div class="AuthSelection-AuthType">
            <button onclick={() => authenticate(AuthType.ANON)}>Sign in anonymously</button>
            <p>Quick way to join games, history not saved</p>
          </div>
        </Match>
        <Match when={session() === null && authState() === AuthType.EMAIL}>
          <p>An email was sent to {email()} with a login link</p>
        </Match>
        <Match when={session() !== null && authState() === AuthType.EMAIL}>
          {/* CREATE OR JOIN */}
          <p>Room creating</p>
          {/* TODO: options for choosing a game to create a room + join a room widget */}
          <Host />
        </Match>
        <Match when={session() === null && authState() === AuthType.ANON}>
          <p>Signing in anonymously...</p>
        </Match>
        <Match when={session() !== null && authState() === AuthType.ANON}>
          {/* ROOM JOIN on Anon auth */}
          <p>You are logged in anonymously. Join a room below!</p>
          <JoinGame session={session()} />
        </Match>
      </Switch>
		</div>
	)
}

export default AuthSelection
