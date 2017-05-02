const mongoose = require('mongoose');
const Profile = require('../models/profile').Profile;

const questionSchema = new mongoose.Schema({
    text: String,       // Question text
    link: String,       // URL to learn more about the topic
    expected: String,   // The response (yes or no) expected for a secure user
    responses: [{
        answer: String,
        profile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Profile'
        }
    }]
});

module.exports.Question = mongoose.model('Question', questionSchema);
