const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
    // Track name, acts as unique identifier that shows in url (/track/<name>)
    name: {
        type: String,
        index: {
            unique: true
        }
    },
    start: String,      // Start state text
    end: String,        // End state text
    questions: [{
        text: String,   // Question text
        link: String    // URL to learn more about the topic
    }]
});

module.exports.Track = mongoose.model('Track', trackSchema, 'tracks');
