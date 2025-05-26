const express = require("express");
const mongoose = require("mongoose");
const compression = require("compression");
const fileUploadMiddleware = require("./middleware/fileUpload");
const cors = require("cors");
require("dotenv").config(); // Ensure environment variables are loaded
const PORT = process.env.PORT || 4000;
const app = express();

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors("*"));
app.use(fileUploadMiddleware);

// Require Routes
const userRoutes = require("./routes/UserRoutes");
const propertyRoutes = require("./routes/PropertyRoutes");
const buyerRoutes = require("./routes/BuyerRoutes");
const brokerRoutes = require("./routes/BrokerRoutes");
const walletPropertyRoutes = require("./routes/WalletPropertyRoutes");
const notesRoutes = require("./routes/NotesRoutes");

app.get("/", (req, res) => {
  res.send("API is running...");
});

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

// Server creation
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
