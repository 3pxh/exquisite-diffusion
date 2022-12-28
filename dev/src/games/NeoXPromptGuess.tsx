import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../supabaseClient'
import { useAuth } from "../AuthProvider";

import Chatroom from '../Chatroom';

import { GameTypeString } from '../GameTypes'

const GAME_NAME: GameTypeString = "NeoXPromptGuess";

const IS_DEBUG = false;
if (!IS_DEBUG) {
  console.log = () => {};
}

interface PlayerHandle {
  handle: string,
  uuid: string
}
interface TextCompletion {
  player: PlayerHandle,
  prompt: string,
  text: string
}
interface CaptionData {
  player: PlayerHandle,
  caption: string
}
interface Vote {
  vote: PlayerHandle,
  player: PlayerHandle
}

enum GameState {
  Lobby,
  WritingPrompts, 
  CreatingLies,
  Voting,
  Scoring,
  Finished,
  Waiting, // Players only
}


const NeoXPromptGuess: Component<{roomId?: number}> = (props) => {
  const { session, playerHandle, setPlayerHandle } = useAuth();

  const [isHost, setIsHost] = createSignal<boolean>(false)
  const [isHostPlayer, setIsHostPlayer] = createSignal<boolean>(false)
  const [gameState, setGameState] = createSignal<GameState>(GameState.Lobby)
  const [roomShortcode, setRoomShortcode] = createSignal<string | null>(null)
  const [roomId, setRoomId] = createSignal<number | null>(null)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [players, setPlayers] = createSignal<PlayerHandle[]>([])
  const [scores, setScores] = createSignal<Record<PlayerHandle["uuid"], number>>({})
  const [texts, setTexts] = createSignal<TextCompletion[]>([])
  const [captions, setCaptions] = createSignal<CaptionData[]>([])
  const [captionTexts, setCaptionTexts] = createSignal<TextCompletion[]>([])
  const [votes, setVotes] = createSignal<Vote[]>([])
  const [round, setRound] = createSignal<number>(1)

  const NUM_ROUNDS = 3;

  if (props.roomId !== undefined) {
    setRoomId(props.roomId);
  }

	createEffect(async () => {
    if (props.roomId === undefined) {
      setIsHost(true);
      createRoom();
    } else {
      clientMessage({
        type: "NewPlayer"
      })
      subscribeToRoom(props.roomId!);
    }
	})

  const clientMessage = async (msg: any) => {
    let { data, error, status } = await supabase.from('messages').insert({
      room: roomId(),
      user_id: session()?.user.id, // Needed for RLS
      // TODO: Make this less possible to collide with callers of clientMessage
      //  - I accidentally used "player" at one point to pass a vote -_-
      data: {...msg, player: {handle: playerHandle(), uuid: session()?.user.id}}
    });
  }

  const hostMessage = async (msg: any) => {
    // TODO: Guarantee that we have a room id, do error handling/reporting
    let { data, error, status } = await supabase.from('rooms').update({
      data: { ...msg, timestamp: (new Date()).getTime() },
      host_state: GameState[gameState()]
    }).eq('id', roomId()).select();
  }

  const createRoom = async () => {
    let shortcode = '';
    for ( var i = 0; i < 4; i++ ) {
      shortcode += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
    }
    let { data, error, status } = await supabase.from('rooms').insert({
      shortcode: shortcode,
      owner: session()?.user.id,
      game: GAME_NAME,
      host_state: GameState[GameState.Lobby] // Convert to string in case the enum changes
    }).select().single();
    if (data === null || error !== null) {
      setErrorMessage(`Could not create room, status code ${status}. Check console for errors.`);
      console.log(error);
    } else {
      await supabase.from('participants').insert({
        user: session()?.user.id,
        room: data.id,
      });
      setRoomShortcode(shortcode);
      setRoomId(data.id)
      console.log('joining', shortcode, data.id)
      setGameState(GameState.Lobby);
      subscribeToMessages(data.id);
    }
  }

  const shuffle = <T,>(A: T[]) => {
    return A.map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
  }

  let lastUpdateMessageTimestamp = 0;
  let lastUpdate = (new Date()).getTime();
  const handleClientUpdate = (msg: any) => {
    if (lastUpdateMessageTimestamp === msg.data.timestamp) {
      // This will happen from the setInterval getting entries from the db
      // We don't want to process the same state change multiple times,
      // lest it revert to a previous state.
      return;
    } else {
      lastUpdate = (new Date()).getTime();
      lastUpdateMessageTimestamp = msg.data.timestamp;
      if (msg.data.type === "WritingPrompts") {
        setPlayers(msg.data.players);
        setGameState(GameState.WritingPrompts);
      } else if (msg.data.type === "CreatingLies") {
        setCaptionTexts([msg.data.text])
        setGameState(GameState.CreatingLies);
      } else if (msg.data.type === "VotingCaptions") {
        setCaptions(msg.data.captions.filter((c:CaptionData) => c.player.uuid !== session()?.user.id))
        setGameState(GameState.Voting);
      } else if (msg.data.type === "Scoring") {
        setScores(msg.data.scores);
        setVotes(msg.data.votes);
        setGameState(GameState.Scoring);
      } else if (msg.data.type === "Finished") {
        // TODO: Get scores
        setGameState(GameState.Finished);
      }
    }
  }
  // CLIENTS subscribe to ROOM
  const subscribeToRoom = (roomId: number) => {
    supabase
    .channel(`public:rooms:id=eq.${roomId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
    }, payload => {
      console.log("got payload", payload);
      handleClientUpdate(payload.new)
    }).subscribe();
  }

  // This is in case their phone locks. For clients only.
  // window.setInterval(async () => {
  //   if (roomId() !== null && (new Date()).getTime() - lastUpdate > 20000) {
  //     let { data, error, status } = await supabase.from('rooms').select(`*`).eq('id', roomId()).single();
  //     // TODO: Any semblance of error handling.
  //     handleUpdate(data);
  //   }
  // }, 2000);

  const startGame = () => {
    const hostName = (document.getElementById("hostName") as HTMLInputElement).value;
    if (hostName.length > 0) {
      setIsHostPlayer(true);
      setPlayerHandle(hostName); // Gross.
      setPlayers(players().concat([{handle: hostName, uuid: session()!.user.id}]));
    }
    setGameState(GameState.WritingPrompts);
    const initScores:Record<PlayerHandle["uuid"], number> = {};
    players().forEach(p => { initScores[p.uuid] = 0; });
    setScores(initScores);
    hostMessage({
      type: "WritingPrompts",
      players: players(),
    });
  }

  // HOST subscribes to MESSAGES
  const subscribeToMessages = (id: number) => {
    supabase
      .channel(`public:messages:room=eq.${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${id}` 
      }, payload => {
        console.log("got payload", payload)
        const msg = payload.new.data;
        if (msg.type === "NewPlayer" && gameState() === GameState.Lobby) {
          setPlayers(players().concat([msg.player]));
        } else if (msg.type === "GeneratedText") {
          setTexts(texts().concat(msg));
          if (texts().length === players().length) {
            setCaptions([]);
            setCaptionTexts(JSON.parse(JSON.stringify(texts()))); // hacky deep copy
            setGameState(GameState.CreatingLies);
            hostMessage({
              type: "CreatingLies",
              text: captionTexts()[0]
            });
          }
        } else if (msg.type === "CaptionResponse") {
          setCaptions(captions().concat(msg));
          if (captions().length === players().length - 1) {
            setCaptions(shuffle(captions().concat([{
              player: captionTexts()[0].player,
              caption: captionTexts()[0].prompt
            }])));
            hostMessage({
              type: "VotingCaptions",
              captions: captions(),
            });
            setGameState(GameState.Voting);
          }
        } else if (msg.type === "CaptionVote") {
          setVotes(votes().concat(msg));
          if (votes().length === players().length - 1) {
            const newScores = scores();
            const drawingPlayer = captionTexts()[0].player.uuid;
            votes().forEach(v => {
              if (v.vote.uuid === drawingPlayer) { // truth
                newScores[v.player.uuid] += 1000;
                newScores[drawingPlayer] += 1000;
              } else { // lie
                newScores[v.vote.uuid] += 500;
              }
            })
            setScores(newScores);
            setGameState(GameState.Scoring);
            hostMessage({
              type: "Scoring",
              scores: newScores,
              votes: votes(),
            });
            setCaptionTexts(captionTexts().slice(1));
            if (captionTexts().length === 0) {
              if (round() < NUM_ROUNDS) {
                setRound(round() + 1);
                window.setTimeout(() => {
                  setGameState(GameState.WritingPrompts);
                  setTexts([]);
                  setVotes([]);
                  hostMessage({
                    type: "WritingPrompts",
                    players: players(),
                  });
                }, 10000)
              } else {
                setGameState(GameState.Finished);
                hostMessage({
                  type: "Finished",
                });
              }
            } else {
              window.setTimeout(() => {
                setCaptions([]);
                setVotes([]);
                setGameState(GameState.CreatingLies);
                hostMessage({
                  type: "CreatingLies",
                  text: captionTexts()[0]
                });
              }, 15000)
            }
          }
        }
      }).subscribe();
  }
  
  const generateText = async () => {
    // Must store this, because the element goes away on state change.
    const p = (document.getElementById("GPTPrompt") as HTMLInputElement).value;
    setGameState(GameState.Waiting);
    const { data, error } = await supabase.functions.invoke("textsynth", {
      body: JSON.stringify({
        room: roomId(),
        player: {handle: playerHandle(), uuid: session()?.user.id },
        prompt: p
      })
    });
    if (error) {
      setErrorMessage(`Error when runnng textsynth: ${error}`);
    }
  }

  const caption = async () => {
    const c = (document.getElementById("GPTPrefaceLie") as HTMLInputElement).value
    clientMessage({ type: "CaptionResponse", caption: c });
    setGameState(GameState.Waiting);
  }

  const vote = async (player: PlayerHandle) => {
    clientMessage({ type: "CaptionVote", vote: player });
    setGameState(GameState.Waiting);
  }

	return (
    <>
      <Switch fallback={<p>Invalid host state: {gameState()}</p>}>
        <Match when={gameState() === GameState.Lobby && roomId() === null}>
          <h2>Initializing room...</h2>
        </Match>
        <Match when={gameState() === GameState.Lobby && roomId() !== null}>
          <h2>To join go to 3pxh.com, join with room code: {roomShortcode()}</h2>
          {players().length} in lobby:
          <ul>
            <For each={players()}>{(p, i) =>
              <li>{p?.handle ?? "Anonymous"}</li>
            }</For>
          </ul>

          <Show when={isHost()}>
            <div>Your name: <input id="hostName" placeholder="jubjub"></input></div>
            <div>(leave blank if host is not a player)</div>
            <button onclick={startGame}><h2>Everybody is here, let's start!</h2></button>
          </Show>

          <h2>Instructions:</h2>
          <ol>
            <li>Host creates a game, gets a room code</li>
            <li>Players join the room with the code</li>
            <li>Players generate text continuations based on a seed text</li>
            <li>Continuations are shown one at a time,
              <ol>
                <li>All players (other than the one who made the text) give an alternate seed</li>
                <li>Players see all seeds (including the true one), and try to guess the true one</li>
                <li>Players get points for A) guessing the true seed, and B) other players guessing their seed</li>
              </ol>
            </li>
            <li>After several rounds, the game ends</li>
          </ol>

          <h2>Notes:</h2>
          <ul>
            <li>Please send feedback to geÖrge Ät hÖqqanen dÖt cÖm</li>
          </ul>
        </Match>
        <Match when={gameState() === GameState.WritingPrompts}>
          <h2>Round {round()} of {NUM_ROUNDS}, dispatching prompts...</h2>
          <h3>Text generation may take a few seconds</h3>
          Beep boop beep
          <Show when={!isHost() || isHostPlayer()}>
            <h2>Make something strange!</h2>
            <input id="GPTPrompt" placeholder="Once upon a time"></input>
            <button onclick={() => generateText()}>Generate!</button>
          </Show>
        </Match>
        <Match when={gameState() === GameState.CreatingLies}>
          <h2>Round {round()} of {NUM_ROUNDS}, what generated:</h2>
          <h3 style="white-space: pre-wrap;">{captionTexts()[0].text}</h3>
          <Show when={!isHost() || isHostPlayer()}>
            <Show when={captionTexts()[0].player.uuid !== session()?.user.id}
                  fallback={"You are responsible for this masterpiece. Well done."} >
              <p>What came before these words?</p>
              <input id="GPTPrefaceLie" type="text" placeholder="Once upon a time"></input>
              <button onclick={() => caption()}>Oh yeah!</button>
            </Show>
          </Show>
        </Match>
        <Match when={gameState() === GameState.Voting}>
          <h2>Who made whatdo happen?</h2>
          <h3 style="white-space: pre-wrap;">{captionTexts()[0].text}</h3>
          <Show when={(isHost() && !isHostPlayer()) || captionTexts()[0].player.uuid === session()?.user.id}>
            <ol>
              {/* TODO: this doesn't output the prompt which generated it on the client */}
              <For each={captions()}>{(c, i) =>
                <li><h3>{c.caption}</h3></li>
              }</For>
            </ol>
          </Show>
          <Show when={(!isHost() || isHostPlayer()) && captionTexts()[0].player.uuid !== session()?.user.id}>
            <Show when={captionTexts()[0].player.uuid !== session()?.user.id}
                  fallback={"You are still responsible for this masterpiece. Nice."} >
              <h2>Which one is the truth?</h2>
              <For each={captions().filter(c => c.player.uuid !== session()?.user.id)}>{(c, i) =>
                  <p><button onclick={() => vote(c.player)}>{c.caption}</button></p>
              }</For>
            </Show>
          </Show>
        </Match>
        <Match when={gameState() === GameState.Scoring}>
          <h2>What did people guess?</h2>
          <For each={votes()}>{(v, i) =>
              <h3>{v.player.handle} picked {v.vote.handle}</h3>
          }</For>
          <h2>Scores:</h2>
          <For each={players()}>{(p, i) =>
            <h3>{p.handle} has {scores()[p.uuid]} points</h3>
          }</For>
        </Match>
        <Match when={gameState() === GameState.Finished}>
          <h2>Final Scores!</h2>
          <For each={players()}>{(p, i) =>
            <h3>{p.handle} has {scores()[p.uuid]} points</h3>
          }</For>
        </Match>
        <Match when={gameState() === GameState.Waiting}>
          Waiting for other players to finish up...
        </Match>
      </Switch>
      <Show when={errorMessage() !== null}>
        Error! {errorMessage()}
      </Show>
      {/* TODO: Hoist this to App.
          HOST does not have roomid at this point, because they CREATE IT IN THE GAME -_- */}
      <Chatroom roomId={roomId() || 0} />
    </>
	)
}

export default NeoXPromptGuess
