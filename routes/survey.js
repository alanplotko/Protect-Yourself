const Track = require('../models/track').Track;

module.exports = function(app) {
    app.get('/track/:name', function(req, res) {
        req.check('name', 'The requested track does not exist').notEmpty();
        let error = req.validationErrors();
        if (error) {
            return res.redirect('/');
        }

        let trackName = req.sanitize('name').trim();
        Track.findOne({ 'name': trackName }, function(err, track) {
            if (err) {
                return res.redirect('/tracks');
            }

            req.session.track = track;

            return res.render('question', {
                path: res.locals.path,
                track: req.session.track
            });
        });
    });
};
