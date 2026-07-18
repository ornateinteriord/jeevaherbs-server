const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);
mongoose.set("bufferTimeoutMS", 60000);

const connectDB = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");

    console.log("MONGO_URI Exists:", !!process.env.MONGO_URI);
    console.log(
      "Mongo URI Starts:",
      process.env.MONGO_URI
        ? process.env.MONGO_URI.substring(0, 20)
        : "NOT FOUND"
    );

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      maxPoolSize: 10,
    });

    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:");
    console.error(err);

    process.exit(1);
  }
};

module.exports = connectDB;