var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');

router.baseURL = '/Likes';

router.get('/:likeId', function(req, res) {
   var likeId = req.params.likeId;
   var ssn = req.session;
   var vld = req.validator;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
      if (vld.check(ssn, Tags.noPermission, null, cb))
         req.cnn.chkQry('select * from Likes where id = ?', likeId, cb);
   },
   function(likes, fields, cb) {
      if (vld.check(likes.length, Tags.notFound, null, cb)) {
         res.json({
            id: likeId,
            firstName: likes[0].firstName,
            lastName: likes[0].lastName
         });
         cb();
      }
   }],
   function(err) {
      cnn.release();
   });

});

module.exports = router;