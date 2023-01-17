import { createEffect } from 'solid-js';
import { supabase } from '../../supabaseClient'
import { EngineBase, Room } from './EngineBase'
import { AbstractPlayerBase, Score } from './types';

type Player = AbstractPlayerBase<{
  handle?: string,
  state?: State,
  avatar?: string,
}>

type Message = {
  type: "Generation" | "CaptionResponse" | "CaptionVote",
  player: Player,
  generation?: Generation,
  caption?: string,
  vote?: Player['id'],
  state?: State,
  // If we want to be able to replay historic games, we'll need to know the engine.
  version: "1.0.0",
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
  player: Player['id'],
  caption: string,
}

type Vote = {
  voter: Player['id'],
  author: Player['id'],
}

type PGScore = Score & {
  // These are all counts, used for achievements at the end.
  myLiesVoted: number,
  myTruthsVoted: number,
  iVoteLies: number,
  iVoteTruth: number,
}

type GameState = {
  roomState: State,
  generations: Generation[],
  captions: Caption[],
  votes: Vote[],
  scores: PGScore[],
  round: number,
  version: "1.0.0",
}

function initState(): GameState {
  return {
    roomState: State.Lobby,
    generations: [],    
    captions: [],
    votes: [],
    scores: [],
    round: 1,
    version: "1.0.0",
  }
}

export class PromptGuessGameEngine extends EngineBase<GameState, Message, Player> {
  constructor(init: Room) {
    super({...init, initState: initState()});

    super.registerClientReducer((oldState: GameState, newState: GameState) => {
      // WARNING: the order of these lines is important. 
      // Somehow moving setGameState above will break setPlayerState.
      if (oldState.roomState !== newState.roomState) {
        this.setPlayerState(newState.roomState);
      }
      this.setGameState(newState);
    });
    
    super.registerHostReducer((gs: GameState, m: Message) => {
      if (m.type === "Generation") {
        gs.generations = [...gs.generations, m.generation!];
        if (gs.generations.length === this.players().length) {
          this.setHostState(State.CreatingLies);
        }
      } else if (m.type === "CaptionResponse") {
        gs.captions = [...gs.captions, {
          player: m.player.id,
          caption: m.caption!
        }];
        if (gs.captions.length === this.players().length - 1) {
          this.setHostState(State.Voting);
        }
      } else if (m.type === "CaptionVote") {
        gs.votes = [...gs.votes, {
          voter: m.player.id,
          author: m.vote!
        }];
        if (gs.votes.length === this.players().length - 1) {
          this.setHostState(State.Scoring);
        }
      }
    });
    super.updatePlayer({
      state: State.Lobby,
    });
  }

  setHostState(s: State, mutation?: (gs: GameState) => void) {
    this.setPlayerState(s);
    super.mutateAndBroadcastGameState((gs: GameState) => {
      gs.roomState = s;
      if (mutation) {
        mutation(gs);
      }
    })
  }

  async startGame() {
    this.setHostState(State.WritingPrompts, (gs: GameState) => {
      gs.scores = this.players().map(p => {
        return {
          player: p.id, 
          current: 0, 
          previous: 0,
          myLiesVoted: 0,
          myTruthsVoted: 0,
          iVoteLies: 0,
          iVoteTruth: 0,
        };
      })
    });
  }

  setPlayerState(s: State) {
    if (this.player().state !== s) {
      super.updatePlayer({ state: s });
    }
  }

  async generate(prompt: string) {
    this.setPlayerState(State.Waiting);
    const { data, error } = await supabase.functions.invoke("generate", {
      body: JSON.stringify({
        room: this.roomId,
        player: this.player(),
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
    super.sendClientMessage({
      type: "CaptionResponse",
      player: this.player(),
      caption: c,
      version: "1.0.0",
    });
  }

  vote(v: Player['id']) {
    this.setPlayerState(State.Waiting);
    super.sendClientMessage({
      type: "CaptionVote",
      player: this.player(),
      vote: v,
      version: "1.0.0",
    });
  }

}
