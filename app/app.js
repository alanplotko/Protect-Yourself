// App configuration
var express = require('express');
var favicon = require('serve-favicon');
var marked = require('marked');
var util = require('util');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var moment = require('moment');
moment().format();
var app = express();

const path = require('path');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.connect('mongodb://localhost:27017/hackae');
mongoose.Promise = require('bluebird');
var checkUpSchema = new Schema({
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
var suggestionSchema = new Schema({
    title: String,
    description: String,
    view: String,
    disable: String,
    timestamp: { type: Date, default: Date.now },
    upvotes: { type: Number, default: 0 },
    tags: [String]
});
suggestionSchema.statics.random = function(callback) {
    this.count(function(err, count) {
        if (err) {
            return callback(err);
        }
        var rand = Math.floor(Math.random() * count);
        this.findOne().skip(rand).exec(callback);
    }.bind(this));
};
var CheckUpItem = mongoose.model('CheckUpItem', checkUpSchema, 'security');
var SuggestionItem = mongoose.model('SuggestionItem', suggestionSchema, 'suggestions');

// Port configuration
const port = 3000;
app.set('view engine', 'pug');

// Path configuration
const dir = path.resolve(__dirname, '..');
app.use(favicon(dir + '/public/favicon.ico'));
app.use('/public', express.static(dir + '/public/'));
app.use('/semantic', express.static(dir + '/node_modules/semantic-ui/dist/'));
app.use('/jquery', express.static(dir + '/node_modules/jquery/dist/'));
app.use('/moment', express.static(dir + '/node_modules/moment/min/'));
app.use('/assets', express.static(dir + '/assets/'));
app.use(function(req, res, next) {
    var pathStr = req.path;
    if (req.path.length != 1 && req.path.substr(-1) == "/") pathStr = req.path.substring(0, req.path.length - 1);
    res.locals = {
        path: pathStr
    }
    next();
});
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(expressValidator());

// App locals configuration
app.locals.title = "Protect Yourself";
app.locals.moment = moment;
app.locals.navigation = [{
    title: 'Home',
    url: '/'
}, {
    title: 'Checkup',
    url: '/checkup'
}, {
    title: 'Submit',
    url: '/submit'
}, {
    title: 'Browse',
    url: '/browse'
}, {
    title: 'Random',
    url: '/random'
}];

// Routes
app.get('/', function(req, res) {
    res.render('index', {
        path: res.locals.path
    });
});

app.get('/checkup/facebook', function(req, res) {
    res.render('check-site', {
        path: res.locals.path,
        header: "Are your Facebook posts public?",
        subtitle: "Let's take a look!",
        service: "Facebook",
        label: "Username",
        color: "blue"
    });
});

app.post('/checkup/facebook', function(req, res) {
    return res.redirect('https://www.facebook.com/' + req.body.data + '?viewas=100000686899395')
});

app.get('/checkup', function(req, res) {
    res.render('checkup', {
        path: res.locals.path,
        current: {
            step: {
                title: "Online Check Up",
                description: "We'll walk you through some of the things to watch out for when giving out your personal information.<br /><br />Not many people know of the extent of the information companies or online services collect. We'll show you some examples and point you in the right direction if you choose to opt out."
            },
            idx: 0
        }
    });
});

app.get('/checkup/:step', function(req, res) {
    if (!req.params || !req.params.step || req.params.step < 0) return res.redirect('/');

    if (req.params.step == 0) {
        res.redirect('/checkup');
    } else {
        CheckUpItem.findOne({step: req.params.step}, function(err, result) {
            if (err || !result) {
                return res.redirect('/done');
            } else {
                return res.render('checkup', {
                    path: res.locals.path,
                    current: {
                        step: result,
                        idx: parseInt(req.params.step)
                    }
                });
            }
        });
    }
});

app.get('/browse', function(req, res) {
    return res.redirect('/browse/1');
});

app.get('/browse/:page', function(req, res) {
    req.sanitizeParams();
    req.checkParams('page', 'Invalid page').isInt();
    if (req.validationErrors()) return res.redirect('/browse/1');
    var page = parseInt(req.params.page);
    var results = SuggestionItem.find().sort({'timestamp': -1}).limit(3).skip((page - 1) * 3);
    results.exec(function(err, result) {
        if (err) {
            return res.redirect('/');
        } else if (result.length == 0) {
            return res.redirect('/');
        } else {
            return res.render('browse', {
                path: res.locals.path,
                submissions: result,
                page: page
            });
        }
    });
});

app.get('/random', function(req, res) {
    return SuggestionItem.random(function(err, result) {
        if (err || !result) {
            return res.redirect('/browse/1');
        } else {
            return res.render('checkup', {
                path: res.locals.path,
                current: {
                    step: result,
                    suggestion: true
                }
            });
        }
    });
});

app.get('/browse/item/:id', function(req, res) {
    return SuggestionItem.findOne({ _id: req.params.id }, function(err, result) {
        if (err || !result) {
            return res.redirect('/browse/1');
        } else {
            return res.render('checkup', {
                path: res.locals.path,
                current: {
                    step: result,
                    suggestion: true
                }
            });
        }
    });
});

app.get('/submit', function(req, res) {
    res.render('submit', {
        path: res.locals.path
    });
});

app.post('/submit', function(req, res) {
    req.sanitizeBody();
    req.checkBody('title', 'Title cannot be empty or exceed 100 characters').len(1, 100);
    req.checkBody('description', 'Description cannot be empty or exceed 1500 characters').len(1, 1500);
    if (req.param('live_url').length > 0) {
        req.checkBody('live_url', 'Live URL must be a valid URL').matches(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/);
    }
    if (req.param('disable_url').length > 0) {
        req.checkBody('disable_url', 'Disable URL must be a valid URL').matches(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/);
    }
    req.checkBody('tags', 'Tags cannot exceed 100 characters').len(0, 100);
    var err = req.validationErrors();
    if (err) {
        return res.render('submit', {
            path: res.locals.path,
            content: req.body,
            errors: err
        });
    }

    var tags = req.param('tags').split(',');
    for (var i = 0; i < tags.length; i++) tags[i] = tags[i].trim();

    var submission = new SuggestionItem({
        title: req.param('title'),
        description: req.param('description'),
        view: req.param('live_url'),
        disable: req.param('disable_url'),
        tags: tags
    });

    submission.save(function(err) {
        if (err) {
            return res.render('submit', {
                path: res.locals.path,
                content: req.body,
                errors: err
            });
        } else {
            return res.render('submit', {
                path: res.locals.path,
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
    req.checkParams('tag', 'Tag cannot be empty or exceed 100 characters').len(1, 100);
    req.checkParams('page', 'Invalid page').isInt();
    var page = parseInt(req.params.page);
    if (req.validationErrors()) return res.redirect('/');
    var results = SuggestionItem.find({ 'tags': { "$in" : [req.params.tag, req.params.tag.toLowerCase()]} }).sort({'step': 1}).limit(3).skip((page - 1) * 3);
    results.exec(function(err, result) {
        if (err) {
            return res.redirect('/');
        } else if (result.length == 0) {
            return res.redirect('/');
        } else {
            return res.render('browse', {
                path: res.locals.path,
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
    req.checkParams('tag', 'Tag cannot be empty or exceed 100 characters').len(1, 100);
    req.checkParams('page', 'Invalid page').isInt();
    var page = parseInt(req.params.page);
    if (req.validationErrors()) return res.redirect('/');
    var results = CheckUpItem.find({ 'tags': { "$in" : [req.params.tag, req.params.tag.toLowerCase()]} }).sort({'step': 1}).limit(3).skip((page - 1) * 3);
    results.exec(function(err, result) {
        if (err) {
            return res.redirect('/');
        } else if (result.length == 0) {
            return res.redirect('/');
        } else {
            return res.render('browse', {
                path: res.locals.path,
                submissions: result,
                tag: req.params.tag,
                page: page
            });
        }
    });
});

app.get('/done', function(req, res) {
    res.render('done', {
        path: res.locals.path
    });
});

app.listen(port, function () {
    console.log('Running on localhost:' + port);
});
