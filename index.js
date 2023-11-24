const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();
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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // admin  related api
    app.post("/users/", async (req, res) => {
      try {
        const user = req.body;
        console.log(user);
        const isUserExist = await userCollection.findOne({ email: user.email });
        if (isUserExist) {
          return res.send({ message: "user already exists", insertedId: null });
        }
        console.log(isUserExist);
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //make user admin
    app.patch("/users/admin/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log(id);
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
    //teacher request

    app.post("/user/teacher/Request", async (req, res) => {
      try {
        const classData = req.body;
        console.log(classData);
        const result = await teacherRequestCollection.insertOne(classData);
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
