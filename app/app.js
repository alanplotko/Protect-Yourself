// App configuration
var express = require('express');
var favicon = require('serve-favicon');
var marked = require('marked');
var util = require('util');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');

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
    }
});
var suggestionSchema = new Schema({
    title: String,
    description: String,
    view: String,
    disable: String
});
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
app.locals.navigation = [{
    title: 'Home',
    url: '/'
}, {
    title: 'Submit',
    url: '/submit'
}, {
    title: 'Browse',
    url: '/browse'
}];

// Routes
app.get('/', function(req, res) {
    res.render('index', {
        path: res.locals.path
    });
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

app.get('/submit', function(req, res) {
    res.render('submit', {
        path: res.locals.path
    });
});

app.get('/browse', function(req, res) {
    return res.redirect('/browse/1');
});

app.get('/browse/:page', function(req, res) {
    req.sanitizeParams();
    req.checkParams('page', 'Invalid page').isInt();
    if (req.validationErrors()) return res.redirect('/browse/1')
    var page = parseInt(req.params.page);
    var results = SuggestionItem.find(10).skip((page - 1) * 10);
    results.exec(function(err, result) {
        if (err) {
            return res.redirect('/');
        } else if (result.length == 0) {
            return res.redirect('/browse/1');
        } else {
            return res.render('browse', {
                path: res.locals.path,
                submissions: result
            });
        }
    });
});

app.post('/submit', function(req, res) {
    req.sanitizeBody();
    req.checkBody('title', 'Title cannot be empty or exceed 100 characters').len(1, 100);
    req.checkBody('description', 'Description cannot be empty or exceed 1500 characters').len(1, 1500);
    req.checkBody('live_url', 'Live URL must be a valid URL').matches(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/);
    req.checkBody('disable_url', 'Disable URL must be a valid URL').matches(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/);
    var err = req.validationErrors();
    if (err) {
        return res.render('submit', {
            path: res.locals.path,
            content: req.body,
            errors: err
        });
    }

    var submission = new SuggestionItem({
        title: req.param('title'),
        description: req.param('description'),
        view: req.param('live_url'),
        disable: req.param('disable_url')
    });

    submission.save(function(err) {
        if (err) res.send(err);
        res.json({ message: 'Submission created!' });
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
