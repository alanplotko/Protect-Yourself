// Set up mongoose
const connection = require('../config/settings').mongodb;
const mongoose = require('mongoose');
const async = require('async');
mongoose.connect(connection.URL);
mongoose.Promise = require('bluebird');
const Track = require('../models/track').Track;
const stripNewlines = require('strip-newlines');

let tasks = [];
let responses = 0;
let cleared = 0;

Track.find({
    'questions.responses._id': {
        $exists: true
    }
}, function(err, docs) {
    if (err) {
        console.log('Errors:\n--------------------');
        console.log(err);
    } else {
        docs.forEach(function(doc) {
            doc.questions.forEach(function(question) {
                question.responses = [];
                responses++;
            });
            tasks.push((function(doc) {
                return function(callback) {
                    doc.save(function(err, results) {
                        if (!err) cleared += doc.questions.length;
                        callback(err, results);
                    });
                };
            })(doc));
        });
        async.parallel(tasks, function(err, results) {
            if (err) {
                console.log(`Errors:\n--------------------\n${err}`);
            } else {
                console.log('No errors.');
                console.log(stripNewlines`Found ${results.length} tracks
                    with ${responses} responses in total.`);
                console.log(`Removed ${cleared} of ${responses} response(s).`);
            }
            mongoose.connection.close();
        });
    }
});
