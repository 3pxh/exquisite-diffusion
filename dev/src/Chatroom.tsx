import { Component, createSignal, For, createEffect } from 'solid-js'
import { supabase } from './supabaseClient'
import { useAuth } from "./AuthProvider";

interface Message {
  player: string,
  text: string,
  uuid: string,
}

const HTML_PLAYER_COLORS = [
    "#ff0000", // red
    "#7777ff", // blue (a bit lighter to make it easy to see against black)
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

  const updateUuidTable = async payload => {
      console.log("Updating UUID table....")
      const participants = await supabase.from('participants').select(`user`).eq('room', props.roomId).order('id')
      console.log("Fetched participants.")

      const new_uuid_to_player_index : { [key: string]: int} = {};
      for (var i = 0; i < participants.data.length; i++) {
          console.log(`Player ${i} is ${participants.data[i].user}`)
          new_uuid_to_player_index[participants.data[i].user] = i;
      }
      setUuidToPlayerIndex(new_uuid_to_player_index);
  };

  createEffect(async () => {
    const el = document.getElementById("Chatroom-Messages");
    if (el) { el.scrollTop = el.scrollHeight; }
    console.log("subscribing to messages", props.roomId);
    supabase
      .channel(`public:chats:room_id=eq.${props.roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chats', filter: `room_id=eq.${props.roomId}`
      }, payload => {

        // Note: this is a hack.  The subscription below to the participants
        // table isn't working for some reason.  So until that works, we're
        // updating our player table whenever an unfamiliar participant says
        // something.
        if (!uuidToPlayerIndex().hasOwnProperty(payload.new.message.player.uuid)) {
            updateUuidTable();
        }

        const el = document.getElementById("Chatroom-Messages");
        const wasScrolledDown = true;//el ? el.scrollTop + el.clientHeight >= el.scrollHeight : false;
        console.log(`Recieved ${payload.new.message.text}`)
        setMessages(messages().concat({
            text: payload.new.message.text,
            player: payload.new.message.player.handle,
            uuid: payload.new.message.player.uuid,
        }));
        if (el && wasScrolledDown) { // Not closed.
          el.scrollTop = el.scrollHeight;
        }

      }).subscribe();

    updateUuidTable();

    // TODO: this subscription doesn't seem to do anything.
    /*
    supabase
      .channel(`public:participants:room=eq.${props.roomId}`)
      .on('postgress_changes', {
          event: 'INSERT', schema: 'public', table: 'participants', filter: `room=eq.${props.roomId}`
        }, updateUuidTable)
      .on('postgress_changes', {
          event: 'UPDATE', schema: 'public', table: 'participants', filter: `room=eq.${props.roomId}`
        }, updateUuidTable)
      .subscribe();
    */
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
              <strong style={getHtmlPlayerStyle(uuidToPlayerIndex()[m.uuid] ?? -1)} >
                {m.player}:
              </strong>
              {m.text}
            </p>
          }</For>
        </div>
        <div id="Chatroom-Input">
          <span style={getHtmlPlayerStyle(uuidToPlayerIndex()[session()?.user.id] ?? -1)} >
            {playerHandle()}
          </span>
          <input onkeydown={(e) => {e.key === "Enter" ? sendMessage() : "";}} id="Chatroom-newMessage" type="text" placeholder="yo yo yo" />
          <button onclick={sendMessage} >Send (⏎)</button>
        </div></>
        : <></>}
    </div>
  )
}

export default Chatroom
