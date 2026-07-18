const mongoose = require("mongoose");


const mongo_url = process.env.MONGO_URI;
mongoose.set('bufferTimeoutMS', 60000);

mongoose
  .connect(mongo_url, {
    serverSelectionTimeoutMS: 60000, // 60 seconds
    socketTimeoutMS: 60000, // 60 seconds
    connectTimeoutMS: 60000, // 60 seconds
  })
  .then(() => {
    console.log("MongoDB Connected");
   
  })
  .catch((error) => {
    console.log("MongoDB Connection Error", error);
  });
  