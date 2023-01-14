import { EngineBase, Room } from './EngineBase'

type Message = {
  name: "Hello" | "Goodbye",
  count: number,
}

type GameState = {
  history: Message[],
  numClicks: number,
}

function initState(): GameState {
  return {
    history: [{name:"Hello",count:5}],
    numClicks: 0,
  }
}

export class PromptGuessGameEngine extends EngineBase<GameState, Message> {

  constructor(init: Room) {
    super({...init, initState: initState()});
    super.registerHostReducer((gs: GameState, m: Message) => {
      if (m.name === "Hello") {
        gs.history = [...gs.history, m];
      }
    })
    super.registerHostReducer((gs: GameState, m: Message) => {
      if (m.name === "Hello" || m.name === "Goodbye") {
        gs.numClicks += 1;
      }
    })
  }

  async hello() {
    super.sendClientMessage({name: "Hello", count: Math.random()})
  }

  async goodbye() {
    super.sendClientMessage({name: "Goodbye", count: Math.random()})
  }

}
