import { supabase } from '../../supabaseClient'
import { createSignal, Accessor, Setter } from 'solid-js'

import { createStore } from "solid-js/store";
import type { StoreNode, Store, SetStoreFunction } from "solid-js/store";



// Engine should be parameterized by types:
// - GameState (enum), RoomData, MessageTypes?

export type Engine<GameState, RoomData, Message> = {
  handlers: Map<string, (...args: any) => void>, // should really be a Map of names?
  hostReducers: Array<(m: Message) => GameState | null>, // these get called on each host subscription
  clientReducers: Array<(r: RoomData) => GameState | null>, // these get called on each host subscription
  sendClientMessage: (m: Message) => void, // include error handling?
  sendHostMessage: (r: RoomData) => void, // include error handling?
}

type Reducer<GameState, T> = (g: GameState, t: T) => GameState | null;

export class EngineBase<GameState, Room, Message> {
  roomId: number
  isHost: boolean
  clientReducers: Reducer<GameState, Room>[]
  hostReducers: Reducer<GameState, Message>[]
  gameState: GameState
  setGameState: SetStoreFunction<GameState>

  constructor(roomId: number, isHost: boolean, initState: GameState) {
    // Set up subscriptions
    this.roomId = roomId;
    this.isHost = isHost;
    const [gameState, setGameState] = createStore(initState)
    this.gameState = gameState;
    this.setGameState = setGameState;
    
    this.clientReducers = [];
    this.hostReducers = [];

    this.subscribeToRoom(roomId);
    this.subscribeToMessages(roomId);
  }

  subscribeToRoom(roomId: number) {
    supabase.channel(`public:rooms:id=eq.${roomId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
      }, data => {
        this.#runClientReducers(data.new as unknown as Room)
      }).subscribe();
    // Load in the initial game state by fetching the room once, allows re-joining.
    supabase.from('rooms').select(`*`).eq('id', roomId).single().then(({ data, error, status }) => {
      // TODO: how could we register various named error handlers?
      this.#runClientReducers(data.new);
    });
  }

  #runClientReducers(r: Room) {
    this.setGameState((gs: GameState) => {
      let updatedGameState = gs;
      this.clientReducers.forEach((cr) => {
        const reducedState = cr(updatedGameState, r);
        if (reducedState !== null) {
          updatedGameState = reducedState;
        }
      });
      return updatedGameState;
    });
  }

  subscribeToMessages(roomId: number) {
    supabase.channel(`public:messages:room=eq.${roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${roomId}` 
      }, payload => {
        this.#runHostReducers(payload.new as unknown as Message);
      });
    // TODO: every time the host gets a message, note the id on the room (last_message_id)
    //       could potentially do this by including a "last read" host reducer...
    // TODO: Load all messages that happened after the last read message by the host (indicated on Room)
  }

  #runHostReducers(m: Message) {
    this.setGameState((gs: GameState) => {
      let updatedGameState = gs;
      this.hostReducers.forEach((hr) => {
        const reducedState = hr(updatedGameState, m);
        if (reducedState !== null) {
          updatedGameState = reducedState;
        }
      });
      return updatedGameState;
    });
  }


  // Registering a client/host reducer puts it on the array
}

