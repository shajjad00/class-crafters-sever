const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
app.use(cors());
app.use(express.json());
//crypto

// const crypto = require("crypto");
// const randomBytes = crypto.randomBytes(64).toString("hex");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ktlz3kz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const userCollection = client.db("classDb").collection("users");
const teacherRequestCollection = client
  .db("classDb")
  .collection("teacherRequest");
const teacherClassesCollection = client.db("classDb").collection("classes");
const allApprovedClassesCollection = client
  .db("classDb")
  .collection("allApprovedClasses");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //payment related

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "USD",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    // admin  related api

    app.post("/users/", async (req, res) => {
      try {
        const user = req.body;
        const isUserExist = await userCollection.findOne({ email: user.email });
        if (isUserExist) {
          return res.send({ message: "user already exists", insertedId: null });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //get user
    app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    //get user by id

    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const result = await userCollection.findOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //get all teacher requested class classes

    app.get("/allClasses", async (req, res) => {
      try {
        const result = await teacherClassesCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //approve teacher class

    app.patch("/allClasses/approve/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const updatedDoc = {
          $set: {
            status: "accepted",
          },
        };
        //update status
        const result = await teacherClassesCollection.updateOne(
          query,
          updatedDoc,
          option
        );

        //send to approved class to db
        const getApprovedClass = await teacherClassesCollection.findOne(query);
        const sendApprovedClassToApprovedClassesCollection =
          await allApprovedClassesCollection.insertOne(getApprovedClass);
        // console.log(sendApprovedClassToApprovedClassesCollection);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //reject teacher class
    app.patch("/allClasses/reject/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const updatedDoc = {
          $set: {
            status: "rejected",
          },
        };
        const result = await teacherClassesCollection.updateOne(
          query,
          updatedDoc,
          option
        );
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //get all Approved Class

    app.get("/allApprovedClass", async (req, res) => {
      try {
        const result = await allApprovedClassesCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //get single Approved Class

    app.get("/allApprovedClass/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const singleApprovedClassResult =
          await allApprovedClassesCollection.findOne(query);
        res.send(singleApprovedClassResult);
      } catch (err) {
        console.log(err);
      }
    });

    //make user admin
    app.patch("/users/admin/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(query, updatedDoc);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //make user teacher
    // app.patch("/user/teacher/role", async (req, res) => {
    //   try {
    //     const userEmail = req.body;
    //     console.log(userEmail);
    //   } catch (err) {
    //     console.log(err);
    //   }
    // });
    //make user teacher

    app.patch("/admin/request/:email", async (req, res) => {
      try {
        const requesterEmail = req.params.email;
        const query = { email: requesterEmail };
        const option = { upsert: true };
        const updatedDoc = {
          $set: {
            status: "accepted",
          },
        };
        const result = await teacherRequestCollection.updateOne(
          query,
          updatedDoc,
          option
        );

        //update role
        const queryForRole = { email: requesterEmail };
        const updatedDocForRole = {
          $set: {
            role: "teacher",
          },
        };
        const resultForRole = await userCollection.updateOne(
          queryForRole,
          updatedDocForRole,
          option
        );
        console.log(resultForRole);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    //check user role
    app.get("/user/role/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const result = await userCollection.findOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //teacher request

    app.post("/user/teacher/Request", async (req, res) => {
      try {
        const classData = req.body;
        const result = await teacherRequestCollection.insertOne(classData);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/user/teacher/Request", async (req, res) => {
      try {
        const result = await teacherRequestCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //teacher related

    //post classes
    app.post("/user/teacher/classes", async (req, res) => {
      try {
        const classData = req.body;
        const result = await teacherClassesCollection.insertOne(classData);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // get classes of specific teacher
    app.get("/user/teacher/classes/:email", async (req, res) => {
      try {
        const userEmail = req.params.email;
        const query = { email: userEmail };
        const result = await teacherClassesCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //delete classes
    app.delete("/teacher/classes/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await teacherClassesCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //get single classes

    app.get("/classes/update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await teacherClassesCollection.findOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    //update single classes
    app.put("/classes/update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const classData = req.body;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            ...classData,
          },
        };
        const result = await teacherClassesCollection.updateOne(
          query,
          updatedDoc
        );
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`running at ${port}`);
});
