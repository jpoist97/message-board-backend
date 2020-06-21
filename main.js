var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var {Session, router} = require('./Routes/Session.js');
var Validator = require('./Routes/Validator.js');
var CnnPool = require('./Routes/CnnPool.js');
var async = require('async');

var app = express();

var port = process.argv[process.argv.indexOf('-p') + 1];
if (!port) {
   console.log('Please specify a port number to run this server on');
   process.exit();
}


app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "http://localhost:3000");
   res.header("Access-Control-Allow-Credentials", true);
   res.header("Access-Control-Allow-Headers", "Content-Type");
   res.header("Access-Control-Expose-Headers", "Location");
   next();
});


app.options("/*", function(req, res) {
   res.header("Access-Control-Allow-Methods", 'GET, POST, PUT, DELETE');
   res.status(200).end();
});

app.use(bodyParser.json());

app.use(function(err, req, res, next) {
   if (err instanceof SyntaxError && err.status === 400 && "body" in err)
      res.status(500).end();
   else 
      next();
});

app.use(function(req, res, next) {delete req.body.id; next();});

app.use(cookieParser());

app.use(router);

app.use(function(req, res, next) {
   if (req.session || (req.method === 'POST' &&
    (req.path === '/Prss' || req.path === '/Ssns'))) {
      req.validator = new Validator(req, res);
      next();
   } 
   else
      res.status(401).end();
});

app.use(CnnPool.router);

app.use('/Prss', require('./Routes/Account/Prss.js'));
app.use('/Ssns', require('./Routes/Account/Ssns.js'));
app.use('/Cnvs', require('./Routes/Conversation/Cnvs.js'));
app.use('/Msgs', require('./Routes/Conversation/Msgs.js'));
app.use('/Likes', require('./Routes/Conversation/Likes.js'));

app.delete('/DB', function(req, res) {
   var vld = req.validator;
   if (vld.checkAdmin()) {
      var cbs = ["Conversation", "Message", "Person", "Likes"].map(
         table => function(cb) {
            req.cnn.query("delete from " + table, cb);
         }
      );

      cbs = cbs.concat(["Conversation", "Message", "Person", "Likes"].map(
         table => cb => {
            req.cnn.query("alter table " + table + " auto_increment = 1", cb);
         }
      ));

      cbs.push(cb => {
         req.cnn.query('INSERT INTO Person (firstName, lastName, email,' +
          ' password, whenRegistered, role) VALUES ' +
          '("Joe", "Admin", "adm@11.com","password"' +
          ', UNIX_TIMESTAMP() * 1000, 1);', cb);
      });

      cbs.push(callback => {
         Session.reset();
         callback();
      });

      async.series(cbs, err => {
         req.cnn.release();      
         if (err)
            res.status(400).json(err);
         else
            res.status(200).end();
      });
   }
   else {
      req.cnn.release();
   }

});


app.use(function(req, res) {
   res.status(404).end();
   req.cnn && req.cnn.release();
});

app.use(function(req, res) {
   res.status(500);
   req.cnn && req.cnn.release();
});

app.listen(port, function() {
   console.log('App Listening on port ' + port);
});
