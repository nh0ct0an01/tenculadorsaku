var express = require('express');
var router = express.Router();
var User = require('./Model/User');
var bcrypt = require('bcrypt');
var async = require('async');
var randToken = require('rand-token');

// TODO refactor: move function to User model

router.post('/create-user', function(req, res, next) {
  // TODO check password length,...
  // TODO check phone
  var body = req.body;
  async.parallel([
    function(callback) {
      User.findOne({username: body.username}, "usename", function(err, user) {
        if (!err && user) callback(null, true);
        else callback(null, false);
      });
    },
    function(callback) {
      User.findOne({email: body.email}, "email", function(err, user) {
        if (!err && user) callback(null, true);
        else callback(null, false);
      });
    },
  ], function(err, result) {
    if (!result[0] && !result[1]) {
      // Create user
      User.findOne({username: body.referer}, "referers", function(err, user) {
        var referer = [];
        if (err) next(err);
        else if (user==null) {}
        else {
          referer = [body.referer].concat(user.referers);
        }

        async.parallel([
          function(callback) {
            if (referer.length > 0) {
              User.update({username: referer[0]}, { $push: {team: body.username} }, function(err) {
                if (err) next(err);
                else callback();
              });
            } else {
              callback();
            }
          },
          function(callback) {
            if (err) return callback(err);
            User.create({
              username: body.username,
              password: bcrypt.hashSync(body.password, 10),
              email: body.email,
              fullName: body.fullName,
              phone: body.phone,
              countryId: body.countryId,
              referer: body.referer,
              referers: referer,
              token: randToken.generate(64),
              level: referer.length,
            }, function(err) {
              if (err) next(err);
              else callback();
            });
          }
        ], function() {
          res.redirect("/");
        });
      });
    } else {
      // existed
      res.redirect("/Login")
    }
  });
});

router.post('/login', function(req, res, next) {
  var body = req.body;
  User.findOne({username: body.username}, "password token", function(err, user) {
    if (err) next(err);
    else if (user==null) {
      res.redirect('/Login');
    }
    else if (bcrypt.compareSync(body.password, user.password)) {
      res.cookie('username', body.username, {maxAge: 172800000, httpOnly: true});
      res.cookie('token', user.token, {maxAge: 172800000, httpOnly: true});
      res.redirect('/u/Dashboard');
    }
    else {
      res.redirect('/Login');
    }
  });
});

// TODO check if update is success

router.post('/u/update-user', function(req, res, next) {
  var body = req.body;
  User.update({username: body.username}, {
    fullName: body.fullName,
    phone: body.phone,
    countryId: body.countryId,
  }, function(err) {
    if (err) next(err);
    else {
      res.redirect('/u/Settings');
    }
  })
});

router.post('/u/change-password', function(req, res, next) {
  var body = req.body;
  User.findOne({username: body.username}, 'password', function(err, user) {
    if (err) {
      next(err);
      return;
    }
    if (!user) {
      console.log("?? :D ??");
      return;
    }
    if (bcrypt.compareSync(body.oldpass, user.password)) {
      var hash = bcrypt.hashSync(body.newpass, 10);
      User.update({username: body.username}, { password: hash }, function(err) {
        if (err) next(err);
        else {
          res.redirect('/u/Logout');
        }
      });
    }
  });
});

router.post('/buy', function(req, res, next) {
  var body = req.body;
  User.addACB(body.username, parseFloat(body.amount), parseFloat(body.rate), function(err) {
    if (err) next(err);
    else {
      User.find({}, 'username balanceACB', function(err, users) {
        if (err) next(err);
        else {
          var str = '';
          users.forEach(function(user) { str += user.username + ' ' + user.balanceACB + "\n"});
          res.send(str);
        }
      });
    }
  });
});

module.exports = router;
