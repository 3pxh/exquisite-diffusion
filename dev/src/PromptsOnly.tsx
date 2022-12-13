import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from './supabaseClient'
import { AuthSession } from '@supabase/supabase-js'
import Auth from './Auth'

enum GameRole {
  Host,
  Client
}

// TODO: split game states into host and client states?
// Serve two different pages. Obvi.
enum GameState {
  Pregame,
  Login, // For hosts only
  JoinRoom, // For clients only
  Lobby,
  Introduction,
  CreatingImages, // Client
  AwaitingImages, // Host
  DoneCreating,
  CaptioningImages,
  AwaitingCaptions,
  DoneCaptioning,
  VotingCaptions,
  AwaitingVotes,
  DoneVoting,
  Scoring,
  Finished
}


interface PlayerHandle {
  handle: string,
  uuid: string
}
interface ImageData {
  player: PlayerHandle,
  url: string,
  secretPrompt: string,
  prompt: string,
}
interface CaptionData {
  player: PlayerHandle,
  caption: string
}
interface Vote {
  vote: PlayerHandle,
  player: PlayerHandle
}

const App: Component = () => {
	const [session, setSession] = createSignal<AuthSession | null>(null)
  const [playerHandle, setPlayerHandle] = createSignal<PlayerHandle | null>(null)
  const [gameState, setGameState] = createSignal<GameState>(GameState.Pregame)
  const [gameRole, setGameRole] = createSignal<GameRole | null>(null)
  const [roomShortcode, setRoomShortcode] = createSignal<string | null>(null)
  const [roomId, setRoomId] = createSignal<number | null>(null)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [players, setPlayers] = createSignal<PlayerHandle[]>([])
  const [scores, setScores] = createSignal<Record<PlayerHandle["uuid"], number>>({})
  const [images, setImages] = createSignal<ImageData[]>([])
  const [captions, setCaptions] = createSignal<CaptionData[]>([])
  const [captionImages, setCaptionImages] = createSignal<ImageData[]>([])
  const [votes, setVotes] = createSignal<Vote[]>([])
  const [round, setRound] = createSignal<number>(1)

  const NUM_ROUNDS = 3;

	createEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session)
		})

		supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session)
		})
	})

  const messageRoom = async (msg: any) => {
    // TODO: Guarantee that we have a room id, do error handling/reporting
    let { data, error, status } = await supabase.from('messages').insert({
      room: roomId(),
      // TODO: Make this less possible to collide with callers of messageRoom
      //  - I accidentally used "player" at one point to pass a vote -_-
      data: {...msg, role: gameRole(), player: playerHandle()}
    });
  }

  const makeShortcode = () => {
    let shortcode = '';
    for ( var i = 0; i < 4; i++ ) {
      shortcode += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
    }
    return shortcode;
  }

  const createRoom = async () => {
    // TODO: disable the create a room button so they don't click it twice while DB goes
    const shortcode = makeShortcode();
    let { data, error, status } = await supabase.from('rooms').insert({
      shortcode: shortcode,
      host_state: GameState[GameState.Lobby] // Convert to string in case the enum changes
    }).select().single();
    if (data === null || error !== null) {
      setErrorMessage(`Could not create room, status code ${status}. Check console for errors.`);
      console.log(error);
    } else {
      setRoomShortcode(shortcode);
      setRoomId(data.id)
      setGameState(GameState.Lobby);
      subscribeToRoom(data.id);
    }
  }

  const chooseRole = async (role: GameRole) => {
    setGameRole(role);
    if (role == GameRole.Host) {
      if (session()) {
        createRoom();
      } else {
        setGameState(GameState.Login);
      }
    } else if (role === GameRole.Client) {
      setGameState(GameState.JoinRoom)
    }
  }

  const shuffle = <T,>(A: T[]) => {
    return A.map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
  }

  const subscribeToRoom = (id: number) => {
    supabase
      .channel(`public:messages:room=eq.${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${id}` 
      }, payload => {
        console.log("got payload", payload)
        const msg = payload.new.data;
        const hostingLobby = gameRole() === GameRole.Host && gameState() === GameState.Lobby;
        if (msg.type === "NewPlayer" && hostingLobby) {
          setPlayers(players().concat([msg.player]));
        } else if (msg.type === "StartGame" && gameRole() === GameRole.Host) {
          setGameState(GameState.Introduction);
          const s:Record<PlayerHandle["uuid"], number> = {};
          players().forEach(p => { s[p.uuid] = 0; });
          setScores(s);
          messageRoom({
            type: "AwaitingImages"
          });
        } else if (msg.type === "AwaitingImages" && gameRole() === GameRole.Client) {
          setGameState(GameState.CreatingImages);
        } else if (msg.type === "GeneratedImage" && gameRole() === GameRole.Host) {
          setImages(images().concat(msg));
          if (images().length === players().length) {
            setCaptions([]);
            setCaptionImages(JSON.parse(JSON.stringify(images()))); // hacky deep copy
            setGameState(GameState.AwaitingCaptions);
            messageRoom({
              type: "AwaitingCaptions",
              image: captionImages()[0]
            });
          }
        } else if (msg.type === "AwaitingCaptions"  && gameRole() === GameRole.Client) {
          setCaptionImages([msg.image])
          setGameState(GameState.CaptioningImages);
        } else if (msg.type === "CaptionResponse" && gameRole() === GameRole.Host) {
          setCaptions(captions().concat(msg));
          if (captions().length === players().length - 1) {
            setCaptions(shuffle(captions().concat([{
              player: captionImages()[0].player,
              caption: captionImages()[0].prompt
            }])));
            messageRoom({
              type: "VotingCaptions",
              captions: captions(),
            });
            setGameState(GameState.AwaitingVotes);
          }
        } else if (msg.type === "VotingCaptions"  && gameRole() === GameRole.Client) {
          setCaptions(msg.captions.filter(c => c.player.uuid !== playerHandle()?.uuid))
          setGameState(GameState.VotingCaptions);
        } else if (msg.type === "CaptionVote" && gameRole() === GameRole.Host) {
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
            setCaptionImages(captionImages().slice(1)); // Pop off the top.
            if (captionImages().length === 0) {
              // Done with the round
              if (round() < NUM_ROUNDS) {
                setRound(round() + 1);
                window.setTimeout(() => {
                  setGameState(GameState.AwaitingImages);
                  setImages([]);
                  setVotes([]);
                  messageRoom({
                    type: "AwaitingImages",
                  });
                }, 15000)
              } else {
                window.setTimeout(() => {
                  setGameState(GameState.Finished);
                }, 15000)
              }
            } else {
              window.setTimeout(() => {
                setCaptions([]);
                setVotes([]);
                setGameState(GameState.AwaitingCaptions);
                messageRoom({
                  type: "AwaitingCaptions",
                  image: captionImages()[0]
                });
              }, 15000)
            }
          }
        }
      }).subscribe();
  }

  const joinRoom = async () => {
    setPlayerHandle({
      handle: document.getElementById("handle")?.value,
      uuid: crypto.randomUUID()
    });
    const shortcode = document.getElementById("shortcode")?.value.toUpperCase();
    setGameState(GameState.Lobby);
    let { data, error, status } = await supabase
				.from('rooms')
				.select(`*`)
				.eq('shortcode', shortcode)
				.single();
    // TODO: sort by date and get the most recent room in case of collisions
    const id = data?.id;
    if (data === null || error !== null) {
      setErrorMessage(`Could not join room, status code ${status}. Check console for errors.`);
      console.log(error);
    } else {
      console.log("room shortcode", shortcode, id)
      setRoomShortcode(shortcode);
      setRoomId(id);
      subscribeToRoom(id);
      messageRoom({type: "NewPlayer"});
    }
  }

  const diffuse = async () => {
    // Must store this, because the element goes away on state change.
    const p = document.getElementById("diffusionPrompt")?.value;
    setGameState(GameState.DoneCreating);
    const { data, error } = await supabase.functions.invoke("diffuse", {
      body: JSON.stringify({
        room: roomId(),
        player: playerHandle(),
        secretPrompt: "",
        prompt: p
      })
    })
  }

  const caption = async () => {
    messageRoom({
      type: "CaptionResponse",
      caption: document.getElementById("imageCaption")?.value
    });
    setGameState(GameState.DoneCaptioning);
  }

  const vote = async (player: PlayerHandle) => {
    messageRoom({
      type: "CaptionVote",
      vote: player
    });
    setGameState(GameState.DoneVoting);
  }

	return (
		<div class="container" style={{ padding: '50px 0 100px 0' }}>
      <Switch fallback={<p>Invalid game state.</p>}>
        <Match when={gameState() === GameState.Pregame}>
          <button onclick={() => chooseRole(GameRole.Host)}>Create New Game</button>
          <button onclick={() => chooseRole(GameRole.Client)}>Join A Game</button>
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
            <li>If your phone falls asleep the game may break</li>
            <li>Image generation may take up to 30 seconds on the backend -- please be patient!</li>
            <li>If you get a blurry image, it probably hit the NSFW filter -- I cannot disable it in the API</li>
            <li>Please send feedback to geÖrge Ät hÖqqanen dÖt cÖm</li>
          </ul>
        </Match>
        <Match when={gameState() === GameState.Login}>
          {!session() 
            ? <Auth /> 
            : <button onclick={() => createRoom()}>Create New Game</button>}
        </Match>
        <Match when={gameState() === GameState.JoinRoom}>
          <h2>Join a game</h2>
          <input value="" id="handle" placeholder="Name"></input>
          <input style="text-transform:uppercase;" value="" id="shortcode" placeholder="Room Code"></input>
          <button onclick={() => joinRoom()}>Join room</button>
        </Match>
        <Match when={gameState() === GameState.Lobby}>
          <Show when={gameRole() === GameRole.Host} >
            <h2>Join: go to 3pxh.com, join game, enter room code: {roomShortcode()}</h2>
            {players().length} in lobby:
            <ul>
              <For each={players()}>{(p, i) =>
                <li>{p.handle}</li>
              }</For>
            </ul>
          </Show>
          <Show when={gameRole() === GameRole.Client} >
            <Show when={roomShortcode() !== null && roomId() !== null} 
              fallback="Joining room...">
              <h2>Welcome</h2>
              <p>Only press once everyone is in the room!</p>
              <button onclick={() => {messageRoom({type: "StartGame"});}}>All Players In!</button>
            </Show>
          </Show>
        </Match>
        <Match when={gameState() === GameState.Introduction}>
          <Show when={gameRole() === GameRole.Host} >
            <h2>Dispatching prompts...</h2>
            <h3>Image generation may take up to a minute</h3>
            Beep boop beep
          </Show>
          <Show when={gameRole() === GameRole.Client} >
            Waiting for other players to submit their prompts
          </Show>
        </Match>
        <Match when={gameState() === GameState.AwaitingImages}>
          <h2>Round {round()} of {NUM_ROUNDS}</h2>
          <h3>Awaiting images</h3>
          {/* <For each={images()}>{(img, i) =>
              <img src={img.url} alt={img.handle}></img>
          }</For> */}
        </Match>
        <Match when={gameState() === GameState.CreatingImages}>
          <h2>Make something strange!</h2>
          <input id="diffusionPrompt" placeholder="Describe an image..."></input>
          <button onclick={() => diffuse()}>Generate!</button>
        </Match>
        <Match when={gameState() === GameState.DoneCreating ||
                     gameState() === GameState.DoneCaptioning ||
                     gameState() === GameState.DoneVoting}>
          Waiting for other players to finish up...
        </Match>
        <Match when={gameState() === GameState.AwaitingCaptions}>
          <p>Round {round()} of {NUM_ROUNDS}, what describes:</p>
          <img src={captionImages()[0].url}></img>
        </Match>
        <Match when={gameState() === GameState.CaptioningImages}>
          <Show when={captionImages()[0].player.uuid !== playerHandle()?.uuid}
                fallback={"You are responsible for this masterpiece. Well done."} >
            <p>Describe:</p>
            <input id="imageCaption" type="text" placeholder="image description"></input>
            <button onclick={() => caption()}>Oh yeah!</button>
          </Show>
        </Match>
        <Match when={gameState() === GameState.AwaitingVotes}>
          <h2>Who made whatdo happen?</h2>
          <img src={captionImages()[0].url} style="float:left; margin-right:20px;"></img>
          <ol>
          <For each={captions()}>{(c, i) =>
            <li><h3>{c.caption}</h3></li>
          }</For>
          </ol>
        </Match>
        <Match when={gameState() === GameState.VotingCaptions}>
          <Show when={captionImages()[0].player.uuid !== playerHandle()?.uuid}
                fallback={"You are still responsible for this masterpiece. Nice."} >
            <h2>Which one is the truth?</h2>
            <For each={captions()}>{(c, i) =>
                <p><button onclick={() => vote(c.player)}>{c.caption}</button></p>
            }</For>
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
      </Switch>
      <Show when={errorMessage() !== null}>
        Error! {errorMessage()}
      </Show>
		</div>
	)
}

export default App
