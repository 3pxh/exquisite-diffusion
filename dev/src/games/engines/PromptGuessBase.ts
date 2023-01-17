import { supabase } from '../../supabaseClient'
import { EngineBase, Room } from './EngineBase'
import { AbstractPlayerBase, Score } from './types';

type Player = AbstractPlayerBase<{
  state?: State,
}>

type Message = {
  type: "Generation" | "NewPlayer" | "PlayerState" | "CaptionResponse" | "CaptionVote",
  player: Player,
  generation?: Generation,
  caption?: string,
  vote?: Player['uuid'],
  state?: State,
  // Engine versioning?
}

type Generation = {
  player: Player,
  generationType: "list" | "image" | "text",
  prompt: string,
  text?: string,
  image?: string,
  gisticlePrefix?: string,
}

export enum State {
  Lobby,
  WritingPrompts, 
  CreatingLies,
  Voting,
  Scoring,
  Finished,
  Waiting, // Players only
}

type Caption = {
  player: Player['uuid'],
  caption: string,
}

type Vote = {
  voter: Player['uuid'],
  author: Player['uuid'],
}


type GameState = {
  roomState: State,
  playerState: State,
  history: Message[],
  players: Player[],
  generations: Generation[],
  captions: Caption[],
  votes: Vote[],
  scores: Score[],
  round: number,
}

function initState(): GameState {
  return {
    roomState: State.Lobby,
    playerState: State.Lobby,
    history: [],
    players: [],
    generations: [],    
    captions: [],
    votes: [],
    scores: [],
    round: 1,
  }
}

export class PromptGuessGameEngine extends EngineBase<GameState, Message> {

  constructor(init: Room) {
    super({...init, initState: initState()});
    super.registerClientReducer((oldState: GameState, newState: GameState) => {
      this.setGameState({
        ...newState,
        playerState: oldState.roomState !== newState.roomState ? newState.roomState : oldState.playerState
      });
      if (oldState.roomState !== newState.roomState) {
        // This feels wrong...
        super.sendClientMessage({
          type: "PlayerState",
          player: {uuid: this.userId, handle: "anonymous"},
          state: newState.roomState,
        });
      }
      console.log("room states", oldState.roomState, newState.roomState)
    })
    super.registerHostReducer((gs: GameState, m: Message) => {
      console.log("#player", gs.players.length, "type", m.type);
      gs.history = [...gs.history, m]; // For debugging.
      if (m.type === "NewPlayer") {
        gs.players = [...gs.players, m.player];
      } else if (m.type === "Generation") {
        gs.generations = [...gs.generations, m.generation!];
        if (gs.generations.length === gs.players.length) {
          this.setHostState(gs, State.CreatingLies);
        }
      } else if (m.type === "CaptionResponse") {
        gs.captions = [...gs.captions, {
          player: m.player.uuid,
          caption: m.caption!
        }];
        if (gs.captions.length === gs.players.length - 1) {
          this.setHostState(gs, State.Voting);
        }
      } else if (m.type === "CaptionVote") {
        gs.votes = [...gs.votes, {
          voter: m.player.uuid,
          author: m.vote!
        }];
        if (gs.votes.length === gs.players.length - 1) {
          this.setHostState(gs, State.Scoring);
        }
      } else if (m.type === "PlayerState") {
        gs.players = gs.players.map(p => {
          if (p.uuid === m.player.uuid) {
            p.state = m.state!;
          }
          return p;
        });
      }
    });
    if (init.isHost) {
      // We _could_ send a client message, but the subscription actually takes a few seconds...
      super.mutateAndBroadcastGameState((gs: GameState) => {
        gs.players = [...gs.players, {uuid: init.userId, handle: 'host'}];
      })
    } else {
      super.sendClientMessage({
        type: "NewPlayer",
        player: {uuid: this.userId, handle: "anonymous"},
      });
    }
  }

  setHostState(gs: GameState, s: State) {
    // This feels clumsy.
    gs.roomState = s;
    gs.playerState = s;
    gs.players = gs.players.map(p => {
      if (p.uuid === this.userId) {
        p.state = s;
      }
      return p;
    });
  }

  async startGame() {
    super.mutateAndBroadcastGameState((gs: GameState) => {
      // TODO: Initialize scores.
      this.setHostState(gs, State.WritingPrompts);
    })
  }

  setPlayerState(s: State) {
    super.mutateGameState((gs: GameState) => {
      gs.playerState = s;
    });
    super.sendClientMessage({
      type: "PlayerState",
      player: {uuid: this.userId, handle: "anonymous"},
      state: s,
    });
  }

  async generate(prompt: string) {
    this.setPlayerState(State.Waiting);
    const { data, error } = await supabase.functions.invoke("generate", {
      body: JSON.stringify({
        room: this.roomId,
        // TODO: add user names back in. Could get via auth context? Hm.
        player: {uuid: this.userId, handle: "anonymous"},
        prompt: prompt,
        generationType: "text",
      })
    });
    if (data.error || error) {
      const e = data.error || error;
      EngineBase.onError({name: "Error generating prompt", prompt, e});
      this.setPlayerState(State.WritingPrompts);
    }
  }

  caption(c: string) {
    this.setPlayerState(State.Waiting);
    // TODO: do we want to try/catch here and revert on errors?
    super.sendClientMessage({
      type: "CaptionResponse",
      player: {uuid: this.userId, handle: "anonymous"},
      caption: c
    });
  }

  vote(v: Player['uuid']) {
    this.setPlayerState(State.Waiting);
    // TODO: do we want to try/catch here and revert on errors?
    super.sendClientMessage({
      type: "CaptionVote",
      player: {uuid: this.userId, handle: "anonymous"},
      vote: v
    });
  }

}
