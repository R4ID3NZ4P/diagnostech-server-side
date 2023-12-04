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

    //jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "72h"});
      res.send({token});
    })

    const verifyToken = (req, res, next) => {
      if(!req.headers.authorization) {
        return res.status(401).send({message: "Unauthorized access"});
      }

      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err) {
          return res.status(401).send({message: "Unauthorized access"});
        }
        req.decoded = decoded;
      });

      next();
    }
    
    //users collection related APIs
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.post("/users", async (req, res) => {
        const userInfo = req.body;
        const query = {email: userInfo.email};
        const queryRes = await userCollection.findOne(query);
        if(queryRes) return res.send({message: "User already exists", insertedId: null});
        const result = await userCollection.insertOne(userInfo);
        res.send(result);
    });

    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {email};
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/user/:email", verifyToken, async (req, res) => {
      const info = req.body;
      const query = {email: req.params.email};
      const updated = {$set: {
          status: info.status
        }
      };
      const result = await userCollection.updateOne(query, updated);
      res.send(result);
    });

    app.patch("/user", verifyToken, async (req, res) => {
      const info = req.body;
      const query = {email: info.email};
      const updated = {
        $set: {
          name: info.name
        }
      };
      const result = await userCollection.updateOne(query, updated);
      res.send(result);
    });

    app.patch("/users/admin/:email", verifyToken, async (req, res) => {
      const query = {email: req.params.email};
      const updated = {$set: {
          isAdmin: true
        }
      };
      const result = await userCollection.updateOne(query, updated);
      res.send(result);
    });


    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      if(req.decoded.email !== req.params.email) {
        return res.status(403).send({message: "Forbidden access"});
      }  
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

    app.post("/tests", verifyToken, async (req, res) => {
      const test = req.body;
      const result = await testCollection.insertOne(test);
      res.send(result);
    });
    
    app.patch("/tests/:id", verifyToken, async (req, res) => {
      const test = req.body;
      const updated = {$set: test};
      const query = {_id: new ObjectId(req.params.id)};
      const result = await testCollection.updateOne(query, updated);
      res.send(result);
    });

    app.delete("/tests/:id", verifyToken, async (req, res) => {
      const query = {_id: new ObjectId(req.params.id)};
      const result = await testCollection.deleteOne(query);
      res.send(result);
    })

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

      const query = { _id: new ObjectId(book.service) };
      const update = await testCollection.updateOne(query, {$inc : {slots: -1, booked: 1}});

      res.send({result, update});
    });

    app.get("/results/:email", verifyToken, async (req, res) => {
      const result = await bookingCollection.find({email: req.params.email}).toArray();
      res.send(result);
    });

    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const result = await bookingCollection.find({email: req.params.email}).toArray();
      const services = result.map(service => new ObjectId(service.service));
      const bookings = await testCollection.find({_id : {$in: services}}).toArray();
      res.send(bookings);
    });

    app.get("/reservations/:id", verifyToken, async (req, res) => {
      const query = {service: req.params.id};
      console.log(query);
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/reservations", verifyToken, async (req, res) => {
      const query = {service: req.query.service, email: req.query.email};
      const result = await bookingCollection.deleteMany(query);
      const update = await testCollection.updateOne({_id: new ObjectId(req.query.service)}, {$inc : {slots: 1, booked: -1}});
      res.send(result);
    });

    app.patch("/reservations/:id", verifyToken, async (req, res) => {
      const query = {_id: new ObjectId(req.params.id)};
      const info = req.body;
      const updated = {
        $set: info
      }
      console.log(query, updated);
      const result = await bookingCollection.updateOne(query, updated);
      res.send(result);
    });

    // app.delete("/bookings/:id", verifyToken, async (req, res) => {
    //   const query = {service: req.params.id};
    //   const result = await bookingCollection.deleteMany(query);
    //   const update = await testCollection.updateOne({_id: new ObjectId(req.params.id)}, {$inc : {slots: 1, booked: -1}});
    //   res.send(result);
    // })


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