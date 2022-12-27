import { Component, createSignal, For, createEffect } from 'solid-js'
import { supabase } from './supabaseClient'
import { useAuth } from "./AuthProvider";

interface Message {
  player: string,
  text: string,
}

const Chatroom: Component<{roomId: number}> = (props) => {
  const { session, playerHandle } = useAuth();

  const [messages, setMessages] = createSignal<Message[]>([])
  const [isOpen, setIsOpen] = createSignal<boolean>(true)

  createEffect(async () => {
    console.log("subscribing to messages", props.roomId);
    supabase
      .channel(`public:chats:room_id=eq.${props.roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'chats', filter: `room_id=eq.${props.roomId}` 
      }, payload => {
        setMessages(messages().concat({text: payload.new.message.text, player: payload.new.message.player.handle}));
        const el = document.getElementById("Chatroom-Messages");
        if (el) { // Not closed.
          el.scrollTop = el.scrollHeight;
        }
      }).subscribe();
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
  }

  return (
    <div id="Chatroom">
      <div id="Chatroom-Header">
        <button onclick={toggleOpen} > {isOpen() ? "close" : "open chat"}</button>
      </div>
      {isOpen() ? <>
        <div id="Chatroom-Messages">
          <For each={messages()}>{(m, i) =>
              <p><strong>{m.player}:</strong> {m.text}</p>
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