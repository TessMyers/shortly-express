var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

exports.UserRecord = db.Model.extend({
  tableName: 'users'
});

exports.handlePassword = function(userInfo, callback) {
  bcrypt.genSalt(10, function(err, salt) {
    if (err) throw err;
    bcrypt.hash(userInfo.password, salt, null, function(err, hashedPW){
      if (err) throw err;
      callback(salt, hashedPW);
    });
  });
};

exports.checkPassword = function(body, model, callback){
  bcrypt.hash(body.password, model.get('salt'), null, function(err, hashedPW){
    if (err) throw err;
    callback(hashedPW);
  });
};
