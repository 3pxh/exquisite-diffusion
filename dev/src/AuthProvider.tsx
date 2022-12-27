import { createEffect, createSignal, createContext, useContext } from "solid-js";
import { AuthSession } from '@supabase/supabase-js'
import type { JSX, Accessor, Setter } from 'solid-js';
import { supabase } from './supabaseClient'

const AuthContext = createContext<{
  session: Accessor<AuthSession | null>,
  authState: Accessor<AuthType | null>,
  login: (t: string | null) => void,
  playerHandle: Accessor<string>,
  setPlayerHandle: Setter<string>,
}>();

export enum AuthType {
  ANON,
  EMAIL
}

export function AuthProvider(props: {children?: JSX.Element, session: AuthSession | null }) {
  const [session, setSession] = createSignal<AuthSession | null>(props.session);
  const [authState, setAuthState] = createSignal<AuthType | null>(null);
  const [playerHandle, setPlayerHandle] = createSignal<string>("host");

  const login = async (email: string | null) => {
    if (email === null) {
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
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email: email })
			if (error) throw error
      setAuthState(AuthType.EMAIL);
    }
  }

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

  const auth = {
    session: session,
    authState: authState,
    login: login,
    setPlayerHandle: setPlayerHandle,
    playerHandle: playerHandle,
  };

  return (
    <AuthContext.Provider value={auth}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext)!; }