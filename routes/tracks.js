const Track = require('../models/track').Track;
const Response = require('../models/response').Response;
const async = require('async');

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
            req.session.tracks[slug] = {
                progress: 1,
                status: 'start',
                responses: []
            };
        }

        res.locals.trackName = track.name;
        res.locals.trackSlug = slug;
        res.locals.currentTrack = track;
        next();
    });
}

module.exports = function(app) {
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
                tracks.push({
                    name: track.name,
                    slug: track.slug,
                    questions: numQuestions,
                    banner: track.banner,
                    description: track.description,
                    percentage: Math.ceil((numResponses / numQuestions) * 100)
                });
            });
            return res.render('track-listing', {
                tracks: tracks,
                error: err
            });
        });
    });

    app.get('/tracks/:slug/start', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackSlug].status;
        if (status === 'complete') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/complete`)
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
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`)
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
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`)
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
        if (req.session.hasOwnProperty('profile')) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/submit`);
        }

        return res.render('track', {
            track: null,
            extraInfo: true,
            error: null,
            pageTitle: `${res.locals.trackName} Track`
        });
    });

    app.post('/tracks/:slug/extra', setUpTrack, function(req, res) {
        if (req.session.hasOwnProperty('profile')) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/submit`);
        }

        // Handle errors for demographics
        req.checkBody('gender').optional({ checkFalsy: true });
        req.checkBody('age').optional({ checkFalsy: true })
            .isInt().range(1, 200);
        req.checkBody('zip_code').optional({ checkFalsy: true }).isInt().len(5);
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
        const zipCode = req.sanitizeBody('zip_code').trim();

        req.session.profile = {
            gender: gender,
            age: age,
            zipCode: zipCode
        };

        req.session.tracks[res.locals.trackSlug].status = 'submit';

        return res.redirect(`/tracks/${res.locals.trackSlug}/submit`);
    });

    app.get('/tracks/:slug/submit', setUpTrack, function(req, res) {
        let status = req.session.tracks[res.locals.trackSlug].status;
        if (status !== 'submit') {
            return res.redirect(`/tracks/${res.locals.trackSlug}/start`)
        } else if (!req.session.hasOwnProperty('profile')) {
            return res.redirect(`/tracks/${res.locals.trackSlug}/extra`);
        }

        let numQuestions = res.locals.currentTrack.questions.length;
        let tasks = [];
        let userResponses = req.session.tracks[res.locals.trackSlug].responses;

        let profile = null;
        if (req.session.hasOwnProperty('profile')) {
            profile = req.session.profile;
        }

        for (let i = 0; i < numQuestions; i++) {
            let response = new Response({
                user: req.session._id,
                answer: userResponses[i],
                profile: profile
            });
            res.locals.currentTrack.questions[i].responses.push(response);
        }
        res.locals.currentTrack.save(function(err, results) {
            if (err) {
                return res.redirect(
                    `/tracks/${res.locals.trackSlug}/start`
                );
            }
            req.session.tracks[res.locals.trackSlug].status = 'complete';
            return res.redirect(`/tracks/${res.locals.trackSlug}/complete`);
        });
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
            status: req.session.tracks[res.locals.trackSlug].status
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
        let tasks = [];
        let userResponses = req.session.tracks[res.locals.trackSlug].responses;
        if (idx + 1 >= numQuestions) {
            // Move to extra questions if about to submit without profile
            if (!req.session.hasOwnProperty('profile')) {
                return res.redirect(`/tracks/${res.locals.trackSlug}/extra`);
            }

            let profile = null;
            if (req.session.hasOwnProperty('profile')) {
                profile = req.session.profile;
            }

            for (let i = 0; i < numQuestions; i++) {
                let response = new Response({
                    user: req.session._id,
                    answer: userResponses[i],
                    profile: profile
                });
                res.locals.currentTrack.questions[i].responses.push(response);
            }
            res.locals.currentTrack.save(function(err, results) {
                if (err) {
                    req.session.tracks[res.locals.trackSlug].status = 'submit';
                    return res.redirect(
                        `/tracks/${res.locals.trackSlug}/submit`
                    );
                }
                req.session.tracks[res.locals.trackSlug].status = 'complete';
                return res.redirect(`/tracks/${res.locals.trackSlug}/complete`);
            });
        } else {
            req.session.tracks[res.locals.trackSlug].progress++;
            return res.redirect(`/tracks/${res.locals.trackSlug}/${idx}`);
        }
    });
};
