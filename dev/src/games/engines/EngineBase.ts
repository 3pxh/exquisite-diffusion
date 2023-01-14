import { supabase } from '../../supabaseClient'

import { createStore, produce, SetStoreFunction, unwrap } from "solid-js/store";

// Currently these mutate the game state rather than returning,
// not sure if there's a more pure way with solid stores.
// Alternatively we could switch over to a redux store.
// This will do for now.
type Reducer<GameState, T> = (g: GameState, message: T) => void

export type Room = {
  roomId: number, // TODO: make this optional so we can create it?
  userId: string,
  isHost: boolean,
}

export type GameInstance<GameState> = Room & {
  initState: GameState
}

export class EngineBase<GameState, Message> {
  roomId: number
  userId: string
  isHost: boolean
  hostReducers: Reducer<GameState, Message>[]
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
    } else {
      // await supabase.from('participants').insert({
      //   user: this.userId,
      //   room: data?.id,
      // });
    }
  }

  subscribeToRoom(roomId: number) {
    supabase.channel(`public:rooms:id=eq.${roomId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
      }, data => {
        this.#handleClientUpdate(data.new.data as unknown as GameState)
      }).subscribe();
    // Load in the initial game state by fetching the room once, allows re-joining.
    supabase.from('rooms').select(`*`).eq('id', roomId).single().then(({ data, error, status }) => {
      // TODO: how could we register various named error handlers?
      this.#handleClientUpdate(data.data ?? {} as unknown as GameState);
    });
  }

  #handleClientUpdate(g: GameState) {
    this.setGameState(g);
  }

  async sendClientMessage(m: Message) {
    let { data, error, status } = await supabase.from('messages').insert({
      room: this.roomId,
      user_id: this.userId, // Needed for RLS
      data: m,
    });
    if (error) { EngineBase.onError({name: "Could not send client message", error}); }
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
      // gs.history = [...gs.history, m];
      this.hostReducers.forEach((hr) => {
        hr(gs, m)
      });
    }));
  }

  async #sendHostUpdate() {
    let { data, error, status } = await supabase.from('rooms').update({
      data: { 
        ...unwrap(this.gameState), 
        timestamp: (new Date()).getTime(),
      },
    }).eq('id', this.roomId).select();
    if (error) { EngineBase.onError({name: "Could not send host update", error}); }
  }

  registerHostReducer(r: Reducer<GameState, Message>) {
    this.hostReducers.push(r);
  }

  static onError(e: any) {
    console.error(e);
  }

}

