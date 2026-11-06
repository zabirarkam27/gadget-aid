const {createDatabase}=require("./database");
require("dotenv").config();
const dns = require("node:dns");
const {MongoClient,ServerApiVersion} = require("mongodb");
const admin = require("firebase-admin");
const {createEmailSender} = require("./email");
const {createApp} = require("./app");

dns.setServers(["8.8.8.8","1.1.1.1"]);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert({projectId:process.env.FB_PROJECT_ID,clientEmail:process.env.FB_CLIENT_EMAIL,privateKey:process.env.FB_PRIVATE_KEY?.replace(/\\n/g,"\n")})});
const client = new MongoClient(`mongodb+srv://${encodeURIComponent(process.env.DB_USER || "")}:${encodeURIComponent(process.env.DB_PASSWORD || "")}@cluster0.cuvfj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`,{serverApi:{version:ServerApiVersion.v1,strict:true,deprecationErrors:true}});
let ready;
const getCollections = () => {
  if(!ready)ready=client.connect().then(async()=>{
    await client.db("admin").command({ping:1});
    return createDatabase(client);
  }).catch(error=>{ready=null;throw error;});
  return ready;
};
const appUrl=process.env.APP_URL || "http://localhost:5173";
const parsedAppUrl=new URL(appUrl);
if(!["https:","http:"].includes(parsedAppUrl.protocol) || parsedAppUrl.username || parsedAppUrl.password || parsedAppUrl.pathname!=="/" || parsedAppUrl.search || parsedAppUrl.hash)throw new Error("APP_URL must be an http(s) origin without credentials or paths.");
const emailConfigured=!!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_URL && process.env.CRON_SECRET?.length>=32);
if(emailConfigured && process.env.NODE_ENV==="production" && parsedAppUrl.protocol!=="https:")throw new Error("Production email links require an HTTPS APP_URL.");
const app=createApp({sendEmail:emailConfigured?createEmailSender({apiKey:process.env.RESEND_API_KEY,from:process.env.EMAIL_FROM}):null,jobSecret:process.env.CRON_SECRET || "",appUrl:parsedAppUrl.origin,getCollections,verifyIdToken:token=>admin.auth().verifyIdToken(token),origins:(process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map(value=>value.trim()).filter(Boolean),logger:console});
if(process.env.NODE_ENV !== "production"){
  app.listen(process.env.PORT || 5000,error=>{if(error){console.error("GadgetAid server could not bind its port. Stop the old listener or choose another PORT.");process.exit(1);}console.log(`GadgetAid server listening on port ${process.env.PORT || 5000}`);});
  getCollections().then(()=>console.log("Database connection ready.")).catch(()=>console.error("Database unavailable. Requests will return a safe error until it reconnects."));
}
module.exports=app;
