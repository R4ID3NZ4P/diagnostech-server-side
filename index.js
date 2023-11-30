const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SK);

const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sml8dnv.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();

    const userCollection = client.db("diagnostechDB").collection("users");
    const testCollection = client.db("diagnostechDB").collection("tests");
    const bookingCollection = client.db("diagnostechDB").collection("bookings");

    //users collection related APIs
    app.post("/users", async (req, res) => {
        const userInfo = req.body;
        const query = {email: userInfo.email};
        const queryRes = await userCollection.findOne(query);
        if(queryRes) return res.send({message: "User already exists", insertedId: null});
        const result = await userCollection.insertOne(userInfo);
        res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
        const query = {email: req.params.email};
        const result = await userCollection.findOne(query);
        res.send(result);
    });

    // tests related APIs
    app.get("/tests", async (req, res) => {
        const result = await testCollection.find().toArray();
        res.send(result);
    });

    app.get("/tests/:id", async (req, res) => {
        const query = {_id: new ObjectId(req.params.id)};
        const result = await testCollection.findOne(query);
        res.send(result);
    });

    //payment
    app.post("/payment-intent", async (req, res) => {
      const {price} = req.body;
      const amount = parseFloat(price) * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      });

      res.send({ clientSecret: paymentIntent.client_secret});
    });

    app.post("/bookings", async (req, res) => {
      const book = req.body;
      const result = await bookingCollection.insertOne(book);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Server status: Up");
})

app.listen(port, () => {
    console.log(`Server is running at port: ${port}`);
})