import { createSignal, Accessor, Setter, JSX } from 'solid-js'
import { supabase } from '../../supabaseClient'
import { EngineBase, Room } from './EngineBase'
import { AbstractPlayerBase, Score } from './types';
import { Timer, TimerSerial } from './Timer'
import { unwrap } from 'solid-js/store';

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
  timer: TimerSerial,
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
    timer: Timer.initState()
  }
}

const shuffle = <T,>(A: T[]) => {
  return A.map(value => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
}

export class PromptGuessGameEngine extends EngineBase<GameState, Message, Player> {
  gameName: string
  timer: Timer
  mutationMap: Record<State, (gs: GameState) => void>

  constructor(init: Room) {
    super({...init, initState: initState()});
    this.gameName = "False Starts";
    this.timer = new Timer();
    const noop = (gs: GameState) => {};
    this.mutationMap = {
      [State.Lobby]: noop,
      [State.Finished]: noop,
      [State.WritingPrompts]: noop,
      [State.Waiting]: noop,
      [State.CreatingLies]: this.generationMutation,
      [State.Voting]: this.captionMutation,
      [State.Scoring]: this.scoreMutation,
    }

    super.registerClientReducer((oldState: GameState, newState: GameState) => {
      // WARNING: the order of these lines is important. 
      // Somehow moving setGameState above will break setPlayerState.
      if (oldState.roomState !== newState.roomState) {
        this.setPlayerState(newState.roomState);
      }
      this.setGameState(newState);
      this.timer.setFromSerial(newState.timer, this.outOfTime);
    });
    
    super.registerHostReducer((gs: GameState, m: Message) => {
      if (m.type === "Generation") {
        gs.generations = [...gs.generations, m.generation!];

        // If we had nothing before, but aren't in WritingPrompts 
        // then everyone submitted late and we need to set the timer
        // by reaffirming the host state.
        // Yet somehow this doesn't start the timer.
        // if (gs.generations.length === 1 &&
        //     gs.roomState !== State.WritingPrompts) {
        //   this.setHostState(State.CreatingLies);
        // }
        // If we've already moved on from writing the append is good (and silent).
        // If we try to set host state again, it will shuffle.
        if (gs.generations.length === this.players().length &&
            gs.roomState === State.WritingPrompts) {
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

  toggleTimer = (isEnabled: boolean) => {
    this.timer.setEnabled(isEnabled);
    this.mutateAndBroadcastGameState((gs) => {
      gs.timer = this.timer.serialize();
    });
  }

  generationMutation = (gs: GameState) => {
    gs.generations = shuffle([...gs.generations]);
  }

  captionMutation = (gs: GameState) => {
    gs.captions = shuffle([...gs.captions, {
      player: gs.generations[0].player.id,
      caption: gs.generations[0].prompt,
    }]);
  }

  scoreMutation = (gs: GameState) => {
    const scoreDeltas:Record<Player["id"], PGScore> = {};
    Object.entries(gs.scores).forEach(([k, v]: [string, PGScore]) => {
      gs.scores[k].previous = gs.scores[k].current
    })
    gs.votes.forEach(v => {
      if (v.author === gs.generations[0].player.id) {
        gs.scores[v.voter].iVoteTruth += 1;
        gs.scores[v.voter].current += 1000;

        gs.scores[v.author].myTruthsVoted += 1;
        gs.scores[v.author].current += 1000;
      } else {
        gs.scores[v.voter].iVoteLies += 1;
        gs.scores[v.author].myLiesVoted += 1;
        gs.scores[v.author].current += 500;
      }
    })
  }

  outOfTime() {
    // TODO: we need to do all of the transitiony things that we were doing in host reducer.
    if (this.isHost) {
      console.log("out of time", unwrap(this.gameState.roomState))
      switch(unwrap(this.gameState.roomState)) {
        case State.WritingPrompts:
          this.setHostState(State.CreatingLies);
          break;
        case State.CreatingLies:
          this.setHostState(State.Voting);
          break;
        case State.Voting:
          this.setHostState(State.Scoring);
          break;
      }
    }
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
    if (s === State.WritingPrompts) {
      this.timer.countdown(35000, 2000, () => { this.outOfTime() });
    } else if (s === State.CreatingLies) {
      if (unwrap(this.gameState.generations.length) > 0) {
        this.timer.countdown(35000, 2000, () => { this.outOfTime() });
      }
    } else if (s === State.Voting) {
      this.timer.countdown(25000, 2000, () => { this.outOfTime() });
    } else {
      this.timer.unset();
    }
    this.setPlayerState(s);
    super.mutateAndBroadcastGameState((gs: GameState) => {
      gs.roomState = s;
      gs.timer = this.timer.serialize();
      if (mutation) {
        mutation(gs);
      }
      this.mutationMap[s](gs);
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
        template: "$1"
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

  renderPrompt(): JSX.Element {
    return <h2>Make a picture of...</h2>
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
        generationType: "text",
        template: `${this.prefix()} $1, don't explain why \n\n`,
      })
    });
    return {data, error}
  }
}

export class Tresmojis extends PromptGuessGameEngine {
  static TEMPLATE = "List 3 emojis to describe \"$1\" (don't explain why)\n\n"

  constructor(init: Room) {
    super({...init});
    this.gameName = "Tresmojis";
  }


  renderPrompt(): JSX.Element {
    return <h2>List 3 emojis to describe...</h2>
  }

  renderGenerationPrompt(g: Generation) {
    return <>
      <h3>List 3 emojis to describe ___</h3>
    </>
  }

  renderGeneration(g: Generation) {
    return <>
      <span style="font-size:64pt;">{g.text?.trim().replaceAll(',', '').replaceAll(' ', '').replace(/[0-9]/g, '')}</span>
    </>
  }

  async generateApi(prompt: string) {
    console.log("GENERATE TRESMOJI!")
    const { data, error } = await supabase.functions.invoke("generate", {
      body: JSON.stringify({
        room: this.roomId,
        player: this.player(),
        prompt: prompt,
        generationType: "text",
        template: Tresmojis.TEMPLATE,
      })
    });
    return {data, error}
  }
}