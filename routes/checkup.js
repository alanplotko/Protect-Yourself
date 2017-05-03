const CheckupItem = require('../models/checkup_item').CheckupItem;
const SuggestionItem = require('../models/suggestion_item').SuggestionItem;
const stripNewlines = require('strip-newlines');

module.exports = function(app) {
    app.get('/checkup/facebook', function(req, res) {
        res.render('check-site', {
            header: 'Are your Facebook posts public?',
            subtitle: 'Let\'s take a look!',
            service: 'Facebook',
            label: 'Username',
            color: 'blue'
        });
    });

    app.post('/checkup/facebook', function(req, res) {
        // Handle errors for username
        req.checkBody('data').notEmpty();
        let error = req.validationErrors();
        if (error) {
            return res.redirect('/checkup/facebook');
        }
        let username = req.sanitizeBody('data').trim();
        return res.redirect(stripNewlines`https://www.facebook.com/${username}
            ?viewas=100000686899395`);
    });

    app.get('/checkup', function(req, res) {
        res.render('checkup', {
            current: {
                step: {
                    title: 'Online Check Up',
                    description: stripNewlines`We'll walk you through some
                        of the things to watch out for when giving out your
                        personal information.<br /><br />Not many people know
                        of the extent of the information companies or online
                        services collect. We'll show you some examples and point
                        you in the right direction if you choose to opt out.`
                },
                idx: 0
            }
        });
    });

    app.get('/checkup/:step', function(req, res) {
        if (!req.params || !req.params.step || req.params.step < 0) {
            return res.redirect('/');
        } else if (req.params.step == 0) {
            res.redirect('/checkup');
        } else {
            CheckupItem.findOne({
                step: req.params.step
            }, function(err, result) {
                if (err || !result) {
                    return res.redirect('/done');
                } else {
                    return res.render('checkup', {
                        current: {
                            step: result,
                            idx: parseInt(req.params.step)
                        }
                    });
                }
            });
        }
    });

    app.get('/browse/all', function(req, res) {
        return res.redirect('/browse/all/1');
    });

    app.get('/browse/all/:page', function(req, res) {
        req.sanitizeParams();
        req.checkParams('page', 'Invalid page').isInt();
        if (req.validationErrors()) return res.redirect('/browse/all/1');
        let page = parseInt(req.params.page);
        let results = SuggestionItem.find().sort({
            'timestamp': -1
        }).limit(3).skip((page - 1) * 3);
        results.exec(function(err, result) {
            if (err) {
                return res.redirect('/');
            } else if (result.length == 0) {
                return res.redirect('/');
            } else {
                return res.render('browse', {
                    submissions: result,
                    page: page,
                    suggestion: true
                });
            }
        });
    });

    app.get('/browse/suggestion/:id', function(req, res) {
        return SuggestionItem.findOne({
            _id: req.params.id
        }, function(err, result) {
            if (err || !result) {
                return res.redirect('/browse/all/1');
            } else {
                return res.render('checkup', {
                    current: {
                        step: result,
                        suggestion: true
                    }
                });
            }
        });
    });

    app.get('/browse/item/:id', function(req, res) {
        return CheckupItem.findOne({
            _id: req.params.id
        }, function(err, result) {
            if (err || !result) {
                return res.redirect('/browse/all/1');
            } else {
                return res.render('checkup', {
                    current: {
                        step: result
                    }
                });
            }
        });
    });

    app.get('/random', function(req, res) {
        return SuggestionItem.random(function(err, result) {
            if (err || !result) {
                return res.redirect('/browse/all/1');
            } else {
                return res.render('checkup', {
                    current: {
                        step: result,
                        suggestion: true
                    }
                });
            }
        });
    });

    app.get('/submit', function(req, res) {
        res.render('submit');
    });

    app.post('/submit', function(req, res) {
        req.sanitizeBody();
        req.checkBody('title', 'Title cannot be empty or exceed 100 characters')
            .len(1, 100);
        req.checkBody('description',
            'Description cannot be empty or exceed 1500 characters')
        .len(1, 1500);
        if (req.param('live_url').length > 0) {
            req.checkBody('live_url', 'Live URL must be a valid URL')
                .matches(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/);
        }
        if (req.param('disable_url').length > 0) {
            req.checkBody('disable_url', 'Disable URL must be a valid URL')
                .matches(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/);
        }
        req.checkBody('tags', 'Tags cannot exceed 100 characters').len(0, 100);
        let err = req.validationErrors();
        if (err) {
            return res.render('submit', {
                path: res.locals.path,
                content: req.body,
                errors: err
            });
        }

        let tags = req.param('tags').split(',');
        for (let i = 0; i < tags.length; i++) {
            tags[i] = tags[i].trim().toLowerCase();
        }

        let submission = new SuggestionItem({
            title: req.param('title'),
            author: req.param('name'),
            description: req.param('description'),
            view: req.param('live_url'),
            disable: req.param('disable_url'),
            tags: tags
        });

        submission.save(function(err) {
            if (err) {
                return res.render('submit', {
                    content: req.body,
                    errors: err
                });
            } else {
                return res.render('submit', {
                    complete: true
                });
            }
        });
    });

    app.get('/tags/suggestions/:tag', function(req, res) {
        return res.redirect('/tags/suggestions/' + req.params.tag + '/1');
    });

    app.get('/tags/suggestions/:tag/:page', function(req, res) {
        req.sanitizeParams();
        req.checkParams('tag', 'Tag cannot be empty or exceed 100 characters')
            .len(1, 100);
        req.checkParams('page', 'Invalid page').isInt();
        let page = parseInt(req.params.page);
        if (req.validationErrors()) return res.redirect('/');
        let results = SuggestionItem.find({
            'tags': {
                '$in': [req.params.tag]
            }
        }).sort({ 'step': 1 }).limit(3).skip((page - 1) * 3);
        results.exec(function(err, result) {
            if (err) {
                return res.redirect('/');
            } else if (result.length == 0) {
                return res.redirect('/');
            } else {
                return res.render('browse', {
                    submissions: result,
                    tag: req.params.tag,
                    page: page,
                    suggestion: true
                });
            }
        });
    });

    app.get('/tags/:tag', function(req, res) {
        return res.redirect('/tags/' + req.params.tag + '/1');
    });

    app.get('/tags/:tag/:page', function(req, res) {
        req.sanitizeParams();
        req.checkParams('tag', 'Tag cannot be empty or exceed 100 characters')
            .len(1, 100);
        req.checkParams('page', 'Invalid page').isInt();
        let page = parseInt(req.params.page);
        if (req.validationErrors()) return res.redirect('/');
        let results = CheckupItem.find({
            'tags': {
                '$in': [req.params.tag]
            }
        }).sort({ 'step': 1 }).limit(3).skip((page - 1) * 3);
        results.exec(function(err, result) {
            if (err) {
                return res.redirect('/');
            } else if (result.length == 0) {
                return res.redirect('/');
            } else {
                return res.render('browse', {
                    submissions: result,
                    tag: req.params.tag,
                    page: page
                });
            }
        });
    });

    app.get('/done', function(req, res) {
        res.render('done');
    });
};
