const uuid = require('uuid');

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
            // Sessions expire in 2 weeks (in ms)
            cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 },
            genid: function(req) {
                return uuid.v4(); // use UUIDs for session ids
            },
            store: new MongoStore({
                mongooseConnection: mongoose.connection
            }),
            resave: false,
            saveUninitialized: false
        }));
    }
};
