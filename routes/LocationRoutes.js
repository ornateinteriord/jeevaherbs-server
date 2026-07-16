const express = require("express");
const { getStates, getDistricts, getCitiesAndTaluks } = require("../controllers/Location/LocationController");

const router = express.Router();

router.get("/states", getStates);
router.get("/districts/:state", getDistricts);
router.get("/cities-taluks/:state/:district", getCitiesAndTaluks);

module.exports = router;
