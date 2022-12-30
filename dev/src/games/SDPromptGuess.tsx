import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../supabaseClient'
import { useAuth } from "../AuthProvider";

import { GameTypeString, Room } from '../GameTypes'

const shuffle = <T,>(A: T[]) => {
  return A.map(value => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
}


const GAME_NAME: GameTypeString = "SDPromptGuess";

interface PlayerHandle {
  handle: string,
  uuid: string
}
interface ImageCompletion {
  player: PlayerHandle,
  prompt: string,
  url: string
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


const SDPromptGuess: Component<Room> = (props) => {
  const { session, playerHandle, setPlayerHandle } = useAuth();

  const [isHostPlayer, setIsHostPlayer] = createSignal<boolean>(false)
  const [gameState, setGameState] = createSignal<GameState>(GameState.Lobby)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [players, setPlayers] = createSignal<PlayerHandle[]>([])
  const [scores, setScores] = createSignal<Record<PlayerHandle["uuid"], number>>({})
  const [images, setImages] = createSignal<ImageCompletion[]>([])
  const [captions, setCaptions] = createSignal<CaptionData[]>([])
  const [captionImages, setCaptionImages] = createSignal<ImageCompletion[]>([])
  const [votes, setVotes] = createSignal<Vote[]>([])
  const [round, setRound] = createSignal<number>(1)

  const NUM_ROUNDS = 3;

	createEffect(async () => {
    if (props.isHost) {
      subscribeToMessages(props.roomId)
    } else {
      clientMessage({
        type: "NewPlayer"
      })
      subscribeToRoom(props.roomId!);
    }
	})

  const clientMessage = async (msg: any) => {
    let { data, error, status } = await supabase.from('messages').insert({
      room: props.roomId,
      user_id: session()?.user.id, // Needed for RLS
      // TODO: Make this less possible to collide with callers of clientMessage
      //  - I accidentally used "player" at one point to pass a vote -_-
      data: {...msg, player: {handle: playerHandle(), uuid: session()?.user.id}}
    });
  }

  const hostMessage = async (msg: any) => {
    // TODO: Guarantee that we have a room id, do error handling/reporting
    let { data, error, status } = await supabase.from('rooms').update({
      data: { 
        ...msg, 
        timestamp: (new Date()).getTime(),
        gameState: gameState(),
        players: players(),
        scores: scores(),
        images: images(),
        captions: captions(),
        captionImages: captionImages(),
        votes: votes(),
        round: round(),
      },
      host_state: GameState[gameState()]
    }).eq('id', props.roomId).select();
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
      setCaptions(msg.data.captions)
      setCaptionImages(msg.data.captionImages)
      setPlayers(msg.data.players);
      setScores(msg.data.scores);
      setVotes(msg.data.votes);
      setGameState(msg.data.gameState);
    }
  }
  // CLIENTS subscribe to ROOM
  const subscribeToRoom = (roomId: number) => {
    supabase
    .channel(`public:rooms:id=eq.${roomId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
    }, payload => {
      handleClientUpdate(payload.new)
    }).subscribe();
    // Initialize if mid-game
    supabase.from('rooms').select(`*`).eq('id', props.roomId).single().then(({ data, error, status }) => {
      handleClientUpdate(data);
      // Additionally, we should re-set our own name given the matching player uuid handle
      if (data.data.players) {
        data.data.players.forEach((p:any) => {
          if (p.uuid === session()?.user.id) {
            setPlayerHandle(p.handle);
          }
        })
      }
    });
  }

  // This is in case their phone locks. For clients only.
  // window.setInterval(async () => {
  //   if (props.roomId !== null && (new Date()).getTime() - lastUpdate > 20000) {
  //     let { data, error, status } = await supabase.from('rooms').select(`*`).eq('id', props.roomId).single();
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
    hostMessage({});
  }

  const continueAfterScoring = () => {
    setCaptionImages(captionImages().slice(1));
    if (captionImages().length === 0) {
      if (round() < NUM_ROUNDS) {
        setRound(round() + 1);
        setGameState(GameState.WritingPrompts);
        setImages([]);
        setVotes([]);
      } else {
        setGameState(GameState.Finished);
      }
    } else {
      setCaptions([]);
      setVotes([]);
      setGameState(GameState.CreatingLies);
    }
    hostMessage({});
  }

  // HOST subscribes to MESSAGES
  const subscribeToMessages = (id: number) => {
    supabase
      .channel(`public:messages:room=eq.${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${id}` 
      }, payload => {
        const msg = payload.new.data;
        if (msg.type === "NewPlayer" && gameState() === GameState.Lobby) {
          setPlayers(players().concat([msg.player]));
        } else if (msg.type === "GeneratedImage") {
          setImages(images().concat(msg));
          if (images().length === players().length) {
            setCaptions([]);
            setCaptionImages(JSON.parse(JSON.stringify(images()))); // hacky deep copy
            setGameState(GameState.CreatingLies);
            hostMessage({});
          }
        } else if (msg.type === "CaptionResponse") {
          setCaptions(captions().concat(msg));
          if (captions().length === players().length - 1) {
            setCaptions(shuffle(captions().concat([{
              player: captionImages()[0].player,
              caption: captionImages()[0].prompt
            }])));
            setGameState(GameState.Voting);
            hostMessage({});
          }
        } else if (msg.type === "CaptionVote") {
          setVotes(votes().concat(msg));
          if (votes().length === players().length - 1) {
            const newScores = scores();
            const drawingPlayer = captionImages()[0].player.uuid;
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
            hostMessage({});
            // TODO: do we want this timeout, or the host presses a button?
            window.setTimeout(() => {
              continueAfterScoring();
            }, 10000);
          }
        }
      }).subscribe();
  }
  
  const generateImage = async () => {
    setErrorMessage("");
    // Must store this, because the element goes away on state change.
    const p = (document.getElementById("SDPrompt") as HTMLInputElement).value;
    setGameState(GameState.Waiting);
    const { data } = await supabase.functions.invoke("diffuse", {
      body: JSON.stringify({
        room: props.roomId,
        player: {handle: playerHandle(), uuid: session()?.user.id },
        prompt: p
      })
    });
    if (data.error) {
      if (data.error.name === "invalid_prompts") {
        setErrorMessage(`"${p}" was an invalid prompt, it probably contained a filtered word. Try again.`);
      } else {
        setErrorMessage(`Error calling Stable Diffusion: ${JSON.stringify(data.error)}`);
      }
      setGameState(GameState.WritingPrompts);
    }
  }

  const caption = async () => {
    const c = (document.getElementById("SDPromptLie") as HTMLInputElement).value
    clientMessage({ type: "CaptionResponse", caption: c });
    setGameState(GameState.Waiting);
  }

  const vote = async (player: PlayerHandle) => {
    clientMessage({ type: "CaptionVote", vote: player });
    setGameState(GameState.Waiting);
  }

	return (
    <>
      <h3>Room code: {props.shortcode}</h3>
      <Switch fallback={<p>Invalid host state: {gameState()}</p>}>
        <Match when={gameState() === GameState.Lobby && props.roomId === null}>
          <h2>Initializing room...</h2>
        </Match>
        <Match when={gameState() === GameState.Lobby && props.roomId !== null}>
          <h2>To join go to 3pxh.com, join with room code: {props.shortcode}</h2>
          {players().length} in lobby:
          <ul>
            <For each={players()}>{(p, i) =>
              <li>{p?.handle ?? "Anonymous"}</li>
            }</For>
          </ul>

          <Show when={props.isHost}>
            <div>Your name: <input id="hostName" placeholder="jubjub"></input></div>
            <div>(leave blank if host is not a player)</div>
            <button onclick={startGame}><h2>Everybody is here, let's start!</h2></button>
          </Show>

          <h2>Instructions:</h2>
          <ol>
            <li>Host creates a game, gets a room code</li>
            <li>Players join the room with the code</li>
            <li>Players generate images based on a description</li>
            <li>Images are shown one at a time,
              <ol>
                <li>All players (other than the one who made the image) give a description</li>
                <li>Players see all descriptions (including the true one), and try to guess the true one</li>
                <li>Players get points for A) guessing the true description, and B) other players guessing their description</li>
              </ol>
            </li>
            <li>After several rounds, the game ends</li>
          </ol>

          <h2>Notes:</h2>
          <ul>
            <li>Image generation may take up to 30 seconds on the backend -- please be patient!</li>
            <li>If you get a blurry image, it probably hit the NSFW filter -- I cannot disable it in the API</li>
            <li>Please send feedback to geÖrge Ät hÖqqanen dÖt cÖm</li>
          </ul>
        </Match>
        <Match when={gameState() === GameState.WritingPrompts}>
          <h2>Round {round()} of {NUM_ROUNDS}, dispatching prompts...</h2>
          <h3>Text generation may take a few seconds</h3>
          Beep boop beep
          <Show when={!props.isHost || isHostPlayer()}>
            <h2>Make something strange!</h2>
            <input id="SDPrompt" placeholder="a cat with a taco hat"></input>
            <button onclick={() => generateImage()}>Generate!</button>
          </Show>
        </Match>
        <Match when={gameState() === GameState.CreatingLies}>
          <h2>Round {round()} of {NUM_ROUNDS}, what generated:</h2>
          <img src={captionImages()[0].url} />
          <Show when={!props.isHost || isHostPlayer()}>
            <Show when={captionImages()[0].player.uuid !== session()?.user.id}
                  fallback={"You are responsible for this masterpiece. Well done."} >
              <p>What prompt made this image?</p>
              <input id="SDPromptLie" type="text" placeholder="a dog dressed as a burrito"></input>
              <button onclick={() => caption()}>Oh yeah!</button>
            </Show>
          </Show>
        </Match>
        <Match when={gameState() === GameState.Voting}>
          <h2>Who made whatdo happen?</h2>
          <img src={captionImages()[0].url} />
          <Show when={(props.isHost && !isHostPlayer()) || captionImages()[0].player.uuid === session()?.user.id}>
            <ol>
              <For each={captions()}>{(c, i) =>
                <li><h3>{c.caption}</h3></li>
              }</For>
            </ol>
          </Show>
          <Show when={!props.isHost || isHostPlayer()}>
            <Show when={captionImages()[0].player.uuid !== session()?.user.id}
                  fallback={"You are still responsible for this masterpiece. Nice."} >
              <h2>Which one is the truth?</h2>
              <For each={captions()}>{(c, i) =>
                  <p><button onclick={() => vote(c.player)}
                    disabled={c.player.uuid === session()?.user.id}
                  >{c.caption}</button></p>
              }</For>
            </Show>
          </Show>
        </Match>
        {/* Having to specify captionImages().length here is bad.
        It is because we can't simultaneously setGameState() AND setCaptionImages() when we get msg from Host.
        This is a real annoyance because we have to reason about the ordering of our data setting. */}
        <Match when={gameState() === GameState.Scoring && captionImages().length > 0}>
          <h2>What did people guess?</h2>

          {/* Go through the lies, show who picked them */}
          <For each={players().filter(p => p.uuid !== captionImages()[0].player.uuid)}>{(p, i) =>
            <>
            <div class="PromptGuess-ScoreRow">
              <div class="PromptGuess-ScoreRowCaption">
                {captions().find(c => c.player.uuid === p.uuid)?.caption}
              </div>
              <div class="PromptGuess-ScoreRowAuthor">{p.handle}</div>
              <div class="PromptGuess-ScoreRowGuessers">
                <For each={votes()}>{(v, i) =>
                  <>
                    {p.uuid === v.vote.uuid ? `${v.player.handle}, ` : ""}
                  </>
                }</For>
              </div>
            </div>
            </>
          }</For>

          {/* Who picked the truth? */}
          <div class="PromptGuess-ScoreRow PromptGuess-ScoreRow--Truth">
            <div class="PromptGuess-ScoreRowCaption">{captionImages()[0].prompt}</div>
            <div class="PromptGuess-ScoreRowAuthor">{captionImages()[0].player.handle}</div>
            <div class="PromptGuess-ScoreRowGuessers">
            <For each={votes()}>{(v, i) =>
              <>
                {captionImages()[0].player.uuid === v.vote.uuid ? `${v.player.handle}, ` : ""}
              </>
            }</For>
            </div>
          </div>
          
          <h2>Scores:</h2>
          <For each={players()}>{(p, i) =>
            <h3>{p.handle} has {scores()[p.uuid]} points</h3>
          }</For>
          {/* TODO: if host, have a "continue" button? */}
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
        <p style="color:red;">{errorMessage()}</p>
      </Show>
    </>
	)
}

export default SDPromptGuess
