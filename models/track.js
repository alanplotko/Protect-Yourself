const mongoose = require('mongoose');
const Question = require('../models/question').Question;

const trackSchema = new mongoose.Schema({
    // Track name, acts as unique identifier that shows in url (/tracks/<name>)
    name: {
        type: String,
        index: {
            unique: true
        }
    },
    start: String,  // Start state text
    end: String,    // End state text
    questions: [Question.schema]
});

module.exports.Track = mongoose.model('Track', trackSchema, 'tracks');
