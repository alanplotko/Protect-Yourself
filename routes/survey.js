const Track = require('../models/track').Track;
const Response = require('../models/response').Response;
const async = require('async');

let setUpTrack = function(req, res, next) {
    // Handle errors for track name
    req.checkParams('name').notEmpty();
    let error = req.validationErrors();
    if (error) return res.redirect('/');

    // Validate session and set up track
    let trackName = req.sanitizeParams('name').trim();
    if (!req.session.hasOwnProperty('tracks')) {
        req.session.tracks = {};
    }

    Track.findOne({ 'name': trackName }, function(err, track) {
        // Redirect failed or unknown requests back to home
        if (err || track == null) {
            return res.redirect('/');
        }

        if (!req.session.tracks.hasOwnProperty(trackName)) {
            req.session.tracks[trackName] = {
                progress: 1,
                status: 'start',
                responses: []
            };
        }

        res.locals.trackName = trackName;
        res.locals.currentTrack = track;
        next();
    });
}

module.exports = function(app) {
    app.get('/tracks/:name/start', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackName].status;
        if (status === 'complete') {
            return res.redirect(`/tracks/${res.locals.trackName}/complete`)
        }

        let track = {
            name: res.locals.trackName,
            content: res.locals.currentTrack.start,
            status: status
        };
        let label = 'Start'; // Default label for new users
        let link = `/tracks/${track.name}/1`; // Start at first question
        let progress = req.session.tracks[track.name].progress;

        // Allow users to resume progress (fetched from session)
        if (status === 'pending') {
            label = 'Resume';
            link = `/tracks/${track.name}/${progress}`;
        } else if (status === 'submit') {
            label = 'Complete';
            link = `/tracks/${track.name}/submit`;
        }

        return res.render('survey', {
            track: track,
            actionBtnLabel: label,
            actionBtnLink: link
        });
    });

    app.get('/tracks/:name/complete', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackName].status;
        if (status !== 'complete') {
            return res.redirect(`/tracks/${res.locals.trackName}/start`)
        }

        let track = {
            name: res.locals.trackName,
            content: res.locals.currentTrack.end,
            status: status
        };
        let label = 'Review'; // If complete, users can review their responses
        let link = `/tracks/${track.name}/review`; // Review url

        return res.render('survey', {
            track: track,
            actionBtnLabel: label,
            actionBtnLink: link
        });
    });

    app.get('/tracks/:name/review', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackName].status;
        if (status !== 'complete') {
            return res.redirect(`/tracks/${res.locals.trackName}/start`)
        }

        let track = {
            name: res.locals.trackName,
            questions: res.locals.currentTrack.questions
        };

        return res.render('summary', {
            track: track,
            responses: req.session.tracks[res.locals.trackName].responses
        });
    });

    app.get('/tracks/:name/submit', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackName].status;
        if (status !== 'submit') {
            return res.redirect(`/tracks/${res.locals.trackName}/start`)
        }

        let numQuestions = res.locals.currentTrack.questions.length;
        let tasks = [];
        let userResponses = req.session.tracks[res.locals.trackName].responses;
        for (let i = 0; i < numQuestions; i++) {
            let response = new Response({
                user: req.session._id,
                answer: userResponses[i]
            });
            res.locals.currentTrack.questions[i].responses.push(response);
        }
        res.locals.currentTrack.save(function(err, results) {
            if (err) {
                return res.redirect(
                    `/tracks/${res.locals.trackName}/start`
                );
            }
            req.session.tracks[res.locals.trackName].status = 'complete';
            return res.redirect(`/tracks/${res.locals.trackName}/complete`);
        });
    });

    app.get('/tracks/:name/:question', setUpTrack, function(req, res) {
        // Handle errors for question number
        req.checkParams('question').notEmpty().isInt();
        let error = req.validationErrors();
        if (error) {
            return res.redirect(`/tracks/${res.locals.trackName}/start`);
        }

        // Check if already complete
        if (req.session.tracks[res.locals.trackName].status === 'complete') {
            return res.redirect(`/tracks/${res.locals.trackName}/complete`);
        }

        // Validate question number
        let questionNo = parseInt(req.sanitizeParams('question'));
        let idx = questionNo - 1;
        let progress = req.session.tracks[res.locals.trackName].progress;
        if (idx > res.locals.currentTrack.questions.length || idx < 0 ||
            questionNo != progress) {
            return res.redirect(`/tracks/${res.locals.trackName}/${progress}`);
        }

        // Ensure user marked for starting track
        req.session.tracks[res.locals.trackName].status = 'pending';

        let track = {
            name: res.locals.trackName,
            content: res.locals.currentTrack.questions[idx].text,
            status: req.session.tracks[res.locals.trackName].status
        };
        let link = `/tracks/${track.name}/${questionNo}`;

        return res.render('survey', {
            track: track,
            baseResponseLink: link,
            learnMoreBtnLink: res.locals.currentTrack.questions[idx].link
        });
    });

    app.get('/tracks/:name/:question/:answer', setUpTrack, function(req, res) {
        // Handle errors for user's answer
        req.checkParams('answer').notEmpty();
        let error = req.validationErrors();
        if (error) {
            return res.redirect(`/tracks/${res.locals.trackName}/start`);
        }

        // Check if already complete
        if (req.session.tracks[res.locals.trackName].status === 'complete') {
            return res.redirect(`/tracks/${res.locals.trackName}/complete`);
        }

        // Validate question number
        let qNo = parseInt(req.sanitizeParams('question'));
        let idx = qNo - 1;
        let progress = req.session.tracks[res.locals.trackName].progress;
        if (idx > res.locals.currentTrack.questions.length || idx < 0 ||
            qNo != progress) {
            return res.redirect(`/tracks/${res.locals.trackName}/${progress}`);
        }

        // Process response
        let answer = req.sanitize('answer').trim();
        if (answer !== 'yes' && answer !== 'no') {
            return res.redirect(`/tracks/${res.locals.trackName}/start`);
        }
        req.session.tracks[res.locals.trackName].responses.push(answer);

        // Increment question number
        let numQuestions = res.locals.currentTrack.questions.length;
        let tasks = [];
        let userResponses = req.session.tracks[res.locals.trackName].responses;
        if (idx + 1 >= numQuestions) {
            for (let i = 0; i < numQuestions; i++) {
                let response = new Response({
                    user: req.session._id,
                    answer: userResponses[i]
                });
                res.locals.currentTrack.questions[i].responses.push(response);
            }
            res.locals.currentTrack.save(function(err, results) {
                if (err) {
                    req.session.tracks[res.locals.trackName].status = 'submit';
                    return res.redirect(
                        `/tracks/${res.locals.trackName}/submit`
                    );
                }
                req.session.tracks[res.locals.trackName].status = 'complete';
                return res.redirect(`/tracks/${res.locals.trackName}/complete`);
            });
        } else {
            req.session.tracks[res.locals.trackName].progress++;
            return res.redirect(`/tracks/${res.locals.trackName}/${idx}`);
        }
    });
};
