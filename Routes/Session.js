var crypto = require('crypto');

var ssnsByCookie = {};
var ssnsById = [];
var duration = 7200000;
var cookieName = 'CHSAuth';


var Session = function(user, res) {
   var authToken = crypto.randomBytes(16).toString('hex');

   res.cookie(cookieName, authToken, {maxAge: duration, httpOnly: true });
   ssnsByCookie[authToken] = this;
   ssnsById.push(this);

   this.id = ssnsById.length - 1;
   this.authToken = authToken;
   this.firstName = user.firstName;
   this.lastName = user.lastName;
   this.prsId = user.id;
   this.email = user.email;
   this.role = user.role;
   this.loginTime = this.lastUsed = new Date().getTime();
};

Session.prototype.isAdmin = function() {
   return this.role === 1;
};


Session.prototype.logOut = function() {
   delete ssnsById[this.id];
   delete ssnsByCookie[this.authToken];
};


Session.getAllIds = () => Object.keys(ssnsById);
Session.findById = id => ssnsById[id];
Session.findByPrsId = prsId => ssnsById.filter(ssn => ssn.prsId === prsId);

Session.reset = () => {
   ssnsByCookie = {};
   ssnsById = [];
}


var router = function(req, res, next) {
   var cookie = req.cookies[cookieName];
   var session = cookie && ssnsByCookie[cookie];
   
   if (session) {
      if (session.lastUsed < new Date().getTime() - duration) 
         session.logOut();
      else {
         req.session = session;
      }
   }
   next();
};

module.exports = {Session, router};