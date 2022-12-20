/* @refresh reload */
import { render } from 'solid-js/web'

import './index.css'
import AuthSelection from './games/AuthSelection'


render(() => <AuthSelection />, document.getElementById('root') as HTMLElement)
