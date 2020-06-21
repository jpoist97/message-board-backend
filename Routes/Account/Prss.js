var Express = require('express');
var Tags = require('../Validator.js').Tags;
var async = require('async');
var mysql = require('mysql');
var {Session, router} = require('../Session.js');

var router = Express.Router({caseSensitive: true});

const FIRSTNAMELEN = 30;
const EMAILLEN = 50;
const LASTNAMELEN = 50;
const PASSLEN = 50;

router.baseURL = '/Prss';

router.get('/', function(req, res) {
   var admin = req.session.isAdmin();
   var email = req.query.email;
   var usrEmail = req.session.email;
   var cnn = req.cnn;

   var handler = function(err, prsArr) {
      if (!admin) {
         prsArr = prsArr.filter(prs => prs.email === usrEmail);
      }

      res.json(prsArr);
      cnn.release();
   }

   if (email) {
      cnn.chkQry('select id, email from Person where email = ? or ' +
       'email like ?', [email, email + '%'], handler);
   } 
   else {
      cnn.chkQry('select id, email from Person', null, handler);
   }

});

router.post('/', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var admin = req.session && req.session.isAdmin();
   var cnn = req.cnn;

   if (admin && !body.password)
      body.password = "*";
   body.whenRegistered = Date.now();

   async.waterfall([
   function(cb) {
      if (vld.hasFields(body, ["email", "password", "lastName", "role"], cb) &&
       vld.chain(body.role === 0 || admin, Tags.forbiddenRole, null)
       .chain(body.password, Tags.missingField, ['password'])
       .check(body.role >= 0, Tags.badValue, ["role"], cb) &&
       vld.check(body.termsAccepted || admin, Tags.noTerms, null, cb) &&
       vld.chain(body.email.length <= EMAILLEN, Tags.badValue, ["email"])
       .chain(!('firstName' in body) || body.firstName.length <= FIRSTNAMELEN,
       Tags.badValue, ["firstName"])
       .chain(body.lastName.length <= LASTNAMELEN, Tags.badValue, ["lastName"])
       .check(!('password' in body) || body.password.length <= PASSLEN, 
       Tags.badValue, ["password"], cb)) {
         cnn.chkQry('select * from Person where email = ?', body.email, cb);
      }
   },
   function(existingPrss, fields, cb) {
      if (vld.check(!existingPrss.length, Tags.dupEmail, null, cb)) {
         body.termsAccepted = body.termsAccepted ? Date.now() : null;
         cnn.chkQry('insert into Person set ?', body, cb);
      }
   },
   function(result, fields, cb) {
      res.location(router.baseURL + '/' + result.insertId).end();
      cb();
   }],
   function(err) {
      cnn.release();
   });
});

router.put('/:id', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var admin = req.session.isAdmin();
   var cnn = req.cnn;
   var id = parseInt(req.params.id);

   async.waterfall([
   cb => {
      if (vld.checkPrsOK(id, cb) && 
       vld.hasFieldsOnly(req.body, ['firstName', 'lastName', 'password', 
       'oldPassword', 'role'], cb) &&
       vld.chain((!('role' in body) || admin) && 
       (!body.role || body.role === 1),
       Tags.badValue, ['role'])
       .chain(!('password' in body) || body.password, Tags.badValue, 
       ['password'])
       .chain(!body.firstName || body.firstName.length <= FIRSTNAMELEN, 
       Tags.badValue, ["firstName"])
       .chain(!body.lastName || body.lastName.length <= LASTNAMELEN, 
       Tags.badValue, ["lastName"])
       .chain(!body.password || body.password.length <= PASSLEN, Tags.badValue,
       ["password"])
       .check(!body.password || admin || body.oldPassword, Tags.noOldPwd, 
       null, cb)) {
         cnn.chkQry('select * from Person where id = ?', [req.params.id], cb);
      }
   },
   (prs, fields, cb) => {
      if (vld.check(prs.length, Tags.notFound, null, cb) && 
       vld.check(!body.password || (admin || 
       prs[0].password === body.oldPassword), Tags.oldPwdMismatch, null, cb)) {
         delete body.oldPassword;
         if (Object.keys(body).length)
            cnn.chkQry('update Person set ? where id = ?', 
             [body, req.params.id], cb);
         else {
            cb(false, undefined, undefined);
         }
      } 
   },
   (updRes, fields, cb) => {
      res.end();
      cb();
   }],
   err => {
      cnn.release();
   })
});

router.get('/:id', function(req, res) {
   var vld = req.validator;
   var id = parseInt(req.params.id);

   async.waterfall([
   function(cb) {
      if (vld.checkPrsOK(id, cb))
         req.cnn.chkQry('select * from Person where id = ?', [req.params.id],
          cb);
   },
   function(prsArr, fields, cb) {
      if (vld.check(prsArr.length, Tags.notFound, null, cb)) {
         prsArr.forEach(prs => {
            delete prs.password;
         });
         res.json(prsArr);
         cb();
      }
   }],
   function(err) {
      req.cnn.release();
   });
});

router.get('/:id', function(req, res) {
   var vld = req.validator;

   if (vld.checkPrsOK(req.params.id)) {
      req.cnn.query('select * from Person where id = ?', [req.params.id],
      function(err, prsArr) {
         if (vld.check(prsArr.length, Tags.notFound, null))
            res.json(prsArr);
         req.cnn.release();
      });
   }
   else {
      req.cnn.release();
   }
});

router.delete('/:id', function(req, res) {
   var vld = req.validator;
   var ssns = Session.findByPrsId(parseInt(req.params.id));
   var id = req.params.id;

   async.waterfall([
   function(cb) {
      if (vld.checkAdmin(cb)) {
         req.cnn.chkQry('DELETE from Person where id = ?', [id], cb);
      }
   },
   function(result, fields, cb) {
      if (vld.check(result.affectedRows, Tags.notFound, null, cb)) {
         ssns.forEach(ssn => ssn.logOut());
         req.cnn.chkQry('update Message set numLikes = numLikes - 1 ' + 
          'where id in (select msgId from Likes where ownerId = ?)', [id], cb);
      }
   },
   function(result, fields, cb) {
      req.cnn.chkQry('delete from Likes where ownerId = ?', [id], cb);
   }],
   function(err) {
      if (!err)
         res.status(200).end();
      req.cnn.release();
   });
});


module.exports = router;
