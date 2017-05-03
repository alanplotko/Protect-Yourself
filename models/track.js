const mongoose = require('mongoose');
const Question = require('../models/question').Question;

const trackSchema = new mongoose.Schema({
    // Canonical slug, unique identifier that shows in url (/tracks/<name>)
    slug: {
        type: String,
        index: {
            unique: true
        }
    },
    name: String,           // Track name
    banner: String,         // Image to display in track listing
    description: String,    // Description to display in track
    start: String,          // Start state text
    end: String,            // End state text
    questions: [Question.schema]
});

module.exports.Track = mongoose.model('Track', trackSchema, 'tracks');
