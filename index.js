const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");

const cors = require("cors");
require("dotenv").config();
const port = 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // Collections
    const database = client.db("ScholarshipStreamDB");
    const scholarshipCollection = database.collection("Scholarships");

    // Get top 6 scholarships (lowest application fees)
    app.get("/topSixScholarships", async (req, res) => {
      const allScholarships = await scholarshipCollection
        .find()
        .sort({ applicationFees: 1 })
        .limit(6)
        .toArray();

      res.send(allScholarships);
    });

    // All Scholarships
    app.get("/allScholarships", async (req, res) => {
      const result = await scholarshipCollection.find().toArray();
      res.send(result);
    });

    // Search
    app.get("/findScholarshipsBySearch", async (req, res) => {
      const searchText = req.query.search || "";

      try {
        const result = await scholarshipCollection
          .find({
            scholarshipName: { $regex: searchText, $options: "i" },
          })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Search failed" });
      }
    });

    // Filter
    app.get("/findScholarshipsByFiltering", async (req, res) => {
      const filteredBy = req.query.filter || "";

      try {
        const result = await scholarshipCollection
          .find({
            scholarshipCategory: filteredBy,
          })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "filtering failed" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
