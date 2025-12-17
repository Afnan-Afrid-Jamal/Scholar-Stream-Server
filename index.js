const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = 3000;

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
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

    const database = client.db("ScholarshipStreamDB");
    const scholarshipCollection = database.collection("Scholarships");
    const reviewCollection = database.collection("Reviews");
    const usersCollection = database.collection("Users");
    const paymentsCollection = database.collection("Payments");

    // ================= Scholarships =================

    app.get("/topSixScholarships", async (req, res) => {
      const result = await scholarshipCollection
        .find()
        .sort({ applicationFees: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/allScholarships", async (req, res) => {
      const result = await scholarshipCollection.find().toArray();
      res.send(result);
    });

    app.get("/findScholarshipsBySearch", async (req, res) => {
      const search = req.query.search || "";
      const result = await scholarshipCollection
        .find({ scholarshipName: { $regex: search, $options: "i" } })
        .toArray();
      res.send(result);
    });

    app.get("/findScholarshipsByFiltering", async (req, res) => {
      const filter = req.query.filter || "";
      const result = await scholarshipCollection
        .find({ scholarshipCategory: filter })
        .toArray();
      res.send(result);
    });

    app.get("/view-details/:id", async (req, res) => {
      const result = await scholarshipCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    app.post("/add-scholarship", async (req, res) => {
      const result = await scholarshipCollection.insertOne(req.body);
      res.send(result);
    });

    app.put("/updateScholarship/:id", async (req, res) => {
      const result = await scholarshipCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.delete("/delete-scholarship/:id", async (req, res) => {
      const result = await scholarshipCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ================= Reviews =================

    app.get("/reviewDetails", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.delete("/deleteReview/:id", async (req, res) => {
      const result = await reviewCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ================= Users =================

    app.post("/register", async (req, res) => {
      const { name, email, photoURL } = req.body;

      const existingUser = await usersCollection.findOne({ email });

      const time = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      if (existingUser) {
        await usersCollection.updateOne(
          { email },
          { $set: { lastLogin: time } }
        );
        return res.send({ message: "User exists" });
      }

      const user = {
        name,
        email,
        photoURL,
        role: "Student",
        createdAt: time,
        lastLogin: time,
      };

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const result = await usersCollection.findOne({
        email: req.query.email,
      });
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/role", async (req, res) => {
      const result = await usersCollection
        .find({ role: req.query.role })
        .toArray();
      res.send(result);
    });

    app.patch("/updateRole", async (req, res) => {
      const { id, role } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const result = await usersCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ================= Stripe Checkout =================

    app.post("/create-checkout-session", async (req, res) => {
      const { scholarshipId, userEmail } = req.body;

      const scholarship = await scholarshipCollection.findOne({
        _id: new ObjectId(scholarshipId),
      });

      if (!scholarship) {
        return res.status(404).send({ message: "Scholarship not found" });
      }

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          customer_email: userEmail,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Scholarship Application Fee - ${scholarship.scholarshipName}`,
                },
                unit_amount:
                  (Number(scholarship.applicationFees) +
                    Number(scholarship.serviceCharge)) *
                  100, // in cents
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `http://localhost:5173/payment-success/${scholarshipId}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `http://localhost:5173/payment-cancelled/${scholarshipId}`,
        });

        // Save pending payment in DB
        await paymentsCollection.insertOne({
          userEmail,
          scholarshipId,
          scholarshipName: scholarship.scholarshipName,
          applicationFees: scholarship.applicationFees,
          serviceCharge: scholarship.serviceCharge,
          totalPaid:
            Number(scholarship.applicationFees) +
            Number(scholarship.serviceCharge),
          status: "pending",
          date: new Date(),
          sessionId: session.id,
        });

        res.send({ url: session.url }); // Client will redirect to this URL
      } catch (err) {
        console.log(err);
        res
          .status(500)
          .send({ message: "Stripe Checkout Session creation failed" });
      }
    });

    // Update payment status after successful payment
    app.patch("/payment-success", async (req, res) => {
      const { transactionId } = req.body;

      try {
        const result = await paymentsCollection.updateOne(
          { sessionId: transactionId },
          { $set: { status: "paid" } }
        );
        res.send(result);
      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Failed to update payment status" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected");
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
