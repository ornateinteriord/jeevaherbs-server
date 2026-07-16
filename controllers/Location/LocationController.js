const fs = require('fs');
const path = require('path');

const getLocationsData = () => {
  const dataPath = path.join(__dirname, '../../data/locations.json');
  const rawData = fs.readFileSync(dataPath);
  return JSON.parse(rawData);
};

const getCitiesData = () => {
  const dataPath = path.join(__dirname, '../../data/cities.json');
  const rawData = fs.readFileSync(dataPath);
  return JSON.parse(rawData);
};

const getStates = (req, res) => {
  try {
    const locations = getLocationsData();
    const states = locations.map(loc => loc.state);
    res.status(200).json({ success: true, states });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching states", error: error.message });
  }
};

const getDistricts = (req, res) => {
  try {
    const { state } = req.params;
    const locations = getLocationsData();
    const stateData = locations.find(loc => loc.state === state);
    
    if (!stateData) {
      return res.status(404).json({ success: false, message: "State not found" });
    }
    
    const districts = stateData.districts.map(d => d.district);
    res.status(200).json({ success: true, districts });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching districts", error: error.message });
  }
};

const getCitiesAndTaluks = (req, res) => {
  try {
    const { state, district } = req.params;
    const locations = getLocationsData();
    const allCities = getCitiesData();
    
    const stateData = locations.find(loc => loc.state === state);
    if (!stateData) {
      return res.status(404).json({ success: false, message: "State not found" });
    }
    
    // Filter cities from the real cities database based on the selected state
    const stateCities = allCities
        .filter(c => c.state === state)
        .map(c => c.name);

    // Provide the real cities for the dropdown, and empty taluks (since users can type taluks)
    res.status(200).json({ 
      success: true, 
      cities: stateCities || [],
      taluks: []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching cities and taluks", error: error.message });
  }
};

module.exports = {
  getStates,
  getDistricts,
  getCitiesAndTaluks
};
