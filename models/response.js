const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
    user: String,   // Identifier for the user (e.g. session id)
    answer: String, // The user's answer (e.g. 'yes', 'no')

    // Provided demographics
    profile: {
        gender: String,
        age: Number,
        zipCode: String
    }
});

module.exports.Response = mongoose.model('Response', responseSchema);
