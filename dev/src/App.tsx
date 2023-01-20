import { Component, createSignal, Switch, Match } from 'solid-js'
import { useAuth, AuthType } from "./AuthProvider";
import AuthSelection from './AuthSelection'

import Chatroom from './Chatroom';

import PromptGuesser from './games/PromptGuesser'
import Hadron64 from './games/Hadron64';
import { PromptGuessGameEngine, PGImageEngine, PGGisticleEngine } from './games/engines/PromptGuessBase'
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
                   props.room.game === GameType.PGGisticle}>
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
    if (g === GameType.PG || g === GameType.PGImage || g === GameType.PGGisticle) {
      const engines = {
        [GameType.PG]: PromptGuessGameEngine,
        [GameType.PGImage]: PGImageEngine,
        [GameType.PGGisticle]: PGGisticleEngine,
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
          </div>
        </Match>

        <Match when={authState() === AuthType.EMAIL}>
          <div class="Header-User">
            <img src="/src/assets/favicon.png" height="32" style="margin-right:10px;" />
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
