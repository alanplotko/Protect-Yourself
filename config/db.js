const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/hackae');
mongoose.Promise = require('bluebird');

module.exports.mongoose = mongoose;
