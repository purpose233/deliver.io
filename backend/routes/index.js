const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.get('/login', function(req, res, next) {
  res.redirect('/');
});

router.get('/home', function(req, res, next) {
  res.redirect('/');
});

module.exports = router;
