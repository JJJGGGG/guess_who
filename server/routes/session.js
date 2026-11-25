var express = require('express');
var crypto = require('crypto');
var router = express.Router();
const { sign, requireAuth } = require('../auth')
const { object, string } = require('yup')
const { GRACE_SECONDS, validate } = require('../utils')

const sessionSchema = object({
  name: string().trim().min(1).max(20).required()
})

router.post('/', validate(sessionSchema), function(req, res, next) {
  const name = req.body.name

  const player = { id: crypto.randomUUID(), name }
  return res.json({ token: sign(player), player, graceSeconds: GRACE_SECONDS })
});

router.get('/', requireAuth, function(req, res, next) {
  return res.json({ player: req.player, graceSeconds: GRACE_SECONDS })
});

module.exports = router;
