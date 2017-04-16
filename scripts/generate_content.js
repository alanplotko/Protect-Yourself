// Set up mongoose
const connection = require('../config/settings').mongodb;
const mongoose = require('mongoose');
const async = require('async');
mongoose.connect(connection.URL);
mongoose.Promise = require('bluebird');
const Track = require('../models/track').Track;
const loremIpsum = require('lorem-ipsum');

function randIntInclusive(low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

function generateQuestions(num) {
    let questions = [];
    for (let i = 0; i < num; i++) {
        questions.push({
            text: loremIpsum({
                count: randIntInclusive(1, 2),
                units: 'sentence',
                format: 'plain'
            }),
            link: 'http://google.com/',
            responses: []
        });
    }
    return questions;
}

let numIterations = randIntInclusive(5, 15);
let tasks = [];
let docs = [];

// Set up general track
docs.push(new Track({
    name: 'general',
    start: loremIpsum({
        count: randIntInclusive(1, 3),
        units: 'paragraph',
        format: 'plain'
    }),
    end: loremIpsum({
        count: 1,
        units: 'paragraph',
        format: 'plain'
    }),
    questions: generateQuestions(randIntInclusive(5, 15))
}));

// Set up other tracks
for (let i = 1; i <= numIterations; i++) {
    docs.push(new Track({
        name: 'track' + i,
        start: loremIpsum({
            count: randIntInclusive(1, 3),
            units: 'paragraph',
            format: 'plain'
        }),
        end: loremIpsum({
            count: 1,
            units: 'paragraph',
            format: 'plain'
        }),
        questions: generateQuestions(randIntInclusive(5, 15))
    }));
}


for (let i = 0; i < docs.length; i++) {
    tasks.push((function(doc) {
        return function(callback) {
            doc.save(callback);
        };
    })(docs[i]));
}

async.parallel(tasks, function(err, results) {
    if (err) {
        console.log(`Errors:\n--------------------\n${err}`);
    } else {
        console.log(`No errors.\nGenerated ${results.length} tracks(s).`);
    }
    mongoose.connection.close();
});
