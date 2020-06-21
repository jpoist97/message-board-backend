var mysql = require('mysql');

var CnnPool = function() {
   var poolCfg = require('./connection.json');

   poolCfg.connectionLimit = CnnPool.PoolSize;
   this.pool = mysql.createPool(poolCfg);
};

CnnPool.PoolSize = 1;

CnnPool.singleton = new CnnPool();

CnnPool.prototype.getConnection = function(cb) {
   this.pool.getConnection(cb);
};

CnnPool.router = function(req, res, next) {
   CnnPool.singleton.getConnection(function(err, cnn) {
      if (err)
         res.status(500).json('Failed to get connection ' + err);
      else {
         cnn.chkQry = function(qry, prms, cb) {
            let result = res;
            this.query(qry, prms, (err, res, fields) => {
               if (err) {
                  result.status(500).json('Failed query ' + qry);
               }
               cb(err, res, fields);
            });
         };
         req.cnn = cnn;
         next();
      }
   });
};

module.exports = CnnPool;
