import * as functions from "firebase-functions";
// import * as cors from "cors";
// const corsHandler = cors({origin: true});

// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript
//

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
