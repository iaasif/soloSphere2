const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  CURSOR_FLAGS,
} = require("mongodb");
const { decrypt } = require("dotenv");
require("dotenv").config();
const port = process.env.PORT || 9000;
const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://solosphere.web.app",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

//making middleware for jwt
// this is for varify purpose

const verifyToken = (req, res, next) => {
  console.log("this is middleware funtion yoo!!!!!!!!!!!!!!!!!!!!!!!!!!");
  const token = req.cookies?.token;
  console.log(token, "------>me token");
  // varifing token
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: "unauthorized access" });
        //return
      }
      console.log(decoded);
      req.user = decoded;
      next();
    });
  }
};

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mq0mae1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

//here change the code

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hy9u5fr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const jobsCollection = client.db("soloSphere").collection("jobs");
    const bidsCollection = client.db("soloSphere").collection("bids");

    //jwt making generate
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });

      // res.send({ token });
      //respond sending to cookie and saving them with name and value;
      res
        .cookie("token", token, {
          // options must needed for saving the cookies
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    //jwt token genaration done

    //clearing token when logout
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          // options must needed for saving the cookies
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    // Get all jobs data from db
    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();

      res.send(result);
    });

    // Get a single job data from db using job id
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // Save a bid data in db
    app.post("/bid", async (req, res) => {
      const bidData = req.body;
      // check if the data is duplicate
      const query = {
        email: bidData.email,
        jobId: bidData.jobId,
      };
      const alreadyApplied = await bidsCollection.findOne(query);
      if (alreadyApplied) {
        return res.status(400).send("you already place a bid for this job ");
      }
      const result = await bidsCollection.insertOne(bidData);
      res.send(result);
    });
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // Save a job data in db
    app.post("/job", async (req, res) => {
      const jobData = req.body;

      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    });

    // get all jobs posted by a specific user
    app.get("/jobs/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;

      console.log(tokenEmail, "---------->from token");
      const email = req.params.email;

      if (tokenEmail !== email) {
        return res.status(403).send({ message: "forbiden access" });
      }
      const query = { "buyer.email": email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // delete a job data from db
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    // update a job in db
    app.put("/job/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...jobData,
        },
      };
      const result = await jobsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    //getting all bids db using email from user

    app.get("/my-bids/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email }; //if in a object a query and a value is same , we just use one
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    //get all bids same user

    app.get("/bid-requests/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email }; //if in a object a query and a value is same , we just use one
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // update bid status
    app.patch("/bid/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: status,
      };
      const result = bidsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Get all jobs data from db for pagination
    app.get("/all-jobs", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;

      // console.log(size, page, "----->size page ");

      let query = {};
      //for this line of understanding , look at the original json data where category is filter variable
      if (filter) query = { category: filter };

      const result = await jobsCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();

      res.send(result);
    });

    // Get all jobs data from db for pagination for count
    app.get("/jobs-count", async (req, res) => {
      // const result = await jobsCollection.find().estimatedDocumentCount();
      // similar
      const filter = req.query.filter;
      let query = {};
      //for this line of understanding , look at the original json data where category is filter variable
      if (filter) query = { category: filter };
      const count = await jobsCollection.countDocuments(query);

      res.send({ count });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello from SoloSphere Server....");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
