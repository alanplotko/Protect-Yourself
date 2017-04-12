const connection = require('./settings').mongodb;
const mongoose = require('mongoose');
mongoose.connect(connection.URL);
mongoose.Promise = require('bluebird');

module.exports.mongoose = mongoose;
