import { Component, createSignal, For, createEffect } from 'solid-js'
import { supabase } from './supabaseClient'
import { useAuth } from "./AuthProvider";

interface Message {
  player: string,
  text: string,
}

const HTML_PLAYER_COLORS = [
    "#ff0000", // red
    "#0000ff", // blue
    "#00ff00", // green
    "#ff7000", // orange (that's right!)
    "#ffff70", // yellow
    "#ff00ff", // purple
]

const getHtmlPlayerStyle = index => {
    if (index == -1) {
        return "color:#ffffff" // Use white for unknown player/error
    }
    return "color:" + HTML_PLAYER_COLORS[index % HTML_PLAYER_COLORS.length];
}

const Chatroom: Component<{roomId: number}> = (props) => {
  const { session, playerHandle } = useAuth();

  const [messages, setMessages] = createSignal<Message[]>([])
  const [uuidToPlayerIndex, setUuidToPlayerIndex] = createSignal<{ [key: string]: number }>({})
  const [isOpen, setIsOpen] = createSignal<boolean>(true)

  var uuid_to_room_index = {};

  createEffect(async () => {
    const el = document.getElementById("Chatroom-Messages");
    if (el) { el.scrollTop = el.scrollHeight; }
    console.log("subscribing to messages", props.roomId);
    supabase
      .channel(`public:chats:room_id=eq.${props.roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'chats', filter: `room_id=eq.${props.roomId}` 
      }, payload => {
        const el = document.getElementById("Chatroom-Messages");
        const wasScrolledDown = true;//el ? el.scrollTop + el.clientHeight >= el.scrollHeight : false;
        setMessages(messages().concat({text: payload.new.message.text, player: payload.new.message.player.handle}));
        if (el && wasScrolledDown) { // Not closed.
          el.scrollTop = el.scrollHeight;
        }
      }).subscribe();

    const updateUuidTable = async payload => {
        const participants = await supabase.from('participants').select(`user`).eq('id', props.roomId).data;
        console.log(`Got participants ${participants}`)
        const new_uuid_to_player_index : { [key: string]: int} = {};
        for (var i = 0; i < participants.length; i++) {
            console.log(`Player ${i} is ${participants[i].user}`)
            new_uuid_to_player_index[participants[i].user] = i;
        }
        setUuidToPlayerIndex(new_uuid_to_player_index);
    };
    updateUuidTable();

    supabase
      .channel(`public:participants:room_id=eq.${props.roomID}`)
      .on('postgress_changes', {
        event: 'INSERT', schema: 'public', table: 'chats', filter: `room_id=eq.${props.roomId}` 
        // TODO: we also want this for delete.
        // Also, this solution is imperfect because if a player gets deleted the colors of subsequent players
        // rotate back.
      }, updateUuidTable).subscribe();
  })

  const sendMessage = async () => {
    const m = (document.getElementById("Chatroom-newMessage") as HTMLInputElement).value;
    (document.getElementById("Chatroom-newMessage") as HTMLInputElement).value = "";
    const msg = {
      room_id: props.roomId,
      user_id: session()?.user.id,
      message: {text: m, player: {handle: playerHandle(), uuid: session()?.user.id}, style: {}}
    };
    await supabase.from('chats').insert(msg);
  }

  const toggleOpen = () => {
    setIsOpen(!isOpen());
    if (isOpen()) {
      const el = document.getElementById("Chatroom-Messages")!;
      el.scrollTop = el.scrollHeight;
    }
  }

  return (
    <div id="Chatroom">
      <div id="Chatroom-Header">
        <button onclick={toggleOpen} > {isOpen() ? "↘" : "↖"}</button>
      </div>
      {isOpen() ? <>
        <div id="Chatroom-Messages">
          <For each={messages()}>{(m, i) =>
            <p>
              <strong style={getHtmlPlayerStyle(uuidToPlayerIndex()[m.player.uuid] ?? -1)} > {m.player}:</strong>
              {m.text}
            </p>
          }</For>
        </div> 
        <div id="Chatroom-Input">
          <span>{playerHandle()}:</span>
          <input onkeydown={(e) => {e.key === "Enter" ? sendMessage() : "";}} id="Chatroom-newMessage" type="text" placeholder="yo yo yo" />
          <button onclick={sendMessage} >Send (⏎)</button>
        </div></> 
        : <></>}
    </div>
  )
}

export default Chatroom
