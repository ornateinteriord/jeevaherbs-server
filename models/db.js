const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);
mongoose.set("bufferTimeoutMS", 60000);

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    console.log("=> using existing database connection");
    return;
  }

  try {
    console.log("🔄 Connecting to MongoDB...");

    console.log("MONGO_URI Exists:", !!process.env.MONGO_URI);
    console.log(
      "Mongo URI Starts:",
      process.env.MONGO_URI
        ? process.env.MONGO_URI.substring(0, 20)
        : "NOT FOUND"
    );

    const db = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      maxPoolSize: 10,
    });

    isConnected = db.connections[0].readyState === 1;
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:");
    console.error(err);
    if (process.env.VERCEL !== "1") {
      process.exit(1);
    }
    throw err;
  }
};

module.exports = connectDB;