const mongoose = require("mongoose");


const mongo_url = process.env.MONGO_URI;
mongoose
  .connect(mongo_url)
  .then(() => {
    console.log("MongoDB Connected");
   
  })
  .catch((error) => {
    console.log("MongoDB Connection Error", error);
  });
  