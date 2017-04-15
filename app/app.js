// Set up dependencies
const express = require('express');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const moment = require('moment');
moment().format();

// App configuration
const path = require('path');
const dir = path.resolve(__dirname, '..');
let app = express();
app.set('view engine', 'pug');
app.use(favicon(dir + '/public/favicon.ico'));
app.use('/public', express.static(dir + '/public/'));
app.use('/semantic', express.static(dir + '/node_modules/semantic-ui-css/'));
app.use('/jquery', express.static(dir + '/node_modules/jquery/dist/'));
app.use('/moment', express.static(dir + '/node_modules/moment/min/'));
app.use('/assets', express.static(dir + '/assets/'));
app.use(function(req, res, next) {
    let pathStr = req.path;
    if (req.path.length != 1 && req.path.substr(-1) == '/') {
        pathStr = req.path.substring(0, req.path.length - 1);
    }
    res.locals = { path: pathStr };
    next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());

// Database setup
let db = require(dir + '/config/db');
db.initialize(app);

// App locals
app.locals.title = 'Protect Yourself';
app.locals.moment = moment;
app.locals.navigation = [{
    title: 'Home',
    url: '/'
}];
/* }, {
    title: 'Checkup',
    url: '/checkup'
}, {
    title: 'Submit',
    url: '/submit'
}, {
    title: 'Browse',
    url: '/browse/all'
}, {
    title: 'Random',
    url: '/random'
}];*/

// Routes
require(dir + '/routes/general')(app);
require(dir + '/routes/survey')(app);

const port = 3000;
app.listen(port, function() {
    console.log(`Running on localhost:${port}`);
});
