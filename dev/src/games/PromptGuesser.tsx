import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../supabaseClient'
import { useAuth } from "../AuthProvider";

import { GameType, Room } from '../GameTypes'

const shuffle = <T,>(A: T[]) => {
  return A.map(value => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
}

const chooseOne = <T,>(A: T[]) => {
  return A[Math.floor(Math.random() * A.length)];
}

interface PlayerHandle {
  handle: string,
  uuid: string
}
interface Generation {
  generationType: string,
  player: PlayerHandle,
  prompt: string,
  url?: string, // generationType === "image"
  text?: string, // generationType === "text" | "list"
  gisticlePrefix?: string, // generationType === "list"
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

const RenderGeneration: Component<{generation: Generation}> = (props) => {
  return (
    <>
    <Switch>
      <Match when={props.generation.generationType === "image"}>
        <img src={props.generation.url} />
      </Match>
      <Match when={props.generation.generationType === "text"}>
        <h3 style="white-space: pre-wrap;">{props.generation.text}</h3>
      </Match>
      <Match when={props.generation.generationType === "list"}>
        {/* Include the prefix here? Or no. */}
        <h3 style="white-space: pre-wrap;">{props.generation.text}</h3>
      </Match>
    </Switch>
    </>
  )
}

const GISTICLE_PREFIXES = [
  "List the top 5 best",
  "List the top 5 reasons you should",
  "List the top 5 most ridiculous ways to",
  "List the top 5 most obvious signs",
];

const PromptGuesser: Component<Room> = (props) => {
  const { session, playerHandle, setPlayerHandle } = useAuth();

  const [isHostPlayer, setIsHostPlayer] = createSignal<boolean>(false)
  const [roomState, setRoomState] = createSignal<GameState>(GameState.Lobby)
  const [playerState, setPlayerState] = createSignal<GameState>(GameState.Lobby)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [players, setPlayers] = createSignal<PlayerHandle[]>([])
  const [playerStates, setPlayerStates] = createSignal<Record<PlayerHandle["uuid"], GameState>>({})
  const [scores, setScores] = createSignal<Record<PlayerHandle["uuid"], number>>({})
  const [generations, setGenerations] = createSignal<Generation[]>([])
  const [captions, setCaptions] = createSignal<CaptionData[]>([])
  const [captionGenerations, setCaptionGenerations] = createSignal<Generation[]>([])
  const [votes, setVotes] = createSignal<Vote[]>([])
  const [round, setRound] = createSignal<number>(1)
  const [gisticlePrefix, setGisticlePrefix] = createSignal<string>(chooseOne(GISTICLE_PREFIXES))

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
  };

  const setAndBroadcastPlayerState = (state: GameState) => {
    if (!props.isHost || isHostPlayer()) {
      const oldState = playerState();
      setPlayerState(state);
      if (oldState !== state && playerStates()[session()?.user.id ?? ""] !== state) {
        clientMessage({type: "PlayerState", state: state});
      }
    }
  }

  const hostMessage = async (msg: any) => {
    
    // TODO: Guarantee that we have a room id, do error handling/reporting
    let { data, error, status } = await supabase.from('rooms').update({
      data: { 
        ...msg, 
        timestamp: (new Date()).getTime(),
        gameState: roomState(),
        players: players(),
        playerStates: playerStates(),
        scores: scores(),
        generations: generations(),
        captions: captions(),
        captionGenerations: captionGenerations(),
        votes: votes(),
        round: round(),
      },
      host_state: GameState[roomState()]
    }).eq('id', props.roomId).select();
  }


  let lastUpdateMessageTimestamp = 0;
  let lastUpdate = (new Date()).getTime();
  const handleClientUpdate = (msg: any) => {
    if (lastUpdateMessageTimestamp === msg.data?.timestamp) {
      // This will happen from the setInterval getting entries from the db
      // We don't want to process the same state change multiple times,
      // lest it revert to a previous state.
      return;
    } else {
      console.log("payload", msg.data)
      lastUpdate = (new Date()).getTime();
      lastUpdateMessageTimestamp = msg.data.timestamp;
      setRound(msg.data.round);
      setCaptions(msg.data.captions);
      setCaptionGenerations(msg.data.captionGenerations);
      setPlayers(msg.data.players);
      setScores(msg.data.scores);
      setVotes(msg.data.votes);
      // If we broadcast our state afterward, we get an infinite loop.
      setPlayerStates(msg.data.playerStates);

      // The player should not recognize state changes except when specifically annotated by the host.
      if (!msg.data.ignoreStateChange) {
        setAndBroadcastPlayerState(msg.data.gameState);
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
      handleClientUpdate(payload.new)
    }).subscribe();
    // Initialize if mid-game
    supabase.from('rooms').select(`*`).eq('id', props.roomId).single().then(({ data, error, status }) => {
      handleClientUpdate(data);
      // It's possible that the room has "ignoreStateChange" on it sigh.
      // But the host state could be "waiting", set on the room after player states.
      // Ugh. The host state and the room state should be distinct.
      setAndBroadcastPlayerState(data.data.gameState);
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

  const setHostState = (s: GameState) => {
    const newStates = {...playerStates()}
    newStates[session()?.user.id!] = s;
    setPlayerStates(newStates);
    setRoomState(s);
    setPlayerState(s);
  }

  const startGame = () => {
    const hostName = (document.getElementById("hostName") as HTMLInputElement).value;
    if (hostName.length > 0) {
      setIsHostPlayer(true);
      setPlayerHandle(hostName); // Gross.
      setPlayers(players().concat([{handle: hostName, uuid: session()!.user.id}]));
    }
    setHostState(GameState.WritingPrompts);
    const initScores:Record<PlayerHandle["uuid"], number> = {};
    players().forEach(p => { initScores[p.uuid] = 0; });
    setScores(initScores);
    const initStates:Record<PlayerHandle["uuid"], GameState> = {};
    players().forEach(p => { initStates[p.uuid] = GameState.Lobby; });
    setPlayerStates(initStates);
    hostMessage({});
  }

  const continueAfterScoring = () => {
    setCaptionGenerations(captionGenerations().slice(1));
    if (captionGenerations().length === 0) {
      if (round() < NUM_ROUNDS) {
        setRound(round() + 1);
        setHostState(GameState.WritingPrompts);
        setGenerations([]);
        setVotes([]);
      } else {
        setHostState(GameState.Finished);
      }
    } else {
      setCaptions([]);
      setVotes([]);
      setHostState(GameState.CreatingLies);
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
        if (msg.type === "NewPlayer" && roomState() === GameState.Lobby) {
          setPlayers(players().concat([msg.player]));
        } else if (msg.type === "Generation") {
          setGenerations(generations().concat(msg));
          if (generations().length === players().length) {
            setCaptions([]);
            setCaptionGenerations(JSON.parse(JSON.stringify(generations()))); // hacky deep copy
            setHostState(GameState.CreatingLies);
            hostMessage({});
          }
        } else if (msg.type === "CaptionResponse") {
          setCaptions(captions().concat(msg));
          if (captions().length === players().length - 1) {
            setCaptions(shuffle(captions().concat([{
              player: captionGenerations()[0].player,
              caption: captionGenerations()[0].prompt
            }])));
            setHostState(GameState.Voting);
            hostMessage({});
          }
        } else if (msg.type === "CaptionVote") {
          setVotes(votes().concat(msg));
          if (votes().length === players().length - 1) {
            const newScores = scores();
            const drawingPlayer = captionGenerations()[0].player.uuid;
            votes().forEach(v => {
              if (v.vote.uuid === drawingPlayer) { // truth
                newScores[v.player.uuid] += 1000;
                newScores[drawingPlayer] += 1000;
              } else { // lie
                newScores[v.vote.uuid] += 500;
              }
            })
            setScores(newScores);
            setHostState(GameState.Scoring);
            hostMessage({});
          }
        } else if (msg.type === "PlayerState") {
          const newStates = {...playerStates()}
          newStates[msg.player.uuid] = msg.state;
          setPlayerStates(newStates);
          // This is just a data relay, plus the host could be a player and be Waiting, so we must ignore!
          hostMessage({ignoreStateChange: true});
        }
      }).subscribe();
  }

  const generate = async () => {
    const GEN_MAP:any = {
      [GameType.SDPromptGuess]: "image",
      [GameType.NeoXPromptGuess]: "text",
      [GameType.Gisticle]: "list",
    }
    const generationType = GEN_MAP[props.gameType];
    setErrorMessage("");
    // Must store this, because the element goes away on state change.
    const p = (document.getElementById("GeneratingPrompt") as HTMLInputElement).value;
    setAndBroadcastPlayerState(GameState.Waiting);
    const { data } = await supabase.functions.invoke("generate", {
      body: JSON.stringify({
        room: props.roomId,
        player: {handle: playerHandle(), uuid: session()?.user.id },
        prompt: p,
        gisticlePrefix: gisticlePrefix(),
        generationType: generationType,
      })
    });
    if (data.error) {
      if (data.error.name === "invalid_prompts") {
        setErrorMessage(`"${p}" was an invalid prompt, it probably contained a filtered word. Try again.`);
      } else {
        setErrorMessage(`Error generating content: ${JSON.stringify(data.error)}`);
      }
      setAndBroadcastPlayerState(GameState.WritingPrompts);
    } else {
      setGisticlePrefix(chooseOne(GISTICLE_PREFIXES));
    }
  }

  const caption = async () => {
    const c = (document.getElementById("SDPromptLie") as HTMLInputElement).value
    clientMessage({ type: "CaptionResponse", caption: c });
    setAndBroadcastPlayerState(GameState.Waiting);
  }

  const vote = async (player: PlayerHandle) => {
    clientMessage({ type: "CaptionVote", vote: player });
    setAndBroadcastPlayerState(GameState.Waiting);
  }

	return (
    <>
      <h3>
      Game: 
      <Switch fallback={"Unrecognized Game Type"}>
        <Match when={props.gameType === GameType.SDPromptGuess}>
          Farsketched
        </Match>
        <Match when={props.gameType === GameType.NeoXPromptGuess}>
          False Starts 
        </Match>
        <Match when={props.gameType === GameType.Gisticle}>
          Gisticle
        </Match>
      </Switch>
        | Room code: {props.shortcode} | You are: {playerHandle()}
      </h3>
      <Switch fallback={<p>Invalid host state: {playerState()}</p>}>
        <Match when={playerState() === GameState.Lobby && props.roomId === null}>
          <h2>Initializing room...</h2>
        </Match>
        <Match when={playerState() === GameState.Lobby && props.roomId !== null}>
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
            <li>Players join via the room code, host starts game once everyone is in</li>
            <li>Prompt the image / text generator</li>
            <li>Look at generated content, come up with alternate prompts</li>
            <li>Get points for guessing the real prompt, or other players guessing your prompt</li>
          </ol>

          <h2>Notes:</h2>
          <ul>
            <li>Image generation may take up to 30 seconds on the backend -- please be patient!</li>
            <li>If you get a blurry image, it probably hit the NSFW filter -- I cannot disable it in the API</li>
            <li>Please send feedback to geÖrge Ät hÖqqanen dÖt cÖm</li>
          </ul>
        </Match>
        <Match when={playerState() === GameState.WritingPrompts}>
          <h2>Round {round()} of {NUM_ROUNDS}, dispatching prompts...</h2>
          <h3>Image and text generation may take a few seconds</h3>
          Beep boop beep
          <Show when={!props.isHost || isHostPlayer()}>
            <h2>Make something strange!</h2>
            <Show when={ props.gameType === GameType.Gisticle }>
              <h3>{gisticlePrefix()}</h3>
            </Show>
            <input id="GeneratingPrompt" placeholder=""></input>
            <button onclick={() => generate()}>Generate!</button>
          </Show>
        </Match>
        <Match when={playerState() === GameState.CreatingLies}>
          <h2>Round {round()} of {NUM_ROUNDS}, what generated:</h2>
          <RenderGeneration generation={captionGenerations()[0]} />
          <Show when={!props.isHost || isHostPlayer()}>
            <Show when={captionGenerations()[0].player.uuid !== session()?.user.id}
                  fallback={"You are responsible for this masterpiece. Well done."} >
              <p>What prompt made this?</p>
              <Show when={ props.gameType === GameType.Gisticle }>
                <h3>{captionGenerations()[0].gisticlePrefix}</h3>
              </Show>
              <input id="SDPromptLie" type="text" placeholder="a dog dressed as a burrito"></input>
              <button onclick={() => caption()}>Oh yeah!</button>
            </Show>
          </Show>
        </Match>
        <Match when={playerState() === GameState.Voting}>
          <h2>Who made whatdo happen?</h2>
          <RenderGeneration generation={captionGenerations()[0]} />
          <Show when={(props.isHost && !isHostPlayer()) || captionGenerations()[0].player.uuid === session()?.user.id}>
            <Show when={ props.gameType === GameType.Gisticle }>
              <h3>{captionGenerations()[0].gisticlePrefix}...</h3>
            </Show>
            <ol>
              <For each={captions()}>{(c, i) =>
                <li><h3>{c.caption}</h3></li>
              }</For>
            </ol>
          </Show>
          <Show when={!props.isHost || isHostPlayer()}>
            <Show when={captionGenerations()[0].player.uuid !== session()?.user.id}
                  fallback={"You are still responsible for this masterpiece. Nice."} >
              <h2>Which one is the truth?</h2>
              <Show when={ props.gameType === GameType.Gisticle }>
                <h3>{captionGenerations()[0].gisticlePrefix}...</h3>
              </Show>
              <For each={captions()}>{(c, i) =>
                  <p><button onclick={() => vote(c.player)}
                    disabled={c.player.uuid === session()?.user.id}
                  >{c.caption}</button></p>
              }</For>
            </Show>
          </Show>
        </Match>
        {/* Having to specify captionGenerations().length here is bad.
        It is because we can't simultaneously setplayerState() AND setCaptionGenerations() when we get msg from Host.
        This is a real annoyance because we have to reason about the ordering of our data setting. */}
        <Match when={playerState() === GameState.Scoring && captionGenerations().length > 0}>
          <h2>What did people guess?</h2>

          {/* Go through the lies, show who picked them */}
          <For each={players().filter(p => p.uuid !== captionGenerations()[0].player.uuid)}>{(p, i) =>
            <>
            <div class="PromptGuess-ScoreRow">
              <div class="PromptGuess-ScoreRowCaption">
                {captions().find(c => c.player.uuid === p.uuid)?.caption}
              </div>
              <div class="PromptGuess-ScoreRowAuthor">by {p.handle}</div>
              <div class="PromptGuess-ScoreRowGuessers">
                Guessers: 
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
            <div class="PromptGuess-ScoreRowCaption">{captionGenerations()[0].prompt}</div>
            <div class="PromptGuess-ScoreRowAuthor">by {captionGenerations()[0].player.handle}</div>
            <div class="PromptGuess-ScoreRowGuessers">
              Guessers: 
            <For each={votes()}>{(v, i) =>
              <>
                {captionGenerations()[0].player.uuid === v.vote.uuid ? `${v.player.handle}, ` : ""}
              </>
            }</For>
            </div>
          </div>
          
          <h2>Scores:</h2>
          <For each={players()}>{(p, i) =>
            <h3>{p.handle} has {scores()[p.uuid]} points</h3>
          }</For>
          {/* TODO: if host, have a "continue" button? */}
          <Show when={props.isHost}>
            <button onclick={continueAfterScoring}><h3>Continue</h3></button>
          </Show>
        </Match>
        <Match when={playerState() === GameState.Finished}>
          <h2>Final Scores!</h2>
          <For each={players()}>{(p, i) =>
            <h3>{p.handle} has {scores()[p.uuid]} points</h3>
          }</For>
        </Match>
        <Match when={playerState() === GameState.Waiting}>
          Waiting for other players (or the computer) to finish up...

          <For each={players()}>{(p, i) =>
          <>
            <Show when={playerStates()[p.uuid] === GameState.Waiting}>
              <p>{p.handle} is done</p>
            </Show>
            <Show when={playerStates()[p.uuid] !== GameState.Waiting}>
            <p>{p.handle} is still working</p>
            </Show>
          </>
          }</For>
        </Match>
      </Switch>
      <Show when={errorMessage() !== null}>
        <p style="color:red;">{errorMessage()}</p>
      </Show>
    </>
	)
}

export default PromptGuesser
