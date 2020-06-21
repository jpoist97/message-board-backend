var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');

router.baseURL = '/Msgs';

router.get('/:msgId', function(req, res) {
   var msgId = req.params.msgId;
   var ssn = req.session;
   var vld = req.validator;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
      if (vld.check(ssn, Tags.noPermission, null, cb))
         req.cnn.chkQry('select * from Message where id = ?', msgId, cb);
   },
   function(msgs, fields, cb) {
      if (vld.check(msgs.length, Tags.notFound, null, cb)) {
         res.json(msgs[0]);
         cb();
      }
   }],
   function(err) {
      cnn.release();
   });

});

router.get('/:msgId/Likes', function(req, res) {
   var num = parseInt(req.query.num);
   var msgId = req.params.msgId;
   var cnn = req.cnn;
   var vld = req.validator;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Message where id = ?', [msgId], cb);
   },
   function(msgs, fields, cb) {
      if (vld.check(msgs.length, Tags.notFound, null, cb)) {
         if (num || num === 0)
            cnn.chkQry('select id, firstName, lastName from Likes ' + 
             'where msgId = ? order by id desc ' + 
             'limit ?', [msgId, num], cb);
         else
            cnn.chkQry('select id, firstName, lastName from Likes ' +
             'where msgId = ?', [msgId], cb);
      }
   },
   function(likes, fields, cb) {
      likes.sort((like1, like2) => {
         return like1.lastName === like2.lastName ? 
          like1.firstName.localeCompare(like2.firstName) : 
          like1.lastName.localeCompare(like2.lastName);
      })
      res.json(likes);
      cb();
   }],
   function(err) {
      cnn.release();
   });
});

router.post('/:msgId/Likes', function(req, res) {
   var ssn = req.session;
   var vld = req.validator;
   var prsId = ssn.prsId;
   var msgId = req.params.msgId;
   var cnn = req.cnn;
   var cnvId;

   async.waterfall([
   function(cb) {
      if (vld.check(ssn, Tags.noPermission, null, cb))
         cnn.chkQry('select * from Likes where msgId = ? and ownerId = ?',
          [msgId, prsId], cb);
   },
   function(likes, fields, cb) {
      if (!likes.length) {
         async.waterfall([
         function(callback) {
            cnn.chkQry('select * from Message where id = ?', [msgId],
             callback);
         },
         function(msgs, fields, callback) {
            if (vld.check(msgs.length, Tags.notFound, null, callback)) {
               cnvId = msgs[0].cnvId;
               cnn.chkQry('update Message set numLikes = ? where id = ?', 
                [msgs[0].numLikes + 1, msgId], callback);
            }
         },
         function(result, fields, callback) {
            cnn.chkQry('insert into Likes set ?', {
               ownerId: prsId,
               firstName: ssn.firstName,
               lastName: ssn.lastName,
               msgId: msgId,
               cnvId: cnvId
            }, callback);
         },
         function(result, fields, callback) {
            res.location(router.baseURL + '/' + msgId + '/Likes/' +
             result.insertId);
            callback();
         }], 
         function(error) {
            cb(error);
         })
      }
      else {
         res.location(router.baseURL + '/' + msgId + '/Likes/' + likes[0].id);
         cb();
      }
   }],
   function(err) {
      if (!err)
         res.end();
      req.cnn.release();
   });
});

module.exports = router;