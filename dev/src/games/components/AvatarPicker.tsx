import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../../supabaseClient'
import { Player } from '../engines/PromptGuessBase'


const AvatarPicker: Component<{players: Player[], setAvatarUrl: (url: string) => void}> = (props) => {
  const FOLDER = 'animals'
  const BUCKET = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${FOLDER}`
  const [avatars, setAvatars] = createSignal<{name: string}[]>([])
  const [claimedAvatars, setClaimedAvatars] = createSignal<Set<string>>(new Set())

  const formatUrl = (name: string) => {
    return `${BUCKET}/${name}`;
  }

  supabase
    .storage
    .from('avatars')
    .list(FOLDER, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }).then(({ data, error }) => {
      setAvatars(data?.slice(1) as {name: string}[]);
      // Want to assign them the first untaken one, but players load slow.
      // Settle for a random one, and collisions be damned for now.
      const pick = data?.slice(1)[Math.floor(Math.random() * data?.slice(1).length)];
      props.setAvatarUrl(formatUrl(pick?.name ?? ''));
    })

  createEffect(() => {
    setClaimedAvatars(new Set(props.players.map(p => p.avatar ?? '')));
  })

  return (
    <div style="display: flex; flex-direction: row; max-width:340px; flex-wrap: wrap; background:rgba(0,0,0,.05);">
      <For each={avatars()}>{(a, i) => {
        const url = formatUrl(a.name);
        const baseStyle = `margin:2px; border-radius:50%;`
        const claimedStyle = `opacity: .2; ${baseStyle}`;
        return <>
          <Show when={claimedAvatars().has(url)}>
            <img src={url} width="64" style={claimedStyle} />
          </Show>
          <Show when={!claimedAvatars().has(url)}>
            <img style={baseStyle} src={url} width="64"
                  onclick={() => {props.setAvatarUrl(url)}} />
          </Show>
        </>
      }}</For>
    </div>
  )
}

export default AvatarPicker
