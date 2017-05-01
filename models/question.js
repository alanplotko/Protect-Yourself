const mongoose = require('mongoose');
const Response = require('../models/response').Response;

const questionSchema = new mongoose.Schema({
    text: String,       // Question text
    link: String,       // URL to learn more about the topic
    expected: String,   // The response (yes or no) expected for a secure user
    responses: [Response.schema]
});

module.exports.Question = mongoose.model('Question', questionSchema);
