/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import { AuthProvider } from "./AuthProvider";
import App from './App'

const IS_DEBUG = true;
if (!IS_DEBUG) {
  console.log = () => {};
}

render(() => <AuthProvider session={null}><App /></AuthProvider>, 
       document.getElementById('root') as HTMLElement)
