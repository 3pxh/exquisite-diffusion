import { Component, createSignal, Switch, Match } from 'solid-js'
import { ref, set } from "firebase/database";
import { db } from './Firebase';

import { useAuth, AuthType } from "./AuthProvider";
import AuthSelection from './AuthSelection'
import faviconUrl from './assets/favicon.png'

import Chatroom from './Chatroom';

import PromptGuesser from './games/PromptGuesser'
import Hadron64 from './games/Hadron64';
import { PromptGuessGameEngine, PGImageEngine, PGGisticleEngine, Tresmojis } from './games/engines/PromptGuessBase'
import PG from './games/PG'

import JoinGame from './JoinGame'
import GameSelection from './GameSelection'
import { GameType } from './GameTypes'


// TODO: merge this "Room" concept with the one in games/engines/EngineBase.ts
interface Room {
  roomId: number,
  game: GameType,
  shortcode: string,
  isHost: boolean,
}

const RenderGame: Component<{room: Room, userId: string, engine: PromptGuessGameEngine | null}> = (props) => {
  return (
    <Switch>
      <Match when={props.room.game === GameType.NeoXPromptGuess}>
        <PromptGuesser roomId={props.room.roomId} isHost={props.room.isHost} shortcode={props.room.shortcode} gameType={GameType.NeoXPromptGuess} />
      </Match>
      <Match when={props.room.game === GameType.SDPromptGuess}>
        <PromptGuesser roomId={props.room.roomId} isHost={props.room.isHost} shortcode={props.room.shortcode} gameType={GameType.SDPromptGuess} />
      </Match>
      <Match when={props.room.game === GameType.Hadron64}>
        <Hadron64 roomId={props.room.roomId} isHost={props.room.isHost} shortcode={props.room.shortcode} gameType={GameType.Hadron64} />
      </Match>
      <Match when={props.room.game === GameType.Gisticle}>
        <PromptGuesser roomId={props.room.roomId} isHost={props.room.isHost} shortcode={props.room.shortcode} gameType={GameType.Gisticle} />
      </Match>
      <Match when={props.room.game === GameType.PG || 
                   props.room.game === GameType.PGImage ||
                   props.room.game === GameType.PGGisticle ||
                   props.room.game === GameType.Tresmojis}>
        <PG roomId={props.room.roomId} isHost={props.room.isHost} userId={props.userId} shortcode={props.room.shortcode} 
            engine={props.engine!}/>
      </Match>
    </Switch>
  )
}

const App: Component = () => {
  const { session, authState } = useAuth();
  const [room, setRoom] = createSignal<Room | null>(null);
  const [engine, setEngine] = createSignal<PromptGuessGameEngine | null>(null);

  const chooseGame = (g: GameType, roomId: number, shortcode: string, isHost?: boolean) => {
    set(ref(db, 'hello/wurrrld/'), {
      original: "hoorah"
    });

    
    if (g === GameType.PG || g === GameType.PGImage || g === GameType.PGGisticle || g === GameType.Tresmojis) {
      const engines = {
        [GameType.PG]: PromptGuessGameEngine,
        [GameType.PGImage]: PGImageEngine,
        [GameType.PGGisticle]: PGGisticleEngine,
        [GameType.Tresmojis]: Tresmojis,
      }
      const ENGINE = engines[g];
      setEngine(new ENGINE({
        roomId: roomId,
        userId: session()?.user.id!,
        isHost: isHost ?? false,
        shortcode: shortcode,
      }));
    }
    setRoom({
      game: g,
      roomId: roomId,
      shortcode: shortcode,
      isHost: isHost ?? false,
    });
  }

	return (
    <div class="App">
      <Switch>
        <Match when={session() === null}>
          <AuthSelection />
        </Match>

        <Match when={room() !== null}>
          <Chatroom roomId={room()!.roomId} />
          <RenderGame room={room()!} userId={session()?.user.id!} engine={engine()} />
        </Match>

        <Match when={authState() === AuthType.ANON}>
          <div class="Auth _container">
            <header class="Auth-header">
              <p>You are logged in anonymously.</p>
              <p><strong>Join a room below!</strong></p>
            </header>
            <JoinGame chooseGame={chooseGame} />

            <h3>Join us in making the fun!</h3>
            <ul>
              <li><a href="https://discord.gg/XwfUZTjS2p" target="_blank">Join the Discord</a></li>
              <li><a href="https://forms.gle/71FD149ktFhyYKT1A" target="_blank">Send feedback</a></li>
              <li>Contact: g@3pxh.com</li>
            </ul>
          </div>
        </Match>

        <Match when={authState() === AuthType.EMAIL}>
          <div class="Header-User">
            <img src={faviconUrl} height="32" style="margin-right:10px;" />
            Three Pixel Heart | 
            Logged in as {session()?.user.email}
            {/* | (logout?) */}
          </div>
          <GameSelection chooseGame={chooseGame} />
        </Match>
      </Switch>
    </div>
	)
}

export default App
