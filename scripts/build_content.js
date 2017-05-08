// Set up mongoose
const connection = require('../config/settings').mongodb;
const mongoose = require('mongoose');
const async = require('async');
mongoose.connect(connection.URL);
mongoose.Promise = require('bluebird');
const Track = require('../models/track').Track;

// Track content to insert into database
let tasks = [], docs = [];
let numInserted = 0;

// Set up tracks
docs.push(new Track(require('./tracks/general.json')));

for (let i = 0; i < docs.length; i++) {
    tasks.push((function(doc) {
        return function(callback) {
            doc.save(function(err, result) {
                if (!err) numInserted++;
                callback(err, result);
            });
        };
    })(docs[i]));
}

async.parallel(tasks, function(err, results) {
    if (err) {
        console.log(`Errors:\n--------------------\n${err}`);
        console.log(`Inserted ${numInserted} of ${docs.length} track(s).`);
    } else {
        console.log('No errors.');
        console.log(`Inserted ${numInserted} of ${docs.length} track(s).`);
    }
    mongoose.connection.close();
});
