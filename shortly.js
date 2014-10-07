var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
// Add cookieParser
app.use(cookieParser());

app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res) {
  app.checkCookies(req.cookies, function(model){
    if (model) {
      res.render('index');
    } else {
      res.redirect('/login');
    }
  });
});

app.get('/create', function(req, res) {
  app.checkCookies(req.cookies, function(model){
    if (model) {
      res.render('index');
    } else {
      res.redirect('/login');
    }
  });
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  app.checkUser(req.body.username, function(model){
    if (model) {
      res.send("This username is already taken, please choose another one");
    } else {
      User.handlePassword(req.body, function(salt, hashedPW){
        new User.UserRecord({
          username: req.body.username,
          salt: salt,
          hashword: hashedPW
        }).save();
        res.redirect('/login');
      });
    }
  });
});

app.get('/login', function(req, res){
  res.render('login');
});

app.post('/login', function(req, res){
  app.checkUser(req.body.username, function(model){
    if (!model) {
      //res.send("<script> alert('Oops! Something went wrong. Username and password do not match')</script>");
      res.redirect('/signup');
    } else {
      app.checkPassword(req.body, function(auth){
        if (!auth) {
          res.send("Oops! Something went wrong. Username and password do not match");
        } else {
          //req.cookies.userAuth = req.body.username + "isAuth";
          res.cookie('username', req.body.username, {maxAge: "session", httpOnly: true});
          res.redirect('/');
        }
      });
    }
  });
});

app.get('/links', function(req, res) {
  app.checkCookies(req.cookies, function(model){
    if (model) {
      Links.reset().fetch().then(function(links) {
        res.send(200, links.models);
      });
    } else {
      res.redirect('/login');
    }
  });

});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

// function that checks for auth
//
app.checkCookies = function(cookie, callback){
  app.checkUser(cookie.username, function(model){
    callback(model);
  });
};

app.checkUser = function(username, callback){
  new User.UserRecord({ username: username })
    .fetch()
    .then(function(model){
      callback(model);
    });
};

app.checkPassword = function(body, callback){
  new User.UserRecord({ username: body.username})
    .fetch()
    .then(function(model){
      User.checkPassword(body, model, function(hashedPW){
        if (hashedPW === model.get('hashword')) {
          callback(true);
        } else {
          callback(false);
        }
      });
    });
};


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
