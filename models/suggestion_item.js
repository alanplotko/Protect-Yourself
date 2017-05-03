const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    title: String,
    description: String,
    view: String,
    disable: String,
    timestamp: { type: Date, default: Date.now },
    upvotes: { type: Number, default: 0 },
    tags: [String],
    author: String
});

suggestionSchema.statics.random = function(callback) {
    this.count(function(err, count) {
        if (err) {
            return callback(err);
        }
        let rand = Math.floor(Math.random() * count);
        this.findOne().skip(rand).exec(callback);
    }.bind(this));
};

module.exports.SuggestionItem = mongoose.model('SuggestionItem',
    suggestionSchema, 'suggestions');
