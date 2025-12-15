const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const cors = require("cors");
require("dotenv").config();
const port = 3000;

// app.use(cors());
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173", // Vite dev server
    credentials: true,
  })
);

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
    const reviewCollection = database.collection("Reviews");
    const usersCollection = database.collection("Users");

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

    // View Details
    app.get("/view-details/:id", async (req, res) => {
      const id = req.params.id;
      const result = await scholarshipCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Get Review all details
    app.get("/reviewDetails", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // Store users data
    app.post("/register", async (req, res) => {
      const { name, email, photoURL } = req.body;

      if (!name || !email) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existingUser = await usersCollection.findOne({ email });

      const currentTime = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      if (existingUser) {
        // User exists → update lastLogin
        await usersCollection.updateOne(
          { email },
          { $set: { lastLogin: currentTime } }
        );
        return res
          .status(200)
          .json({ message: "User already exists. Login time updated." });
      }

      // New user → insert with createdAt and lastLogin
      const newUser = {
        name,
        email,
        photoURL,
        role: "Student",
        createdAt: currentTime,
        lastLogin: currentTime,
      };

      const result = await usersCollection.insertOne(newUser);
      res.status(201).json({
        message: "User registered successfully",
        userId: result.insertedId,
      });
    });

    // Get user data by email
    app.get("/user", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const result = await usersCollection.findOne({ email: email });

        if (!result) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Get all users data
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();

        if (users.length === 0) {
          return res.status(404).json({ message: "No users found" });
        }

        res.status(200).json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Add Scholarship
    app.post("/add-scholarship", async (req, res) => {
      try {
        const scholarshipData = req.body;

        if (
          !scholarshipData?.scholarshipName ||
          !scholarshipData?.universityName
        ) {
          return res.status(400).json({ message: "Required fields missing" });
        }

        const result = await scholarshipCollection.insertOne(scholarshipData);

        res.status(201).json({
          message: "Scholarship added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add scholarship" });
      }
    });

    // Get all users data by role
    app.get("/users/role", async (req, res) => {
      const { role } = req.query;
      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      try {
        const result = await usersCollection.find({ role }).toArray();
        res.status(200).json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Backend: updateRole route
    app.patch("/updateRole", async (req, res) => {
      try {
        const { id, role } = req.body; // frontend থেকে id এবং role আসবে

        if (!id || !role) {
          return res.status(400).json({ message: "ID and role are required" });
        }

        // MongoDB collection ধরে নিই `usersCollection`
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) }, // MongoDB ObjectId এ convert
          { $set: { role: role } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "Role updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // Delete User

    app.delete("/users/:id", async (req, res) => {
      const { id } = req.params;

      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
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
