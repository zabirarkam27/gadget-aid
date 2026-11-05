require("dotenv").config();
const dns = require("node:dns");
const {MongoClient,ServerApiVersion} = require("mongodb");
const admin = require("firebase-admin");
const {createApp} = require("./app");

dns.setServers(["8.8.8.8","1.1.1.1"]);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert({projectId:process.env.FB_PROJECT_ID,clientEmail:process.env.FB_CLIENT_EMAIL,privateKey:process.env.FB_PRIVATE_KEY?.replace(/\\n/g,"\n")})});
const client = new MongoClient(`mongodb+srv://${encodeURIComponent(process.env.DB_USER || "")}:${encodeURIComponent(process.env.DB_PASSWORD || "")}@cluster0.cuvfj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`,{serverApi:{version:ServerApiVersion.v1,strict:true,deprecationErrors:true}});
let ready;
const getCollections = () => {
  if(!ready)ready=client.connect().then(async()=>{
    await client.db("admin").command({ping:1});
    const db=client.db("gadgetAidDB");
    return {services:db.collection("services"),bookings:db.collection("bookings")};
  }).catch(error=>{ready=null;throw error;});
  return ready;
};
const app=createApp({getCollections,verifyIdToken:token=>admin.auth().verifyIdToken(token),origins:(process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map(value=>value.trim()).filter(Boolean),logger:console});
if(process.env.NODE_ENV !== "production"){
  app.listen(process.env.PORT || 5000,()=>console.log(`GadgetAid server listening on port ${process.env.PORT || 5000}`));
  getCollections().then(()=>console.log("Database connection ready.")).catch(()=>console.error("Database unavailable. Requests will return a safe error until it reconnects."));
}
module.exports=app;
