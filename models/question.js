const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: String,        // Question text
    link: String,        // URL to learn more about the topic
    expected: String,    // The response (yes or no) expected for a secure user
    subject: String,     // The specific subject that the question covers
    tag: String,         // The general area that the question covers
    explanation: String, // Show in summary if the user answers not as expected
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
