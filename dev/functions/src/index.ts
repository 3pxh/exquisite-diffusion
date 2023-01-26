import * as functions from "firebase-functions";
// import {runTransaction} from "firebase/database";
import * as admin from "firebase-admin";
// const admin = require('firebase-admin');
admin.initializeApp();

// import * as cors from "cors";
// const corsHandler = cors({origin: true});

// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript
//
// const db = getDatabase();

export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

export const testdbfn = functions.database.ref("/hello/{prop}/original")
    .onCreate((snapshot, context) => {
      const original = snapshot.val();
      functions.logger.log("Uppercasing", context.params.prop, original);
      const uppercase = original.toUpperCase();
      return snapshot.ref.parent!.child("uppercase").set(uppercase);
    });

export const testdbfn2 = functions.database.ref("/messages/{id}")
    .onCreate((snapshot, context) => {
      const original = snapshot.val();
      functions.logger.log("New message", context.params.prop, original);
      const myref = admin.database().ref("/goodbye");
      return myref.transaction((v) => {
        if (v) {
          v.messages += 1;
          v.last.original = original;
        }
        return v;
      });
    });
