import { Component, createEffect, createSignal, Switch, Match, Show, For } from 'solid-js'
import { supabase } from '../../supabaseClient'
import { Player } from '../engines/PromptGuessBase'

const shuffle = <T,>(A: T[]) => {
  return A.map(value => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
}

const AvatarPicker: Component<{players: Player[], setAvatarUrl: (url: string) => void}> = (props) => {
  const FOLDERS = ['animals', 'grove']
  const BUCKET = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/`
  const [avatars, setAvatars] = createSignal<{name: string, folder: string}[]>([])
  const [claimedAvatars, setClaimedAvatars] = createSignal<Set<string>>(new Set())

  const formatUrl = (name: string, folder: string) => {
    return `${BUCKET}/${folder}/${name}`;
  }

  FOLDERS.forEach(f => {
    supabase
      .storage
      .from('avatars')
      .list(f, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      }).then(({ data, error }) => {
        const newAvatars = data?.slice(1).map(d => { return {name: d.name ?? '', folder: f} });
        setAvatars(shuffle([...avatars(), ...newAvatars!]));
        const pick = avatars()[Math.floor(Math.random() * Math.min(20, avatars().length))];
        props.setAvatarUrl(formatUrl(pick?.name ?? '', pick.folder));
      })
  })

  createEffect(() => {
    setClaimedAvatars(new Set(props.players.map(p => p.avatar ?? '')));
  })

  return (
    <div style="display: flex; flex-direction: row; max-width:340px; flex-wrap: wrap; background:rgba(0,0,0,.05);">
      <For each={avatars().slice(0,20)}>{(a, i) => {
        const url = formatUrl(a.name, a.folder);
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
