const express = require('express');
const router = express.Router();

const MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://localhost:27017/deliver', function (err, client) {
  if (err) {
    throw err;
  }

  const db = client.db('deliver');
  db.collection('files').find().toArray(function (err, result) {
    if (err) {
      throw err;
    }
    console.log(result)
  })
});

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;
