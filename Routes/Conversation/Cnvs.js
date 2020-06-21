var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');

router.baseURL = '/Cnvs';

const CONTENTLEN = 5000;
const TITLELEN = 80;
const MSOFFSET = 1000;

router.get('/', function(req, res) {
   var ownerId = req.query.owner;
   var callback = function(err, cnvs) {
      if (!err)
         res.json(cnvs);
      req.cnn.release();
   };

   if (ownerId)
      req.cnn.chkQry('select * from Conversation where ownerId = ?', 
       ownerId, callback);
   else
      req.cnn.chkQry('select * from Conversation', null, callback);
});

router.post('/', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   var prsId = req.session.prsId;
   var ssn = req.session;

   async.waterfall([
   function(cb) {
      if (vld.check(ssn, Tags.noPermission, null, cb) &&
       vld.check(body.title, Tags.missingField, ['title'], cb) &&
       vld.check(body.title.length <= TITLELEN, Tags.badValue, ['title'], cb))
         cnn.chkQry('select * from Conversation where title = ?', 
          body.title, cb);
   },
   function(existingCnv, fields, cb) {
      if (vld.check(!existingCnv.length, Tags.dupTitle, null, cb)) {
         body.ownerId = prsId;
         cnn.chkQry("insert into Conversation set ?", [body], cb);
      }
   },
   function(insRes, fields, cb) {
      res.location(router.baseURL + '/' + insRes.insertId).end();
      cb();
   }],
   function(err) {
      cnn.release();
   });
});

router.put('/:cnvId', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   var cnvId = parseInt(req.params.cnvId);

   async.waterfall([
   function(cb) {
      if (vld.check(body.title, Tags.missingField, ['title'], cb) &&
       vld.check(body.title.length <= TITLELEN, Tags.badValue, ['title'], cb))
         cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(cnvs[0].ownerId, cb))
         cnn.chkQry('select * from Conversation where id <> ? && title = ?',
          [cnvId, body.title], cb);
   },
   function(sameTtl, fields, cb) {
      if (vld.check(!sameTtl.length, Tags.dupTitle, ["title"], cb)) {
         cnn.chkQry("update Conversation set title = ? where id = ?",
          [body.title, cnvId], cb);
         res.end();
      }
   }],
   function(err) {
      req.cnn.release();
   });
});

router.get('/:cnvId', function(req, res) {
   var ssn = req.session;
   var vld = req.validator;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
      if (vld.check(ssn, Tags.noPermission, null, cb))
         req.cnn.chkQry('select * from Conversation where id = ?', 
          [req.params.cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb)) {
         res.json(cnvs[0]);
         cb();
      }
   }],
   function(err) {
      cnn.release();
   });

});

router.delete('/:cnvId', function(req, res) {
   var vld = req.validator;
   var cnvId = parseInt(req.params.cnvId);
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(cnvs[0].ownerId, cb))
         cnn.chkQry('delete from Conversation where id = ?', [cnvId], cb);
   },
   function(result, fields, cb) {
      cnn.chkQry('delete from Likes where cnvId = ?', [cnvId], cb);
   },
   function(result, fields, cb) {
      cnn.chkQry('delete from Message where cnvId = ?', [cnvId], cb);
   }],
   function(err) {
      if (!err)
         res.end();
      cnn.release();
   });
});

router.get('/:cnvId/Msgs', function(req, res) {
   var ssn = req.session;
   var vld = req.validator;
   var cnn = req.cnn;
   var dateTime = req.query.dateTime ? req.query.dateTime : 0;
   var num = parseInt(req.query.num);


   async.waterfall([
   function(cb) {
      req.cnn.chkQry('select * from Message where cnvId = ?', 
       [req.params.cnvId], cb);
   },
   function(msgs, fields, cb) {
      // if (vld.check(msgs.length, Tags.notFound, null, cb)) {
         if(num || num === 0)
            msgs = msgs.slice(0, num);
         msgs.sort((msg1, msg2) => (msg1.whenMade - msg2.whenMade));
         msgs = msgs.filter(msg => msg.whenMade >= dateTime);
         res.json(msgs);
         cb();
      // }
   }],
   function(err) {
      cnn.release();
   });

});

router.post('/:cnvId/Msgs', function(req, res) {
   var ssn = req.session;
   var vld = req.validator;
   var body = req.body;
   var cnvId = parseInt(req.params.cnvId);

   async.waterfall([
   function(cb) {
      if (vld.check(ssn, Tags.noPermission, null, cb) &&
       vld.check('content' in body && body.content, Tags.missingField, 
       ['content'], cb) &&
       vld.check(body.content.length <= CONTENTLEN, Tags.badValue, 
       ['content'], cb))
         req.cnn.chkQry('select * from Conversation where id = ?', 
          [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb)) {
         body.email = ssn.email;
         body.cnvId = cnvId;
         body.numLikes = 0;
         req.cnn.chkQry('insert into Message set ?, ' +
          'whenMade = UNIX_TIMESTAMP() * ?', [body, MSOFFSET], cb);
      }
   },
   function(result, fields, cb) {
      res.location(router.baseURL + '/' + result.insertId);
      req.cnn.chkQry('update Conversation set ' +
       'lastMessage = UNIX_TIMESTAMP() * ? where id = ?', [MSOFFSET, cnvId],
        cb);
   },
   function(result, fields, cb) { 
      res.end();
      cb();
   }],
   function() {
      req.cnn.release();
   });

});

module.exports = router;
