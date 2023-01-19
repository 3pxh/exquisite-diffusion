import { createSignal, Accessor, Setter, JSX } from 'solid-js'
import { supabase } from '../../supabaseClient'
import { EngineBase, Room } from './EngineBase'
import { AbstractPlayerBase, Score } from './types';

export type Player = AbstractPlayerBase<{
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
  url?: string,
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
  scores: Record<Player["id"], PGScore>,
  round: number,
  version: "1.0.0",
}

function initState(): GameState {
  return {
    roomState: State.Lobby,
    generations: [],    
    captions: [],
    votes: [],
    scores: {},
    round: 1,
    version: "1.0.0",
  }
}

const shuffle = <T,>(A: T[]) => {
  return A.map(value => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
}

export class PromptGuessGameEngine extends EngineBase<GameState, Message, Player> {
  gameName: string

  constructor(init: Room) {
    super({...init, initState: initState()});
    this.gameName = "False Starts";

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
          gs.generations = shuffle([...gs.generations]);
          this.setHostState(State.CreatingLies);
        }
      } else if (m.type === "CaptionResponse") {
        gs.captions = [...gs.captions, {
          player: m.player.id,
          caption: m.caption!
        }];
        if (gs.captions.length === this.players().length - 1) {
          gs.captions = shuffle([...gs.captions, {
            player: gs.generations[0].player.id,
            caption: gs.generations[0].prompt,
          }]);
          this.setHostState(State.Voting);
        }
      } else if (m.type === "CaptionVote") {
        gs.votes = [...gs.votes, {
          voter: m.player.id,
          author: m.vote!
        }];
        if (gs.votes.length === this.players().length - 1) {
          const scoreMutation = (gs: GameState) => {
            const scoreDeltas:Record<Player["id"], PGScore> = {};
            gs.votes.forEach(v => {
              if (v.author === gs.generations[0].player.id) {
                gs.scores[v.voter].iVoteTruth += 1;
                gs.scores[v.voter].previous = gs.scores[v.voter].current;
                gs.scores[v.voter].current += 1000;

                gs.scores[v.author].myTruthsVoted += 1;
                gs.scores[v.author].previous = gs.scores[v.author].current;
                gs.scores[v.author].current += 1000;
              } else {
                gs.scores[v.voter].iVoteLies += 1;

                gs.scores[v.author].myLiesVoted += 1;
                gs.scores[v.author].previous = gs.scores[v.author].current;
                gs.scores[v.author].current += 500;
              }
            })
          }
          this.setHostState(State.Scoring, scoreMutation);
        }
      }
    });
    super.updatePlayer({
      state: State.Lobby,
    });
  }

  renderPrompt(): JSX.Element {
    return <h2>Make something fun</h2>
  }

  renderGenerationPrompt(g: Generation): JSX.Element {
    return <></>
  }

  renderGeneration(g: Generation): JSX.Element {
    return <h3 style="white-space: pre-wrap;">{g.text}</h3>;
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

  async startGame(hostName: string) {
    if (hostName) {
      this.updatePlayer({ handle: hostName });
      // TODO: Otherwise let's continue as a non-player host?
    }
    this.setHostState(State.WritingPrompts, (gs: GameState) => {
      const initScores:Record<Player["id"], PGScore> = {}
      this.players().forEach(p => {
        initScores[p.id] = {
          player: p.id, 
          current: 0, 
          previous: 0,
          myLiesVoted: 0,
          myTruthsVoted: 0,
          iVoteLies: 0,
          iVoteTruth: 0,
        };
      })
      gs.scores = initScores;
    });
  }

  setPlayerState(s: State) {
    this.setError(''); // This makes a lot of assumptions about control flow
    if (this.player().state !== s) {
      super.updatePlayer({ state: s });
    }
  }

  continueAfterScoring() {
    this.setHostState(State.CreatingLies, (gs: GameState) => {
      gs.generations = gs.generations.slice(1);
      gs.votes = [];
      gs.captions = [];
      if (gs.generations.length === 0 && gs.round === 3) {
        gs.roomState = State.Finished;
        this.setHostState(State.Finished);
      } else if (gs.generations.length === 0 && gs.round < 3) {
        gs.round += 1;
        gs.roomState = State.WritingPrompts;
        this.setHostState(State.WritingPrompts);
      } else {
        gs.roomState = State.CreatingLies;
      }
    });
  }

  async generateApi(prompt: string) {
    const { data, error } = await supabase.functions.invoke("generate", {
      body: JSON.stringify({
        room: this.roomId,
        player: this.player(),
        prompt: prompt,
        generationType: "text",
      })
    });
    return {data, error}
  }

  async generate(prompt: string) {
    this.setPlayerState(State.Waiting);
    const { data, error } = await this.generateApi(prompt);
    if (data.error || error) {
      const e = data.error || error;
      this.setPlayerState(State.WritingPrompts);
      this.onError({
        name: "Error generating prompt", 
        display: e,
        error: {prompt, e: e}
      });
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

export class PGImageEngine extends PromptGuessGameEngine {
  constructor(init: Room) {
    super({...init});
    this.gameName = "Farsketched";
  }

  renderGeneration(g: Generation) {
    return <img src={g.url!} />
  }

  async generateApi(prompt: string) {
    const { data, error } = await supabase.functions.invoke("generate", {
      body: JSON.stringify({
        room: this.roomId,
        player: this.player(),
        prompt: prompt,
        generationType: "image",
      })
    });
    return {data, error}
  }
}

const chooseOne = <T,>(A: T[]) => {
  return A[Math.floor(Math.random() * A.length)];
}

export class PGGisticleEngine extends PromptGuessGameEngine {
  static TEMPLATES = [
    "List the top 5 best",
    "List the top 5 reasons you should",
    "List the top 5 most ridiculous ways to",
    "List the top 5 most obvious signs",
  ]
  prefix: Accessor<string>
  setPrefix: Setter<string>

  constructor(init: Room) {
    super({...init});
    this.gameName = "Gisticle";
    [this.prefix, this.setPrefix] = createSignal<string>(chooseOne(PGGisticleEngine.TEMPLATES))
  }

  setPlayerState(s: State) {
    if (this.player().state !== s && s === State.WritingPrompts) {
      this.setPrefix(chooseOne(PGGisticleEngine.TEMPLATES));
    }
    super.setPlayerState(s);
  }

  renderPrompt(): JSX.Element {
    return <h2>{this.prefix()}...</h2>
  }

  renderGenerationPrompt(g: Generation) {
    return <>
      <h3>{g.gisticlePrefix} ___</h3>
    </>
  }

  renderGeneration(g: Generation) {
    return <>
      <h3 style="white-space: pre-wrap;">{g.text}</h3>
    </>
  }

  async generateApi(prompt: string) {
    const { data, error } = await supabase.functions.invoke("generate", {
      body: JSON.stringify({
        room: this.roomId,
        player: this.player(),
        prompt: prompt,
        generationType: "list",
        gisticlePrefix: this.prefix(),
      })
    });
    return {data, error}
  }
}