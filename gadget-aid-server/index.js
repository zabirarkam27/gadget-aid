const express = require("express");
const cors = require("cors");
require("dotenv").config();
const dns = require("dns");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const port = process.env.PORT || 5000;

// ---------- Firebase Admin (for verifying client ID tokens) ----------
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FB_PROJECT_ID,
    clientEmail: process.env.FB_CLIENT_EMAIL,
    // .env stores the private key with literal \n, convert back to real newlines
    privateKey: process.env.FB_PRIVATE_KEY
      ? process.env.FB_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined,
  }),
});

// ---------- Middleware ----------
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json());

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>"
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decodedEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

// Small helper so every :id route doesn't repeat the same check
const isValidId = (req, res, next) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: "Invalid id" });
  }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cuvfj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let servicesCollection;
let bookingsCollection;

async function run() {
  await client.connect();
  console.log("Connected to MongoDb!");

  const db = client.db("gadgetAidDB");
  servicesCollection = db.collection("services");
  bookingsCollection = db.collection("bookings");

  await client.db("admin").command({ ping: 1 });
  console.log("Pinged your deployment. You successfully connected to MongoDB!");
}
run().catch(console.dir);

// ---------------- Public routes ----------------

// All services
app.get("/services", async (req, res) => {
  const result = await servicesCollection.find().toArray();
  res.send(result);
});

// Single service by ID
app.get("/services/:id", isValidId, async (req, res) => {
  try {
    const service = await servicesCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!service) return res.status(404).send({ message: "Service not found" });
    res.send(service);
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Gadget aid server is running");
});

// ---------------- Private routes (require a valid Firebase ID token) ----------------

// Services created by the logged-in user
app.get("/my-services", verifyToken, async (req, res) => {
  const result = await servicesCollection
    .find({ providerEmail: req.decodedEmail })
    .toArray();
  res.send(result);
});

// Add new service
app.post("/services", verifyToken, async (req, res) => {
  const { name, price, area, description, image } = req.body;
  if (!name || !price || !area || !description || !image) {
    return res.status(400).send({ message: "Missing required fields" });
  }

  const newService = {
    ...req.body,
    providerEmail: req.decodedEmail, // trust the token, not the client-sent value
  };
  const result = await servicesCollection.insertOne(newService);
  res.send(result);
});

// Update service (only the owner can update)
app.put("/services/:id", verifyToken, isValidId, async (req, res) => {
  const id = req.params.id;
  const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
  if (!service) return res.status(404).send({ message: "Service not found" });
  if (service.providerEmail !== req.decodedEmail) {
    return res.status(403).send({ message: "Forbidden: not your service" });
  }

  const { name, price, area, description, image } = req.body;
  const updateDoc = {
    $set: { name, price, area, description, image },
  };
  const result = await servicesCollection.updateOne(
    { _id: new ObjectId(id) },
    updateDoc,
  );
  res.send(result);
});

// Delete service (only the owner can delete)
app.delete("/services/:id", verifyToken, isValidId, async (req, res) => {
  const id = req.params.id;
  const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
  if (!service) return res.status(404).send({ message: "Service not found" });
  if (service.providerEmail !== req.decodedEmail) {
    return res.status(403).send({ message: "Forbidden: not your service" });
  }

  try {
    const result = await servicesCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
});

// Add booking
app.post("/bookings", verifyToken, async (req, res) => {
  const { serviceId, serviceName, date } = req.body;
  if (!serviceId || !serviceName || !date) {
    return res.status(400).send({ message: "Missing required fields" });
  }

  const booking = {
    ...req.body,
    userEmail: req.decodedEmail, // trust the token, not the client-sent value
  };
  const result = await bookingsCollection.insertOne(booking);
  res.send(result);
});

// Bookings made by the logged-in user
app.get("/bookings", verifyToken, async (req, res) => {
  const result = await bookingsCollection
    .find({ userEmail: req.decodedEmail })
    .toArray();
  res.send(result);
});

// All bookings where the logged-in user is the service provider
app.get("/all-bookings", verifyToken, async (req, res) => {
  const result = await bookingsCollection
    .find({ providerEmail: req.decodedEmail })
    .toArray();
  res.send(result);
});

// Update booking status (only the provider who owns the booking can update it)
app.patch("/all-bookings/:id", verifyToken, isValidId, async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  if (!["pending", "working", "completed"].includes(status)) {
    return res.status(400).send({ message: "Invalid status value" });
  }

  const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
  if (!booking) return res.status(404).send({ message: "Booking not found" });
  if (booking.providerEmail !== req.decodedEmail) {
    return res.status(403).send({ message: "Forbidden: not your booking" });
  }

  const result = await bookingsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } },
  );
  res.send(result);
});

// Local dev only — Vercel invokes the exported app directly, it doesn't need listen()
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Gadget Aid server is running on port: ${port}`);
  });
}

module.exports = app;
