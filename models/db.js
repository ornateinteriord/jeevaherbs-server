const mongoose = require("mongoose");


const mongo_url = process.env.MONGO_URI;
mongoose.set('bufferTimeoutMS', 30000);

mongoose
  .connect(mongo_url, {
    serverSelectionTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 45000, // 45 seconds
    connectTimeoutMS: 30000, // 30 seconds
  })
  .then(() => {
    console.log("MongoDB Connected");
   
  })
  .catch((error) => {
    console.log("MongoDB Connection Error", error);
  });
  