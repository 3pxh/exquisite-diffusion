import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../../supabaseClient'
import { AuthSession } from '@supabase/supabase-js'
import Auth from '../../Auth'
import {PlayerHandle, CaptionData, Vote, TextCompletion} from './GameTypes'

const GAME_NAME = "NeoXPromptGuess";

enum GameState {
  Lobby,
  AwaitingImages, 
  AwaitingCaptions,
  AwaitingVotes,
  Scoring,
  Finished
}


const Host: Component = () => {
	const [session, setSession] = createSignal<AuthSession | null>(null)
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

	createEffect(async () => {
		supabase.auth.getSession().then(({ data: { session } }) => {
      if (session !== null) {
        createRoom();
      }
			setSession(session);
		})

		supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
      if (session !== null) {
        // In the new flow we're only rendering this after authenticated.
        // createRoom();
      }
		})
	})

  const messageRoom = async (msg: any) => {
    // TODO: Guarantee that we have a room id, do error handling/reporting
    let { data, error, status } = await supabase.from('rooms').update({
      data: { ...msg, timestamp: (new Date()).getTime() },
      host_state: GameState[gameState()]
    }).eq('id', roomId()).select();
  }

  const createRoom = async () => {
    if (roomShortcode() !== null && roomId() !== null) {
      return; // Already have a room.
    }
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
      setRoomShortcode(shortcode);
      setRoomId(data.id)
      console.log('joining', shortcode, data.id)
      setGameState(GameState.Lobby);
      subscribeToRoom(data.id);
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
        if (msg.type === "NewPlayer" && gameState() === GameState.Lobby) {
          setPlayers(players().concat([msg.player]));
        } else if (msg.type === "StartGame") {
          setGameState(GameState.AwaitingImages);
          const initScores:Record<PlayerHandle["uuid"], number> = {};
          players().forEach(p => { initScores[p.uuid] = 0; });
          setScores(initScores);
          messageRoom({
            type: "AwaitingImages"
          });
        } else if (msg.type === "GeneratedText") {
          setTexts(texts().concat(msg));
          if (texts().length === players().length) {
            setCaptions([]);
            setCaptionTexts(JSON.parse(JSON.stringify(texts()))); // hacky deep copy
            setGameState(GameState.AwaitingCaptions);
            messageRoom({
              type: "AwaitingCaptions",
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
            messageRoom({
              type: "VotingCaptions",
              captions: captions(),
            });
            setGameState(GameState.AwaitingVotes);
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
            setCaptionTexts(captionTexts().slice(1));
            if (captionTexts().length === 0) {
              if (round() < NUM_ROUNDS) {
                setRound(round() + 1);
                window.setTimeout(() => {
                  setGameState(GameState.AwaitingImages);
                  setTexts([]);
                  setVotes([]);
                  messageRoom({
                    type: "AwaitingImages",
                  });
                }, 10000)
              } else {
                setGameState(GameState.Finished);
              }
            } else {
              window.setTimeout(() => {
                setCaptions([]);
                setVotes([]);
                setGameState(GameState.AwaitingCaptions);
                messageRoom({
                  type: "AwaitingCaptions",
                  text: captionTexts()[0]
                });
              }, 15000)
            }
          }
        }
      }).subscribe();
  }

	return (
    <>
      <Switch fallback={<p>Invalid host state: {gameState()}</p>}>
        <Match when={session() === null}>
          <Auth />
        </Match>
        <Match when={gameState() === GameState.Lobby && roomId() === null}>
          <h2>Initializing room...</h2>
        </Match>
        <Match when={gameState() === GameState.Lobby && roomId() !== null}>
          <h2>To join go to 3pxh.com, join with room code: {roomShortcode()}</h2>
          {players().length} in lobby:
          <ul>
            <For each={players()}>{(p, i) =>
              <li>{p.handle}</li>
            }</For>
          </ul>

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
            <li>If your phone falls asleep the game may break</li>
            <li>Please send feedback to geÖrge Ät hÖqqanen dÖt cÖm</li>
          </ul>
        </Match>
        <Match when={gameState() === GameState.AwaitingImages}>
          <h2>Round {round()} of {NUM_ROUNDS}, dispatching prompts...</h2>
          <h3>Text generation may take a few seconds</h3>
          Beep boop beep
        </Match>
        <Match when={gameState() === GameState.AwaitingCaptions}>
          <h2>Round {round()} of {NUM_ROUNDS}, what generated:</h2>
          <h3 style="white-space: pre-wrap;">{captionTexts()[0].text}</h3>
        </Match>
        <Match when={gameState() === GameState.AwaitingVotes}>
          <h2>Who made whatdo happen?</h2>
          <h3 style="white-space: pre-wrap;">{captionTexts()[0].text}</h3>
          <ol>
          <For each={captions()}>{(c, i) =>
            <li><h3>{c.caption}</h3></li>
          }</For>
          </ol>
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
    </>
	)
}

export default Host
