const Track = require('../models/track').Track;
const Profile = require('../models/profile').Profile;
const ObjectID = require('mongoose').mongo.ObjectID;
const mongoose = require('mongoose');
const async = require('async');
const jStat = require('jStat').jStat;

let setUpTrack = function(req, res, next) {
    // Handle errors for track slug
    req.checkParams('slug').notEmpty();
    let error = req.validationErrors();
    if (error) return res.redirect('/');

    // Validate session and set up track
    let slug = req.sanitizeParams('slug').trim();
    if (!req.session.hasOwnProperty('tracks')) {
        req.session.tracks = {};
    }

    Track.findOne({ 'slug': slug }, function(err, track) {
        // Redirect failed or unknown requests back to home
        if (err || track == null) {
            return res.redirect('/');
        }

        if (!req.session.tracks.hasOwnProperty(slug)) {
            let numQuestions = track.questions.length;
            req.session.tracks[slug] = {
                progress: 1,
                status: 'start',
                responses: [],
                inQuestionClicks: Array(numQuestions).fill(0),
                inSummaryClickIds: Array(numQuestions).fill(0)
            };
        }

        res.locals.trackName = track.name;
        res.locals.trackSlug = slug;
        res.locals.currentTrack = track;
        next();
    });
};

let analyzeTrack = function(req, res, next) {
    // Handle errors for track slug
    req.checkParams('slug').notEmpty();
    let error = req.validationErrors();
    if (error) return res.redirect('/');

    // Validate session and set up track
    let slug = req.sanitizeParams('slug').trim();
    if (!req.session.hasOwnProperty('tracks')) {
        req.session.tracks = {};
    }

    Track.findOne({ 'slug': slug }).populate('questions.responses.profile')
        .exec(function(err, track) {
            // Redirect failed or unknown requests back to home
            if (err || track == null) {
                return res.redirect('/');
            }

            res.locals.trackName = track.name;
            res.locals.trackSlug = slug;
            res.locals.currentTrack = track;
            next();
        });
}

const calcStdErr = function(a1, a2) {
    let s1 = jStat.variance(a1, true),
        s2 = jStat.variance(a2, true);
    return Math.sqrt((s1 / a1.length) + (s2 / a2.length));
};

const calcZScore = function(meanA1, meanA2, StdErr) {
    return (meanA1 - meanA2) / StdErr;
};

const calcPValue = function(zScore) {
    return jStat.ztest(zScore, 1);
};

module.exports = function(app) {
    app.get('/analyze/:slug', analyzeTrack, function(req, res) {
        let tasks = [];

        let calcStats = function() {
            return function(callback) {
                let qs = res.locals.currentTrack.questions;
                let secureLte26 = [], secureGt26 = [];
                let numQuestions = qs.length,
                    numProfiles = qs[0].responses.length;
                let i = 0, j = 0;
                for (i = 0; i < numProfiles; i++) {
                    let score = 0;
                    let age = qs[0].responses[i].profile.age;
                    if (age === null) continue;
                    for (j = 0; j < numQuestions; j++) {
                        if (qs[j].responses[i].answer === qs[j].expected) {
                            score++;
                        }
                    }
                    if (age > 26) {
                        secureGt26.push(score);
                    } else {
                        secureLte26.push(score);
                    }
                }

                let meanA1 = jStat.mean(secureLte26),
                    meanA2 = jStat.mean(secureGt26),
                    stdErr = calcStdErr(secureLte26, secureGt26),
                    zScore = calcZScore(meanA1, meanA2, stdErr),
                    pValue = calcPValue(zScore);

                callback(null, {
                    '26 and under': {
                        'Secure avg': meanA1,
                        'Score array': JSON.stringify(secureLte26),
                        'Total': secureLte26.length
                    },
                    'Over 26': {
                        'Secure avg': meanA2,
                        'Score array': JSON.stringify(secureGt26),
                        'Total': secureGt26.length
                    },
                    'Std err': stdErr,
                    'Z score': zScore,
                    'P value': pValue
                });
            };
        };

        tasks.push(calcStats());

        // Organize results and send to console
        async.parallel(tasks, function(err, results) {
            if (err) return res.render('error');
            console.log(results);
            return res.render('index');
        });
    });

    app.get('/tracks', function(req, res) {
        // Set up tracks in session
        if (!req.session.hasOwnProperty('tracks')) {
            req.session.tracks = {};
        }

        let tracks = [];
        Track.find({}, function(err, results) {
            results.forEach(function(track) {
                let numResponses = 0;
                let numQuestions = track.questions.length;
                if (req.session.tracks.hasOwnProperty(track.slug)) {
                    numResponses = req.session.tracks[track.slug]
                        .responses.length;
                }
                let status = null;
                if (req.session.tracks[track.slug] &&
                    req.session.tracks[track.slug].status) {
                    status = req.session.tracks[track.slug].status;
                }
                tracks.push({
                    name: track.name,
                    slug: track.slug,
                    questions: numQuestions,
                    banner: track.banner,
                    description: track.description,
                    status: status,
                    percentage: Math.ceil((numResponses / numQuestions) * 100)
                });
            });
            return res.render('track-listing', {
                tracks: tracks,
                error: err
            });
        });
    });

    app.get('/tracks/:slug/dashboard', analyzeTrack, function(req, res) {
        let tasks = [];

        let countRecords = function(collectionName) {
            return function(callback) {
                mongoose.connection.collection(collectionName)
                    .find().count(function(err, count) {
                        callback(err, count);
                    });
            };
        };

        let countYeses = function() {
            return function(callback) {
                let questions = res.locals.currentTrack.questions;
                let yeses = [];
                for (let i = 0; i < questions.length; i++) {
                    let count = 0;
                    for (let j = 0; j < questions[i].responses.length; j++) {
                        if (questions[i].responses[j].answer === 'yes') {
                            count++;
                        }
                    }
                    yeses.push(count);
                }
                callback(null, yeses);
            };
        };

        let countStatus = function(status) {
            return function(callback) {
                mongoose.connection.collection('sessions')
                    .find({
                        'session': {
                            '$regex': new RegExp('.*' + status + '.*')
                        }
                    })
                    .count(function(err, count) {
                        callback(err, count);
                    });
            };
        };

        let countProfile = function(query) {
            return function(callback) {
                Profile.find(query).count(function(err, result) {
                    callback(err, result);
                });
            };
        };

        tasks.push(countRecords('sessions'));
        tasks.push(countRecords('profiles'));
        tasks.push(countYeses());

        tasks.push(countStatus('start'));
        tasks.push(countStatus('pending'));
        tasks.push(countStatus('resubmit'));
        tasks.push(countStatus('complete'));

        tasks.push(countProfile({ 'gender': 'male' }));
        tasks.push(countProfile({ 'gender': 'female' }));
        tasks.push(countProfile({ 'gender': 'other' }));
        tasks.push(countProfile({ 'gender': '' }));
        tasks.push(countProfile({ 'education': 'prehs' }));
        tasks.push(countProfile({ 'education': 'hs' }));
        tasks.push(countProfile({ 'education': 'someuni' }));
        tasks.push(countProfile({ 'education': 'associates' }));
        tasks.push(countProfile({ 'education': 'bachelors' }));
        tasks.push(countProfile({ 'education': 'masters' }));
        tasks.push(countProfile({ 'education': 'phd' }));
        tasks.push(countProfile({ 'education': '' }));
        tasks.push(countProfile({ 'age': { '$gt': 26 } }));
        tasks.push(countProfile({ 'age': { '$lte': 26 } }));
        tasks.push(countProfile({ 'age': null }));

        // Organize results and send to dashboard view
        async.parallel(tasks, function(err, results) {
            if (err) return res.render('error');
            return res.render('dashboard', {
                trackName: res.locals.currentTrack.name,
                trackSlug: res.locals.trackSlug,
                numUsers: results[0],
                numProfiles: results[1],
                questions: res.locals.currentTrack.questions,
                yeses: results[2],
                numStarted: results[3],
                numPending: results[4],
                numResubmit: results[5],
                numCompleted: results[6],
                gender: {
                    male: results[7],
                    female: results[8],
                    other: results[9],
                    unprovided: results[10]
                },
                education: {
                    prehs: results[11],
                    hs: results[12],
                    someuni: results[13],
                    associates: results[14],
                    bachelors: results[15],
                    masters: results[16],
                    phd: results[17],
                    unprovided: results[18]
                },
                age: {
                    gt: results[19],
                    lte: results[20],
                    unprovided: results[21]
                }
            });
        });
    });

    app.get('/tracks/:slug/dashboard/:question', analyzeTrack,
        function(req, res) {
            // Handle errors for question number
            req.checkParams('question').notEmpty().isInt();
            let error = req.validationErrors();
            if (error) {
                return res.redirect(
                    `/tracks/${res.locals.trackSlug}/dashboard`
                );
            }
            // Validate question number
            let questionNo = parseInt(req.sanitizeParams('question'));
            let idx = questionNo - 1;
            if (idx >= res.locals.currentTrack.questions.length || idx < 0) {
                return res.redirect(
                    `/tracks/${res.locals.trackSlug}/dashboard`
                );
            }

            let tasks = [];

            // Organize results and send to dashboard-question view
            async.parallel(tasks, function(err, results) {
                if (err) return res.render('error');

                let lte26 = results[0], gt26 = results[1];

                return res.render('dashboard-question', {
                    trackName: res.locals.currentTrack.name,
                    trackSlug: res.locals.trackSlug,
                    questionNumber: questionNo,
                    questionText: res.locals.currentTrack.questions[idx].text
                });
            });
    });

    app.get('/tracks/:slug/start', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackSlug].status;
        if (status === 'complete') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/complete`);
        }

        let track = {
            name: res.locals.trackName,
            content: res.locals.currentTrack.start,
            status: status
        };
        let label = 'Start'; // Default label for new users
        let link = `/tracks/${res.locals.trackSlug}/1`; // Start at question 1
        let progress = req.session.tracks[res.locals.trackSlug].progress;

        // Allow users to resume progress (fetched from session)
        if (status === 'pending') {
            label = 'Resume';
            link = `/tracks/${res.locals.trackSlug}/${progress}`;
        } else if (status === 'submit') {
            label = 'Complete';
            link = `/tracks/${res.locals.trackSlug}/extra`;
        }

        return res.render('track', {
            track: track,
            pageTitle: `${track.name} Track`,
            actionBtnLabel: label,
            actionBtnLink: link
        });
    });

    app.get('/tracks/:slug/complete', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackSlug].status;
        if (status !== 'complete') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`);
        }

        let track = {
            name: res.locals.trackName,
            content: res.locals.currentTrack.end,
            status: status
        };
        let label = 'Review'; // If complete, users can review their responses
        let link = `/tracks/${res.locals.trackSlug}/review`; // Review URL

        return res.render('track', {
            track: track,
            pageTitle: `${track.name} Track`,
            actionBtnLabel: label,
            actionBtnLink: link
        });
    });

    app.get('/tracks/:slug/review', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackSlug].status;
        if (status !== 'complete') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`);
        }

        let track = {
            name: res.locals.trackName,
            questions: res.locals.currentTrack.questions
        };

        return res.render('summary', {
            track: track,
            responses: req.session.tracks[res.locals.trackSlug].responses
        });
    });

    app.get('/tracks/:slug/extra', setUpTrack, function(req, res) {
        if (req.session.hasOwnProperty('profile') ||
            req.session.hasOwnProperty('profileId')) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/submit`);
        }

        return res.render('track', {
            track: null,
            extraInfo: true,
            error: null,
            pageTitle: `${res.locals.trackName} Track`
        });
    });

    app.get('/tracks/:slug/out', setUpTrack, function(req, res) {
        let idx = req.session.tracks[res.locals.trackSlug].progress - 1;
        req.checkQuery('link').notEmpty();
        req.checkQuery('ref').notEmpty();
        let error = req.validationErrors();
        if (error) return res.render('error');

        let url = req.sanitizeQuery('link').trim();
        let ref = req.sanitizeQuery('ref').trim()

        if (ref === 'question' &&
            req.session.tracks[res.locals.trackSlug].status !== 'complete') {
            req.session.tracks[res.locals.trackSlug].inQuestionClicks[idx]++;
            return res.redirect(url);
        } else if (ref === 'summary') {
            req.checkQuery('q').notEmpty().isInt();
            error = req.validationErrors();
            if (error) return res.render('error');

            idx = parseInt(req.sanitizeQuery('q').trim()) - 1;
            if (idx >= req.session.tracks[res.locals.trackSlug]
                .inSummaryClickIds.length) {
                return res.render('error');
            }

            let findQuery = {};
            findQuery['slug'] = res.locals.trackSlug;
            findQuery[`questions.${idx}.responses._id`] =
                ObjectID(req.session.tracks[res.locals.trackSlug]
                .inSummaryClickIds[idx]);
            let updateQuery = {}, nestedQuery = {};
            nestedQuery[`questions.${idx}.responses.$.inSummaryClicks`] = 1;
            updateQuery['$inc'] = nestedQuery;

            Track.update(findQuery, updateQuery, function(err, track) {
                if (err || track == null) {
                    return res.render('error');
                }
                return res.redirect(url);
            });
        } else {
            return res.render('error');
        }
    });

    app.post('/tracks/:slug/extra', setUpTrack, function(req, res) {
        if (req.session.hasOwnProperty('profile') ||
            req.session.hasOwnProperty('profileId')) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/submit`);
        }

        // Handle errors for demographics
        req.checkBody('gender').optional({ checkFalsy: true });
        req.checkBody('age').optional({ checkFalsy: true })
            .isInt().range(1, 200);
        req.checkBody('education').optional({ checkFalsy: true });
        req.checkBody('country').optional({ checkFalsy: true });
        req.checkBody('zip_code').optional({ checkFalsy: true })
            .isInt().positive().len(5);
        let error = req.validationErrors();
        if (error) {
            return res.render('track', {
                track: null,
                extraInfo: true,
                error: error,
                pageTitle: `${res.locals.trackName} Track`
            });
        }

        // Validate demographics and set up profile
        const gender = req.sanitizeBody('gender').trim();
        const age = req.sanitizeBody('age').trim();
        const education = req.sanitizeBody('education').trim();
        const country = req.sanitizeBody('country').trim();
        const zipCode = (country !== 'us') ? '' :
            req.sanitizeBody('zip_code').trim();

        req.session.profile = {
            user: req.sessionID,
            gender: gender,
            age: age,
            education: education,
            country: country,
            zipCode: zipCode
        };

        req.session.tracks[res.locals.trackSlug].status = 'submit';

        return res.redirect(`/tracks/${res.locals.trackSlug}/submit`);
    });

    app.get('/tracks/:slug/submit', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackSlug].status;
        if (status !== 'submit') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`);
        } else if (!req.session.hasOwnProperty('profile') &&
            !req.session.hasOwnProperty('profileId')) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/extra`);
        }

        let numQuestions = res.locals.currentTrack.questions.length;
        let userResponses = req.session.tracks[res.locals.trackSlug].responses;

        let saveResponses = function(profileId) {
            for (let i = 0; i < numQuestions; i++) {
                let response = {
                    _id: ObjectID(),
                    answer: userResponses[i],
                    profile: profileId,
                    inQuestionClicks: req.session
                        .tracks[res.locals.trackSlug].inQuestionClicks[i],
                    inSummaryClicks: 0
                };
                req.session.tracks[res.locals.trackSlug].inSummaryClickIds[i] =
                    response._id;
                res.locals.currentTrack.questions[i].responses.push(response);
            }
            res.locals.currentTrack.save(function(err, result) {
                if (err) {
                    return res.redirect(
                        `/tracks/${res.locals.trackSlug}/start`
                    );
                }
                req.session.tracks[res.locals.trackSlug].status = 'complete';
                return res.redirect(`/tracks/${res.locals.trackSlug}/complete`);
            });
        };

        if (req.session.hasOwnProperty('profileId')) {
            saveResponses(req.session.profileId);
        } else {
            let profile = new Profile(req.session.profile);
            profile.save(function(err, profile) {
                if (err) {
                    req.session.tracks[res.locals.trackSlug]
                        .status = 'submit';
                    return res
                        .redirect(`/tracks/${res.locals.trackSlug}/start`);
                }
                delete req.session.profile;
                req.session.profileId = profile._id;
                saveResponses(profile._id);
            });
        }
    });

    app.get('/tracks/:slug/:question', setUpTrack, function(req, res) {
        // Handle errors for question number
        req.checkParams('question').notEmpty().isInt();
        let error = req.validationErrors();
        if (error) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`);
        }

        // Check if already complete
        if (req.session.tracks[res.locals.trackSlug].status === 'complete') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/complete`);
        }

        // Validate question number
        let questionNo = parseInt(req.sanitizeParams('question'));
        let idx = questionNo - 1;
        let progress = req.session.tracks[res.locals.trackSlug].progress;
        if (idx > res.locals.currentTrack.questions.length || idx < 0 ||
            questionNo != progress) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/${progress}`);
        }

        // Ensure user marked for starting track
        req.session.tracks[res.locals.trackSlug].status = 'pending';

        let track = {
            name: res.locals.trackName,
            content: res.locals.currentTrack.questions[idx].text,
            status: req.session.tracks[res.locals.trackSlug].status,
            questionNo: questionNo,
            questionTotal: res.locals.currentTrack.questions.length
        };
        let link = `/tracks/${res.locals.trackSlug}/${questionNo}`;

        return res.render('track', {
            track: track,
            pageTitle: `${track.name} Track`,
            baseResponseLink: link,
            learnMoreBtnLink: res.locals.currentTrack.questions[idx].link
        });
    });

    app.get('/tracks/:slug/:question/:answer', setUpTrack, function(req, res) {
        // Handle errors for user's answer
        req.checkParams('answer').notEmpty();
        let error = req.validationErrors();
        if (error) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`);
        }

        // Check if already complete
        if (req.session.tracks[res.locals.trackSlug].status === 'complete') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/complete`);
        }

        // Validate question number
        let qNo = parseInt(req.sanitizeParams('question'));
        let idx = qNo - 1;
        let progress = req.session.tracks[res.locals.trackSlug].progress;
        if (idx > res.locals.currentTrack.questions.length || idx < 0 ||
            qNo != progress) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/${progress}`);
        }

        // Process response
        let answer = req.sanitize('answer').trim();
        if (answer !== 'yes' && answer !== 'no') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`);
        }
        req.session.tracks[res.locals.trackSlug].responses.push(answer);

        // Increment question number
        let numQuestions = res.locals.currentTrack.questions.length;
        let userResponses = req.session.tracks[res.locals.trackSlug].responses;
        if (idx + 1 >= numQuestions) {
            // Move to extra questions if about to submit without profile
            if (!req.session.hasOwnProperty('profile') &&
                !req.session.hasOwnProperty('profileId')) {
                req.session.tracks[res.locals.trackSlug].status = 'submit';
                return res.redirect(`/tracks/${res.locals.trackSlug}/extra`);
            }

            // Submit if profile already available
            let saveResponses = function(profileId) {
                for (let i = 0; i < numQuestions; i++) {
                    let response = {
                        answer: userResponses[i],
                        profile: profileId,
                        inQuestionClicks: req.session
                            .tracks[res.locals.trackSlug].inQuestionClicks[i],
                        inSummaryClicks: req.session
                            .tracks[res.locals.trackSlug].inSummaryClicks[i]
                    };
                    res.locals.currentTrack.questions[i].responses
                        .push(response);
                }
                res.locals.currentTrack.save(function(err, results) {
                    if (err) {
                        return res.redirect(
                            `/tracks/${res.locals.trackSlug}/start`
                        );
                    }
                    req.session.tracks[res.locals.trackSlug]
                        .status = 'complete';
                    return res
                        .redirect(`/tracks/${res.locals.trackSlug}/complete`);
                });
            };

            if (req.session.hasOwnProperty('profileId')) {
                saveResponses(req.session.profileId);
            } else {
                let profile = new Profile(req.session.profile);
                profile.save(function(err, profile) {
                    if (err) {
                        req.session.tracks[res.locals.trackSlug]
                            .status = 'submit';
                        return res
                            .redirect(`/tracks/${res.locals.trackSlug}/start`);
                    }
                    delete req.session.profile;
                    req.session.profileId = profile._id;
                    saveResponses(profile._id);
                });
            }
        } else {
            req.session.tracks[res.locals.trackSlug].progress++;
            return res.redirect(`/tracks/${res.locals.trackSlug}/${idx}`);
        }
    });
};
