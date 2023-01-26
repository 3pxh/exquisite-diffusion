// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, query, orderByChild } from "firebase/database";
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, sendSignInLinkToEmail } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9IlVuzQPTlQdiIjuAtl0bNfc1dRfRCrU",
  authDomain: "threepixelheart-f5674.firebaseapp.com",
  databaseURL: "https://threepixelheart-f5674-default-rtdb.firebaseio.com",
  projectId: "threepixelheart-f5674",
  storageBucket: "threepixelheart-f5674.appspot.com",
  messagingSenderId: "528049220137",
  appId: "1:528049220137:web:8e937543cfb87b72670a38"
};

// Initialize Firebase
export const firebase = initializeApp(firebaseConfig);
export const db = getDatabase(firebase);
export const auth = getAuth();

// export const functions = getFunctions(firebase);
// connectFunctionsEmulator(functions, "localhost", 5001);
// TODO: want to be able to fully emulate functions and rtdb locally.

// WIP!
// export const emailSignIn = (email: string) => {
//   console.log("starting firebase email auth");
//   const actionCodeSettings = {
//     // URL you want to redirect back to. The domain (www.example.com) for this
//     // URL must be in the authorized domains list in the Firebase Console.
//     url: 'https://artifice.games',
//     // This must be true.
//     handleCodeInApp: true,
//     iOS: {
//       bundleId: 'com.example.ios'
//     },
//     android: {
//       packageName: 'com.example.android',
//       installApp: true,
//       minimumVersion: '12'
//     },
//     dynamicLinkDomain: 'example.page.link'
//   };
  
//   sendSignInLinkToEmail(auth, email, actionCodeSettings)
//     .then(() => {
//       // The link was successfully sent. Inform the user.
//       // Save the email locally so you don't need to ask the user for it again
//       // if they open the link on the same device.
//       window.localStorage.setItem('emailForSignIn', email);
//       console.log("firebase auth link sent to email");
//       // ...
//     })
//     .catch((error) => {
//       const errorCode = error.code;
//       const errorMessage = error.message;
//       // ...
//     });
// }


export const message = (m: any) => {
  const k = push(ref(db, 'messages/')).key;
  set(ref(db, `messages/${k}`), m);
}
