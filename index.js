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
const enrolledClassCollection = client
  .db("classDb")
  .collection("allEnrolledClass");
const assignmentCollection = client.db("classDb").collection("assignment");
const feedbackCollection = client.db("classDb").collection("feedback");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    //payment related

    app.post("/create-payment-intent", async (req, res) => {
      const { id } = req.body;
      const query = { _id: new ObjectId(id) };
      const item = await allApprovedClassesCollection.findOne(query);
      console.log(item.price);
      const amount = parseInt(item.price * 100);
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

    //get total user
    app.get("/usersCount", async (req, res) => {
      try {
        const totalUser = await userCollection.estimatedDocumentCount();
        res.send({ totalUser });
      } catch (err) {
        console.log(err);
      }
    });
    //get total class
    app.get("/classesCount", async (req, res) => {
      try {
        const totalClass =
          await allApprovedClassesCollection.estimatedDocumentCount();
        res.send({ totalClass });
      } catch (err) {
        console.log(err);
      }
    });
    //get total user
    app.get("/usersCount", async (req, res) => {
      try {
        const totalUser = await userCollection.estimatedDocumentCount();
        res.send({ totalUser });
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

        //send  approved class to db
        const getApprovedClass = await teacherClassesCollection.findOne(query);
        const approvedClass = { ...getApprovedClass, count: 0 };
        const sendApprovedClassToApprovedClassesCollection =
          await allApprovedClassesCollection.insertOne(approvedClass);
        res.send(sendApprovedClassToApprovedClassesCollection);
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

    //get highest enrollment classes
    app.get("/allApprovedClass/highestEnrollment", async (req, res) => {
      try {
        const result = await allApprovedClassesCollection
          .find()
          .sort({
            count: 1,
          })
          .limit(6)
          .toArray();
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

    //update enroll count of single Approved Class

    app.patch("/updateEnrollCount/:id", async (req, res) => {
      try {
        const id = req.params.id;
        // get data
        const query = { _id: new ObjectId(id) };
        const classData = await allApprovedClassesCollection.findOne(query);
        const enrollCount = classData.count;
        console.log(193, classData);
        const option = { upsert: true };
        const updatedDoc = {
          $set: {
            count: enrollCount + 1,
          },
        };

        const result = await allApprovedClassesCollection.updateOne(
          query,
          updatedDoc,
          option
        );
        res.send(result);
        console.log(207, result);
      } catch (err) {
        console.log(err);
      }
    });

    // get enroll count

    app.get("/enrollCount/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const options = {
          projection: { _id: 0, count: 1 },
        };
        const result = await allApprovedClassesCollection.findOne(
          query,
          options
        );
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //get all  enroll class
    app.get("/enrolledClass", async (req, res) => {
      try {
        const result = await allApprovedClassesCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //send enrolled class data to db
    app.post("/enrolledClass", async (req, res) => {
      try {
        const enrolledClassData = req.body;
        const result = await enrolledClassCollection.insertOne(
          enrolledClassData
        );
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //get enrolled class data from db

    app.get("/enrolledClass/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const result = await enrolledClassCollection.find(query).toArray();
        res.send(result);
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

    //post assignment details
    app.post("/assignment", async (req, res) => {
      try {
        const assignmentData = req.body;
        console.log(assignmentData);
        const result = await assignmentCollection.insertOne(assignmentData);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    //get assignment count
    app.get("/assignmentCount/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const assignment = await assignmentCollection.estimatedDocumentCount(
          query
        );
        res.send({ assignment });
      } catch (err) {
        console.log(err);
      }
    });
    //get specific assignment
    app.get("/assignment/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { assignmentId: id };
        const assignment = await assignmentCollection.find(query).toArray();
        res.send(assignment);
      } catch (err) {
        console.log(err);
      }
    });
    //update submission of specific assignment
    app.patch("/assignment/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const date = new Date();
        const query = { assignmentId: id };
        const option = { upsert: true };
        const updatedDoc = {
          $set: {
            submissionDate: date,
            isSubmitted: true,
          },
        };
        const assignmentSubmit = await assignmentCollection.updateOne(
          query,
          updatedDoc,
          option
        );
        res.send(assignmentSubmit);
      } catch (err) {
        console.log(err);
      }
    });
    //post feedback details
    app.post("/feedback", async (req, res) => {
      try {
        const feedbackData = req.body;
        console.log(feedbackData);
        const result = await feedbackCollection.insertOne(feedbackData);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    //get feedback details
    app.get("/feedback", async (req, res) => {
      try {
        const result = await feedbackCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
