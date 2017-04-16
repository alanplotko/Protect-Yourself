const mongoose = require('mongoose');
const Response = require('../models/response').Response;

const questionSchema = new mongoose.Schema({
    text: String,   // Question text
    link: String,   // URL to learn more about the topic
    responses: [Response.schema]
});

module.exports.Question = mongoose.model('Question', questionSchema);
