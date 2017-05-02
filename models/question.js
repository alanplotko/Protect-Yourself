const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: String,       // Question text
    link: String,       // URL to learn more about the topic
    expected: String,   // The response (yes or no) expected for a secure user
    responses: [{
        answer: String,
        inQuestionClicks: { type: Number, default: 0 },
        inSummaryClicks: { type: Number, default: 0 },
        profile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Profile'
        }
    }]
});

module.exports.Question = mongoose.model('Question', questionSchema);
