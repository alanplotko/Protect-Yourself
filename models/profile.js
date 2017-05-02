const mongoose = require('mongoose');

// Demographics profile
const profileSchema = new mongoose.Schema({
    user: String,
    gender: String,
    age: Number,
    education: String,
    country: String,
    zipCode: String
});

module.exports.Profile = mongoose.model('Profile', profileSchema);
