import { supabase } from '../../supabaseClient'

import { createStore, produce, SetStoreFunction, unwrap } from "solid-js/store";

import { AbstractPlayer2 } from './types';

// Currently these mutate the game state rather than returning,
// not sure if there's a more pure way with solid stores.
// Alternatively we could switch over to a redux store.
// This will do for now.
type Reducer<GameState, T> = (g: GameState, message: T) => void

export type Room = {
  roomId: number, // TODO: make this optional so we can create it?
  userId: string,
  isHost: boolean,
  shortcode: string,
}

export type GameInstance<GameState> = Room & {
  initState: GameState
}

export class EngineBase<GameState, Message> {
  roomId: number
  userId: string
  isHost: boolean
  hostReducers: Reducer<GameState, Message>[]
  clientReducers: Reducer<GameState, GameState>[]
  players: AbstractPlayer2[]
  setPlayers: SetStoreFunction<AbstractPlayer2[]>
  gameState: GameState
  setGameState: SetStoreFunction<GameState>

  constructor(gameInit: GameInstance<GameState>) {
    this.roomId = gameInit.roomId;
    this.userId = gameInit.userId;
    this.isHost = gameInit.isHost;
    // Do not ask about the type fuckery here... sigh.
    const [gameState, setGameState] = createStore(gameInit.initState as object & GameState)
    this.gameState = gameState;
    this.setGameState = setGameState;
    
    this.hostReducers = [];
    this.clientReducers = [];
    [this.players, this.setPlayers] = createStore([] as AbstractPlayer2[]);

    this.subscribeToParticipants(gameInit.roomId);

    if (gameInit.isHost) { 
      // Right now room creation is taken care of by GameSelection.tsx
      this.initRoom();
      this.subscribeToMessages(gameInit.roomId); 
    } else {
      this.subscribeToRoom(gameInit.roomId);
    }
  }

  async initRoom() {
    let { data, error, status } = await supabase.from('rooms').update({
      data: this.gameState,
    }).eq('id', this.roomId).select();
    if (error) {
      EngineBase.onError({name: "Could not init room", error});
    }
  }

  subscribeToParticipants(roomId: number) {
    supabase.channel(`public:participants:room=eq.${roomId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'participants', filter: `room=eq.${roomId}` 
      }, data => {
        console.log("participant update", data.new);
        const playerIndex = this.players.findIndex(p => p.id === data.new.id);
        if (playerIndex >= 0) {
          this.setPlayers(this.players.findIndex(p => p.id === data.new.id), data.new);
        }
      }).subscribe();
    supabase.channel(`public:participants:room=eq.${roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'participants', filter: `room=eq.${roomId}` 
      }, data => {
        this.setPlayers([...this.players, data.new as AbstractPlayer2]);
      }).subscribe();
    supabase.from('participants').select(`*`).eq('room', roomId).then(({ data, error, status }) => {
      this.setPlayers(data ? [...data] : [])
    });
  }

  subscribeToRoom(roomId: number) {
    supabase.channel(`public:rooms:id=eq.${roomId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
      }, data => {
        this.#runClientReducers(data.new.data as unknown as GameState)
      }).subscribe();
    // Load in the initial game state by fetching the room once, allows re-joining.
    supabase.from('rooms').select(`*`).eq('id', roomId).single().then(({ data, error, status }) => {
      // TODO: how could we register various named error handlers?
      this.#runClientReducers(data.data ?? {} as unknown as GameState);
    });
  }

  #runClientReducers(newGameState: GameState) {
    // this.setGameState(g);
    this.setGameState(produce((oldGameState: GameState) => {
      this.clientReducers.forEach((cr) => {
        cr(oldGameState, newGameState);
      });
    }));
  }

  sendClientMessage(m: Message) {
    console.log("sending", m)
    supabase.from('messages').insert({
      room: this.roomId,
      user_id: this.userId, // Needed for RLS
      data: m,
    }).then(({ data, error, status }) => {
      if (error) { EngineBase.onError({name: "Could not send client message", error}); }
    });
  }

  subscribeToMessages(roomId: number) {
    supabase.channel(`public:messages:room=eq.${roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${roomId}` 
      }, payload => {
        this.#runHostReducers(payload.new.data as unknown as Message);
        this.#sendHostUpdate();
    }).subscribe();

    // TODO: every time the host gets a message, note the id on the room (last_message_id)
    //       could potentially do this by including a "last read" host reducer...
    // TODO: Load all messages that happened after the last read message by the host (indicated on Room)
    // supabase.from('messages').select(`*`).eq('room', this.roomId).then(({ data, error, status }) => {
    // })
  }

  #runHostReducers(m: Message) {
    this.setGameState(produce((gs: GameState) => {
      this.hostReducers.forEach((hr) => {
        hr(gs, m)
      });
    }));
  }

  mutateGameState(f: (gs: GameState) => void) {
    this.setGameState(produce(f));
  }

  mutateAndBroadcastGameState(f: (gs: GameState) => void) {
    if (!this.isHost) {
      EngineBase.onError({name: "Trying to broadcast game state but not a host."})
    } else {
      this.setGameState(produce(f));
      this.#sendHostUpdate();
    }
  }

  #sendHostUpdate() {
    supabase.from('rooms').update({
      data: { 
        ...unwrap(this.gameState), 
        timestamp: (new Date()).getTime(),
      },
    }).eq('id', this.roomId).select().then(({ data, error, status }) => {
      if (error) { EngineBase.onError({name: "Could not send host update", error}); }
    });
  }

  registerHostReducer(r: Reducer<GameState, Message>) {
    this.hostReducers.push(r);
  }
  registerClientReducer(r: Reducer<GameState, GameState>) {
    this.clientReducers.push(r);
  }

  static onError(e: any) {
    console.error(e);
  }

}

