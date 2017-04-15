const mongoose = require('mongoose');

const checkupSchema = new mongoose.Schema({
    title: String,
    description: String,
    view: String,
    disable: String,
    step: {
        type: Number,
        index: {
            unique: true
        }
    },
    tags: [String]
});

module.exports.CheckupItem = mongoose.model('CheckupItem', checkupSchema,
    'security');
