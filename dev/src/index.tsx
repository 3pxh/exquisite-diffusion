/* @refresh reload */
import { render } from 'solid-js/web'

import './index.css'
import GameSelection from './games/GameSelection'


render(() => <GameSelection />, document.getElementById('root') as HTMLElement)
