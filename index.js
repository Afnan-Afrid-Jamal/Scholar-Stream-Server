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
    const applicationCollection = database.collection("Applications");

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

    // Get review by specific user

    app.get("/ReviewByAUser", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }

      try {
        const result = await reviewCollection
          .find({ userEmail: email })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Something went wrong" });
      }
    });

    // Edit review
    app.post("/update-review/:id", async (req, res) => {
      const id = req.params.id;
      const { data } = req.body;

      const result = await reviewCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ratingPoint: data.ratingPoint,
            reviewComment: data.reviewComment,
          },
        }
      );

      res.send(result);
    });

    // Delete Review
    app.delete("/delete-review/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await reviewCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: true, message: "Failed to delete review" });
      }
    });

    // Add review
    app.post("/add-your-review", async (req, res) => {
      try {
        const reviewData = req.body;
        const result = await reviewCollection.insertOne(reviewData);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to add review" });
      }
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
      try {
        const { scholarshipId, userEmail } = req.body;

        const scholarship = await scholarshipCollection.findOne({
          _id: new ObjectId(scholarshipId),
        });

        if (!scholarship) {
          return res.status(404).send({ message: "Scholarship not found" });
        }

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
                  100,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `http://localhost:5173/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `http://localhost:5173/payment-cancelled`,
        });

        // ✅ get user data (FIXED: await added)
        const user = await usersCollection.findOne({ email: userEmail });

        // Save pending application
        await applicationCollection.insertOne({
          scholarshipId,
          scholarshipName: scholarship.scholarshipName,

          userId: user?._id,
          userName: user?.name,
          userEmail: user?.email,

          universityName: scholarship.universityName,
          universityCountry: scholarship.universityCountry,
          universityCity: scholarship.universityCity,
          scholarshipCategory: scholarship.scholarshipCategory,
          degree: scholarship.degree,
          subjectCategory: scholarship.subjectCategory,

          applicationFees: Number(scholarship.applicationFees),
          serviceCharge: Number(scholarship.serviceCharge),

          totalPaid:
            Number(scholarship.applicationFees) +
            Number(scholarship.serviceCharge),

          applicationStatus: "pending",
          paymentStatus: "unpaid",

          applicationDate: new Date(),
          feedback: "",

          sessionId: session.id,
        });

        res.send({ url: session.url });
      } catch (err) {
        console.log(err);
        res
          .status(500)
          .send({ message: "Stripe Checkout Session creation failed" });
      }
    });

    // ================= Payment Success =================
    app.patch("/payment-success", async (req, res) => {
      try {
        const { sessionId } = req.body;

        if (!sessionId) {
          return res.status(400).send({ message: "Session ID required" });
        }

        const result = await applicationCollection.updateOne(
          { sessionId },
          { $set: { paymentStatus: "paid" } }
        );

        res.send(result);
      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Failed to update payment status" });
      }
    });

    // ================= Get Application By Session =================
    app.get("/application-by-session", async (req, res) => {
      try {
        const { sessionId } = req.query;

        if (!sessionId) {
          return res.status(400).send({ message: "Session ID is required" });
        }

        const application = await applicationCollection.findOne({ sessionId });

        if (!application) {
          return res.status(404).send({ message: "Application not found" });
        }

        res.send(application);
      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Failed to fetch application" });
      }
    });

    // ================= Payment Failed =================
    app.get("/application-failed", async (req, res) => {
      try {
        const { sessionId } = req.query;

        if (!sessionId) {
          return res.status(400).send({ message: "Session ID is required" });
        }

        const application = await applicationCollection.findOne({ sessionId });

        if (!application) {
          return res.status(404).send({ message: "Application not found" });
        }

        res.send({
          scholarshipName: application.scholarshipName,
          errorMessage: "Payment failed. Please try again.",
        });
      } catch (err) {
        console.log(err);
        res
          .status(500)
          .send({ message: "Failed to fetch failed payment details" });
      }
    });

    // Analytics

    // Total Users
    app.get("/analytics/total-users", async (req, res) => {
      const totalUsers = await usersCollection.countDocuments();
      res.send({ totalUsers });
    });

    // Total Scholarships
    app.get("/analytics/total-scholarships", async (req, res) => {
      const totalScholarships = await scholarshipCollection.countDocuments();
      res.send({ totalScholarships });
    });

    // Total Fees Collected
    app.get("/analytics/total-fees", async (req, res) => {
      const result = await applicationCollection
        .aggregate([
          { $match: { paymentStatus: "paid" } },
          {
            $group: {
              _id: null,
              totalFees: { $sum: "$totalPaid" },
            },
          },
        ])
        .toArray();

      res.send({ totalFees: result[0]?.totalFees || 0 });
    });

    // Application count per Scholarship Category
    app.get("/analytics/category-counts", async (req, res) => {
      const result = await applicationCollection
        .aggregate([
          {
            $group: {
              _id: "$scholarshipCategory",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    // Get User Applications
    app.get("/your-applications", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const result = await applicationCollection
          .find({ userEmail: email })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });

    //Update user application
    app.patch("/update-application/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        const result = await applicationCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Update failed", error });
      }
    });

    // Delete Application
    app.delete("/applications/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await applicationCollection.deleteOne({
          _id: new ObjectId(id),
          applicationStatus: "pending",
        });

        if (result.deletedCount === 0) {
          return res.status(403).send({
            message: "Only pending applications can be deleted",
          });
        }

        res.send({ message: "Application deleted successfully" });
      } catch (error) {
        res.status(500).send({ message: "Delete failed", error });
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
