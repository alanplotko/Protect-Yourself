// Set up mongoose
const connection = require('../config/settings').mongodb;
const mongoose = require('mongoose');
const async = require('async');
mongoose.connect(connection.URL);
mongoose.Promise = require('bluebird');
const Track = require('../models/track').Track;
const loremIpsum = require('lorem-ipsum');
const MIN = 5, MAX = 15;

// Random assortment of buzzwords for generating track names
const buzzwords = [
    'Machine Learning',
    'CMS Security',
    'Data Mining',
    'Mobile Security',
    'Phishing',
    'Email Security',
    'Social Engineering',
    'E-commerce',
    'Android',
    'iOS',
    'Web Security',
    'Online Banking',
    'Personal Information',
    'Public WiFi',
    'Smart TV'
];

// Requirement: length >= upper bound for numIterations
if (buzzwords.length < MAX) {
    throw "Error: Buzzword count < upper bound for numIterations.";
}

function randIntInclusive(low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

function generateQuestions(num) {
    let questions = [];
    for (let i = 0; i < num; i++) {
        let expected = randIntInclusive(0, 1);
        questions.push({
            text: loremIpsum({
                count: randIntInclusive(1, 2),
                units: 'sentence',
                format: 'plain'
            }),
            link: 'http://google.com/',
            expected: (expected === 0) ? 'yes' : 'no',
            responses: []
        });
    }
    return questions;
}

let numIterations = randIntInclusive(MIN, MAX);
let tasks = [];
let docs = [];

// Set up general track
const general = require('./tracks/general.json');
docs.push(new Track(general));

// Set up other tracks
for (let i = 1; i <= numIterations; i++) {
    let idx = randIntInclusive(0, buzzwords.length - 1);
    let name = buzzwords[idx];
    buzzwords.splice(idx, 1);
    docs.push(new Track({
        name: name,
        slug: name.toLowerCase().replace(' ', '-'),
        banner: 'generic-track-banner.jpg',
        description: loremIpsum({
            count: randIntInclusive(15, 25),
            units: 'word',
            format: 'plain'
        }),
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

// Number of tracks (plus required general track)
let numTracks = numIterations + 1;
let numInserted = 0;

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
        console.log(`Inserted ${numInserted} of ${numTracks} tracks(s).`);
    } else {
        console.log('No errors.');
        console.log(`Inserted ${numInserted} of ${numTracks} tracks(s).`);
    }
    mongoose.connection.close();
});
