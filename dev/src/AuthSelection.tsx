import { Component, createEffect, createSignal, Switch, Match } from 'solid-js'

import { useAuth, AuthType } from "./AuthProvider";

// TODO: auto-anon when on mobile?
const AuthSelection: Component = () => {
  const { session, authState, login } = useAuth();

	return (
		<div class="AuthSelection">
      <Switch>
        <Match when={session() === null && authState() === null}>
          <h2>Exquisite Diffusion</h2>
          <div class="AuthSelection-AuthType">
            <input 
              id="userEmail" 
              placeholder="frodo@baggins.com"
            />
            <button onclick={() => {
              login((document.getElementById('userEmail') as HTMLInputElement).value)
              }}>Sign in with email</button>
            <p>Needed to host a game, also to save and view your previous games</p>
          </div>
          <div class="AuthSelection-AuthType">
            <button onclick={() => login(null)}>Sign in anonymously</button>
            <p>Quick way to join games, history not saved</p>
          </div>
        </Match>
        <Match when={session() === null && authState() === AuthType.EMAIL}>
          <p>An email was sent with a login link</p>
        </Match>
        <Match when={session() === null && authState() === AuthType.ANON}>
          <p>Signing in anonymously...</p>
        </Match>
      </Switch>
		</div>
	)
}

export default AuthSelection
