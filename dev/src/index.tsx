/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import { AuthProvider } from "./AuthProvider";
import App from './App'

render(() => <AuthProvider session={null}><App /></AuthProvider>, 
       document.getElementById('root') as HTMLElement)
