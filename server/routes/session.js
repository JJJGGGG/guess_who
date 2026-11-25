var express = require('express');
var crypto = require('crypto');
var router = express.Router();
const { sign, requireAuth } = require('../auth')
const { GRACE_SECONDS } = require('../utils')

router.post('/', function(req, res, next) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''

  if (name.length < 1 || name.length > 20) {
    return res.sendStatus(400)
  }

  const player = { id: crypto.randomUUID(), name }
  return res.json({ token: sign(player), player, graceSeconds: GRACE_SECONDS })
});

router.get('/', requireAuth, function(req, res, next) {
  return res.json({ player: req.player, graceSeconds: GRACE_SECONDS })
});

module.exports = router;
