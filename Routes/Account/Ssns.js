var Express = require('express');
var Tags = require('../Validator.js').Tags;
var {Session, router} = require('../Session.js');
var router = Express.Router({caseSensitive: true});

router.baseURL = '/Ssns';

router.get('/', function(req, res) {
   var body = [], ssn;

   if (req.validator.checkAdmin()) {
      Session.getAllIds().forEach(id => {
         ssn = Session.findById(id);
         body.push({id: ssn.id, prsId: ssn.prsId, loginTime: ssn.loginTime});
      });
      res.status(200).json(body);
   }
   req.cnn.release();
});

router.post('/', function(req, res) {
   var ssn;
   var cnn = req.cnn;

   cnn.chkQry('select * from Person where email = ?', [req.body.email],
   function(err, result) {
      if (req.validator.check(result.length && result[0].password ===
       req.body.password, Tags.badLogin, null)) {
         ssn = new Session(result[0], res);
         res.location(router.baseURL + '/' + ssn.id).status(200).end();
      }
      cnn.release();
   });
});

router.delete('/:id', function(req, res) {
   var vld = req.validator;
   var ssn;

   if (vld.checkSsnOK(parseInt(req.params.id)) && 
    vld.check(Session.findById(req.params.id), Tags.notFound, null)) {
      ssn = Session.findById(req.params.id);
      ssn.logOut();
      res.end();
   }

   req.cnn.release();
});

router.get('/:id', function(req, res) {
   var vld = req.validator;
   var ssn = Session.findById(req.badSsnGet ? req.query.id : req.params.id);

   if (vld.check(ssn, Tags.notFound, null) && vld.checkSsnOK(ssn.id)) {
      res.status(200).json({id: ssn.id, prsId: ssn.prsId,
       loginTime: ssn.loginTime});
   }
   req.cnn.release();
});

module.exports = router;
