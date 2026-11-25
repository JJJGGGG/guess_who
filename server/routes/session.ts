import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { object } from 'yup'
import { sign, requireAuth, playerOf } from '../auth.ts'
import { GRACE_SECONDS, validate, validated, trimmedString } from '../utils.ts'
import type { NewSession, SessionInfo } from '../../shared/types.ts'

const router = express.Router();

const sessionSchema = object({
  name: trimmedString().min(1).max(20).required()
})

router.post('/', validate(sessionSchema), function(req: Request, res: Response<NewSession>) {
  const { name } = validated(req, sessionSchema)

  const player = { id: crypto.randomUUID(), name }
  res.json({ token: sign(player), player, graceSeconds: GRACE_SECONDS })
});

router.get('/', requireAuth, function(req: Request, res: Response<SessionInfo>) {
  res.json({ player: playerOf(req), graceSeconds: GRACE_SECONDS })
});

export default router;
