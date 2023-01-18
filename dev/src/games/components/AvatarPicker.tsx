import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../../supabaseClient'
import { Player } from '../engines/PromptGuessBase'


const AvatarPicker: Component<{players: Player[], setAvatarUrl: (url: string) => void}> = (props) => {
  const FOLDER = 'animals'
  const BUCKET = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${FOLDER}`
  const [avatars, setAvatars] = createSignal<{name: string}[]>([])
  const [claimedAvatars, setClaimedAvatars] = createSignal<Set<string>>(new Set())
  supabase
    .storage
    .from('avatars')
    .list(FOLDER, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }).then(({ data, error }) => {
      setAvatars(data?.slice(1) as {name: string}[]);
    })

  createEffect(() => {
    setClaimedAvatars(new Set(props.players.map(p => p.avatar ?? '')));
  })

  return (
    <div style="display: flex; flex-direction: row; max-width:400px; flex-wrap: wrap;">
      <For each={avatars()}>{(a, i) => {
        const url = `${BUCKET}/${a.name}`;
        const claimedStyle = `opacity: .2`;
        return <>
          <Show when={claimedAvatars().has(url)}>
            <img src={url} width="64" style={claimedStyle} />
          </Show>
          <Show when={!claimedAvatars().has(url)}>
            <img src={url} width="64"
                  onclick={() => {props.setAvatarUrl(url)}} />
          </Show>
        </>
      }}</For>
    </div>
  )
}

export default AvatarPicker
