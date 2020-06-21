var Validator = function(req, res) {
   this.errors = [];
   this.session = req.session;
   this.res = res;
};

Validator.Tags = {
   noLogin: "noLogin",
   noPermission: "noPermission",
   missingField: "missingField",
   badValue: "badValue",
   notFound: "notFound",
   badLogin: "badLogin",
   dupEmail: "dupEmail",
   noTerms: "noTerms",
   forbiddenRole: "forbiddenRole",
   noOldPwd: "noOldPwd",
   dupTitle: "dupTitle",
   queryFailed: "queryFailed",
   forbiddenField: "forbiddenField",
   oldPwdMismatch: "oldPwdMismatch"
};

Validator.prototype.check = function(test, tag, params, cb) {
   if (!test)
      this.errors.push({tag: tag, params: params});

   if (this.errors.length) {
      if (this.res) {
         if (this.errors[0].tag === Validator.Tags.noPermission)
            this.res.status(403).end();
         else
            this.res.status(400).json(this.errors);
         this.res = null;
      }
      if (cb) {
         cb(this);
      }

   }
   return !this.errors.length;
};

Validator.prototype.chain = function(test, tag, params) {
   if (!test) {
      this.errors.push({tag: tag, params: params});
   }
   return this;
};

Validator.prototype.checkAdmin = function(cb) {
   return this.check(this.session && this.session.isAdmin(),
    Validator.Tags.noPermission, null, cb);
};

Validator.prototype.checkPrsOK = function(prsId, cb) {
   return this.check(this.session &&
    (this.session.isAdmin() || this.session.prsId === prsId),
    Validator.Tags.noPermission, null, cb);
};

Validator.prototype.checkSsnOK = function(ssnId, cb) {
   return this.check(this.session &&
    (this.session.isAdmin() || this.session.id === ssnId),
    Validator.Tags.noPermission, null, cb);
};

Validator.prototype.hasFields = function(obj, fieldList, cb) {
   var self = this;

   fieldList.forEach(function(name) {
      self.chain(obj.hasOwnProperty(name), Validator.Tags.missingField, 
       [name]);
   });

   return this.check(true, null, null, cb);
};


Validator.prototype.hasFieldsOnly = function(obj, fieldList, cb) {
   var props = Object.getOwnPropertyNames(obj);
   var self = this;

   props.forEach(function(name) {
      self.chain(fieldList.includes(name), Validator.Tags.forbiddenField, 
       [name]);
   });

   return this.check(true, null, null, cb);
}

module.exports = Validator;
