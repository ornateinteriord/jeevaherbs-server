const NewsModel = require("../../../models/News/News");

const getNews = async (req, res) => {
  try {
    const newsData = await NewsModel.find();
    return res.status(200).json({ success: true, news: newsData });
  } catch (error) {
    console.error("Error fetching User details:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addNews = async (req, res) => {
  try {
    const { news_details, from_date, to_date } = req.body;
    if (!news_details || !from_date || !to_date) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }
    const [{ maxNewsId = 0 } = {}] = await NewsModel.aggregate([
        { $match: { news_id: { $ne: null } } }, 
        { $group: { _id: null, maxNewsId: { $max: { $toInt: "$news_id" } } } } 
      ]);

    const newNews = new NewsModel({
        news_id: (maxNewsId + 1).toString(), 
        news_details,
        from_date,
        to_date
      });
    
      await newNews.save();
      res.status(201).json({ success: true, message: "News added successfully", news: newNews });
  } catch (error) {
    console.error("Error fetching User details:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getNews, addNews };
