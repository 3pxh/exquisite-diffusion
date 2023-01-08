import { Component, createSignal, Switch, Match } from 'solid-js'
import { useAuth, AuthType } from "./AuthProvider";
import AuthSelection from './AuthSelection'

import Chatroom from './Chatroom';

import PromptGuesser from './games/PromptGuesser'
import Hadron64 from './games/Hadron64';

import JoinGame from './JoinGame'
import GameSelection from './GameSelection'
import { GameType } from './GameTypes'

interface Room {
  roomId: number,
  game: GameType,
  shortcode: string,
  isHost: boolean,
}

const RenderGame: Component<{room: Room}> = (props) => {
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
    </Switch>
  )
}

const App: Component = () => {
  const { session, authState } = useAuth();
  const [room, setRoom] = createSignal<Room | null>(null)
  const chooseGame = (g: GameType, roomId: number, shortcode: string, isHost?: boolean) => {
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
          <RenderGame room={room()!} />
          <Chatroom roomId={room()!.roomId} />
        </Match>
        <Match when={authState() === AuthType.ANON}>
          <p>You are logged in anonymously. Join a room below!</p>
          <JoinGame chooseGame={chooseGame} />
        </Match>
        <Match when={authState() === AuthType.EMAIL}>
          <p>Logged in as {session()?.user.email}</p>
          <GameSelection chooseGame={chooseGame} />
          <h2>--- or ---</h2>
          <JoinGame chooseGame={chooseGame} />
        </Match>
      </Switch>
    </div>
	)
}

export default App
