import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../supabaseClient'
import { useAuth } from "../AuthProvider";

import { GameTypeString, Room } from '../GameTypes'

const GAME_NAME: GameTypeString = "Hadron64";

interface PlayerHandle {
  handle: string,
  uuid: string
}

enum GameState {
  Lobby,
  Playing,
  Frozen, // Upon successful set
  Finished,
}
const PlayerDot: Component<{n: number}> = (props) => {
  const cl:any = {HadronDot: true};
  cl[`HadronDot-Color--${props.n}`] = true;
  return (<>
    <div classList={cl}></div>
  </>)
}

const Card: Component<{val: number}> = (props) => {
  const bitPattern = [];
  let val = props.val;
  for (let i = 0; i < 6; i++) {
    bitPattern.push(val % 2);
    val = val >> 1;
  }

  return (
    <>
    <svg style="margin:10px;background-color:white; fill-rule:evenodd;clip-rule:evenodd;" width="117px" height="156px" viewBox="0 0 2352 3318" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <rect id="Artboard1" x="0" y="0" width="2352" height="3318" style="fill:none;"/>
      <clipPath id="_clip1">
          <rect id="Artboard11" x="0" y="0" width="2352" height="3318"/>
      </clipPath>
      <g clip-path="url(#_clip1)">
          <Show when={bitPattern[0] === 1}>
            <g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M184.581,1227.8L238.779,1227.8" style="fill:none;fill-rule:nonzero;stroke:rgb(221,170,51);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M175.362,1241.8L247.998,1241.8" style="fill:none;fill-rule:nonzero;stroke:rgb(221,170,51);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M172.8,1255.8L250.56,1255.8" style="fill:none;fill-rule:nonzero;stroke:rgb(221,170,51);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M175.455,1269.8L247.905,1269.8" style="fill:none;fill-rule:nonzero;stroke:rgb(221,170,51);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M184.83,1283.8L238.53,1283.8" style="fill:none;fill-rule:nonzero;stroke:rgb(221,170,51);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <circle cx="211.68" cy="1255.68" r="38.88" style="fill:none;stroke:black;stroke-width:7px;"/>
                </g>
            </g>
          </Show>
          <Show when={bitPattern[1] === 1}>
            <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                <circle cx="360" cy="1255.68" r="38.88" style="fill:rgb(187,85,102);stroke:black;stroke-width:7px;"/>
            </g>
          </Show>
          
          <Show when={bitPattern[2] === 1}>
            <g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M481.221,1227.8L535.419,1227.8" style="fill:none;fill-rule:nonzero;stroke:rgb(0,68,136);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M472.002,1241.8L544.638,1241.8" style="fill:none;fill-rule:nonzero;stroke:rgb(0,68,136);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M469.44,1255.8L547.2,1255.8" style="fill:none;fill-rule:nonzero;stroke:rgb(0,68,136);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M472.095,1269.8L544.545,1269.8" style="fill:none;fill-rule:nonzero;stroke:rgb(0,68,136);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M481.47,1283.8L535.17,1283.8" style="fill:none;fill-rule:nonzero;stroke:rgb(0,68,136);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <circle cx="508.32" cy="1255.68" r="38.88" style="fill:none;stroke:black;stroke-width:7px;"/>
                </g>
            </g>
          </Show>
          <Show when={bitPattern[3] === 1}>
            <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                <circle cx="211.68" cy="1408.32" r="38.88" style="fill:rgb(221,170,51);stroke:black;stroke-width:7px;"/>
            </g>
          </Show>
          <Show when={bitPattern[4] === 1}>
            <g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M332.901,1380.44L387.099,1380.44" style="fill:none;fill-rule:nonzero;stroke:rgb(187,85,102);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M323.682,1394.44L396.318,1394.44" style="fill:none;fill-rule:nonzero;stroke:rgb(187,85,102);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M321.12,1408.44L398.88,1408.44" style="fill:none;fill-rule:nonzero;stroke:rgb(187,85,102);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M323.775,1422.44L396.225,1422.44" style="fill:none;fill-rule:nonzero;stroke:rgb(187,85,102);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <path d="M333.15,1436.44L386.85,1436.44" style="fill:none;fill-rule:nonzero;stroke:rgb(187,85,102);stroke-width:7px;"/>
                </g>
                <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                    <circle cx="360" cy="1408.32" r="38.88" style="fill:none;stroke:black;stroke-width:7px;"/>
                </g>
            </g>
          </Show>
          <Show when={bitPattern[5] === 1}>
            <g transform="matrix(5.10269e-16,8.33333,-8.33333,5.10269e-16,12276,-1341)">
                <circle cx="508.32" cy="1408.32" r="38.88" style="fill:rgb(0,68,136);stroke:black;stroke-width:7px;"/>
            </g>
          </Show>
      </g>
    </svg>
    </>
  )
}

const Hadron64: Component<Room> = (props) => {
  const { session, playerHandle, setPlayerHandle } = useAuth();

  const [isHostPlayer, setIsHostPlayer] = createSignal<boolean>(false)
  const [gameState, setGameState] = createSignal<GameState>(GameState.Lobby)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [players, setPlayers] = createSignal<PlayerHandle[]>([])
  const [scores, setScores] = createSignal<Record<PlayerHandle["uuid"], number>>({})
  const [deck, setDeck] = createSignal<number[]>([])
  const [board, setBoard] = createSignal<number[]>([])
  // sense of presence, show who's collecting each card as they click it.
  const [playerSelections, setPlayerSelections] = createSignal<Record<number, PlayerHandle["handle"][]>>({})
  const [selection, setSelection] = createSignal<Record<number, boolean>>([])

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
      user_id: session()?.user.id,
      data: {...msg, player: {handle: playerHandle(), uuid: session()?.user.id}}
    });
  }

  const hostMessage = async (msg: any) => {
    let { data, error, status } = await supabase.from('rooms').update({
      data: { 
        ...msg, 
        deck: deck(),
        board: board(),
        players: players(),
        scores: scores(),
        playerSelections: playerSelections(),
        gameState: gameState(),
        timestamp: (new Date()).getTime() 
      },
      host_state: GameState[gameState()]
    }).eq('id', props.roomId).select();
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
      setBoard(msg.data.board);
      setDeck(msg.data.deck);
      setPlayers(msg.data.players);
      setScores(msg.data.scores);
      setPlayerSelections(msg.data.playerSelections);
      setGameState(msg.data.gameState);
      if (msg.data.type === "Playing") {
        setGameState(GameState.Playing);
      } else if (msg.data.type === "CollectedSet") {
        setSelection({});
      } else if (msg.data.type === "Finished") {
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
  //   if ((new Date()).getTime() - lastUpdate > 20000) {
  //     let { data, error, status } = await supabase.from('rooms').select(`*`).eq('id', props.roomId).single();
  //     handleClientUpdate(data);
  //   }
  // }, 2000);

  const startGame = () => {
    const hostName = (document.getElementById("hostName") as HTMLInputElement).value;
    if (hostName.length > 0) {
      setIsHostPlayer(true);
      setPlayerHandle(hostName); // Gross.
      setPlayers(players().concat({handle: hostName, uuid: session()!.user.id}));
    }
    setGameState(GameState.Playing);
    const initScores:Record<PlayerHandle["uuid"], number> = {};
    players().forEach(p => { initScores[p.uuid] = 0; });
    const newDeck = shuffle(new Array(63).fill(0).map((_,i) => i+1));
    setBoard(newDeck.slice(0,7));
    setDeck(newDeck.slice(7));
    setScores(initScores);
    const selections:any = {}
    board().forEach(b => {
      selections[b] = []
    })
    setPlayerSelections(selections);
    hostMessage({
      type: "Playing",
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
          setPlayers(players().concat(msg.player));
          // setGameData({...gameData(), players: gameData().players.concat(msg.player)})
        } else if (msg.type === "UpdateSelection") {
          const s = {...playerSelections()};
          board().forEach(b => {
            if (msg.selection[b] && s[b].indexOf(msg.player.handle) < 0) {
              s[b] = s[b].concat(msg.player.handle)
            } else if (!msg.selection[b] && s[b].indexOf(msg.player.handle) >= 0) {
              s[b] = s[b].filter(h => h !== msg.player.handle);
            }
          });
          setPlayerSelections(s);
          hostMessage({});
        } else if (msg.type === "ValidSelection") {
          // TODO: confirm it? Client could lie.
          setGameState(GameState.Frozen);
          const s:any = {};
          let selectionSize = 0;
          board().forEach(b => {
            if (msg.selection[b]) {
              s[b] = [msg.player.handle];
              selectionSize += 1;
            }
          });
          setPlayerSelections(s);
          hostMessage({});
          window.setTimeout(() => {
            console.log("Keep on playing");
            // Collect and draw new cards
            
            const sc = {...scores()};
            sc[msg.player.uuid] += selectionSize;
            setScores(sc);
            const newCards = deck().slice(0, selectionSize);
            const newBoard = [...board()];
            const newSelections:any = {};
            let counter = 0;
            // Replace out the cards, preserving order of remaining cards.
            newBoard.forEach((b, i) => {
              newSelections[b] = [];
              if (msg.selection[b]) {
                newBoard[i] = newCards[counter] ?? 0;
                newSelections[newCards[counter]] = [];
                counter += 1;
              }
            });
            setPlayerSelections(newSelections);
            setDeck(deck().slice(selectionSize));
            setBoard(newBoard);
            // TODO: if deck is empty, end the game.
            setGameState(GameState.Playing);
            hostMessage({type: "CollectedSet"});

            if (deck().length === 0) {
              setGameState(GameState.Finished);
              hostMessage({type: "Finished"});
            }
          }, 5000);
        }
      }).subscribe();
  }
  
  const toggleSelect = (card: number) => {
    if (gameState() !== GameState.Frozen) {
      setSelection({
        ...selection(),
        [card]: !selection()[card]
      });
      let selectionXOR = 0;
      let atLeastOne = false;
      board().forEach(b => {
        if (selection()[b]) {
          selectionXOR = selectionXOR ^ b;
          atLeastOne = true;
        }
      });
      if (atLeastOne && selectionXOR === 0) {
        console.log("Valid selection!!")
        clientMessage({type: "ValidSelection", selection: selection()});
        setGameState(GameState.Frozen);
      } else {
        clientMessage({type: "UpdateSelection", selection: selection()});
      }
    }
  }

	return (
    <>
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
            <li>Players race to find sets</li>
            <li>Click on all members of a set to collect</li>
          </ol>

          <h2>Notes:</h2>
          <ul>
            <li>Please send feedback to geÖrge Ät hÖqqanen dÖt cÖm</li>
          </ul>
        </Match>
        <Match when={gameState() === GameState.Playing || gameState() === GameState.Frozen}>
          <h2>Find a set</h2>
          <div style="display:flex;flex-direction:row;flex-wrap:wrap;width:440px;">
            <div style="width:70px;"></div>

          <For each={board()}>{(c, i) =>
              <>
              <Show when={i() === 5}>
                <div style="width:70px;"></div>
              </Show>
              {/* {selection()[c] ? "yep" : "nope"} */}
              <div classList={{
                "Card": true,
                "Card--selected": selection()[c] ? true : false
                }} onclick={() => {toggleSelect(c)}}><Card val={c} />
                {/* TODO: instead of showing player handles, give them colors for the scoreboard
                    and show colored dots for each player. */}
                <div class="Card-PlayerSelections">
                  <PlayerDot n={100} />
                  <For each={players()}>{(p, i) =>
                    <Show when={playerSelections()[c]?.find(x => x === p.handle)}>
                      <PlayerDot n={i()} />
                    </Show>
                  }</For>
                </div>
                {/* <For each={playerSelections()[c]}>{(p, i) =>
                  <Show when={p !== playerHandle()}>
                    <p>{p}</p>
                  </Show>
                }</For> */}
              </div>
              </>
          }</For>
          </div>
          <Show when={gameState() === GameState.Frozen}>
            <p>Set found!</p>
          </Show>
          <div class="Hadron64-Scores">
            <For each={players()}>{(p, i) =>
              <>
                <PlayerDot n={i()} /> {p.handle}: {scores()[p.uuid]}, 
              </>
            }</For>
          </div>
        </Match>
        <Match when={gameState() === GameState.Finished}>
          <h2>Final Scores:</h2>
          <div class="Hadron64-Scores">
            <For each={players()}>{(p, i) =>
              <>
                <PlayerDot n={i()} /> {p.handle}: {scores()[p.uuid]}, 
              </>
            }</For>
            If host, play again?
          </div>
        </Match>
      </Switch>
      <Show when={errorMessage() !== null}>
        Error! {errorMessage()}
      </Show>
    </>
	)
}

export default Hadron64
