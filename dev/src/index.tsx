/* @refresh reload */
import { render } from 'solid-js/web'

import './index.css'
import App from './games/SDPromptGuess/App'

render(() => <App />, document.getElementById('root') as HTMLElement)
