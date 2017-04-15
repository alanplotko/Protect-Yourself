module.exports = {
    initialize: function(app) {
        const connection = require('./settings').mongodb;
        const mongoose = require('mongoose');

        mongoose.connect(connection.URL);
        mongoose.Promise = require('bluebird');
        const session = require('express-session');
        const MongoStore = require('connect-mongo')(session);

        app.use(session({
            secret: connection.MONGO_SECRET,
            cookie: { maxAge: 60 * 1000 * 60 * 48 },
            store: new MongoStore({ mongooseConnection: mongoose.connection }),
            resave: false,
            saveUninitialized: false
        }));
    }
};
