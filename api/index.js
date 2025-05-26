const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const userRoutes = require("./routes/UserRoutes");
const propertyRoutes = require("../routes/PropertyRoutes");
const buyerRoutes = require("../routes/BuyerRoutes");
const brokerRoutes = require("../routes/BrokerRoutes");
const walletPropertyRoutes = require("../routes/WalletPropertyRoutes");
const notesRoutes = require("../routes/NotesRoutes");

app.get("/", (req, res) => {
  res.send("API is running...");
});

// Define API Endpoints with prefixes

// Define API Endpoints with prefixes
app.use("/api/users", userRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/buyers", buyerRoutes);
app.use("/api/brokers", brokerRoutes);
app.use("/api/wallet-properties", walletPropertyRoutes);
app.use("/api/notes", notesRoutes);


// DATABASE CONNECTION
const connectDB = async (retries = 5) => {
  while (retries) {
    try {
      await mongoose.connect(process.env.DB_URL);
      console.log("Connected to MongoDB");
      break; // Exit the loop on successful connection
    } catch (err) {
      console.error("Failed to connect to DB", err);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      await new Promise((res) => setTimeout(res, 5000)); // Wait 5 seconds before retrying
    }
  }

  if (retries === 0) {
    console.error("Could not connect to MongoDB after multiple attempts.");
    process.exit(1); // Exit process if connection fails
  }
};

connectDB();
// Export the Express app for Vercel serverless
module.exports = app;
