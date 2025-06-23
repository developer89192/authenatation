import { Router } from 'express';

const router = Router();

router.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

export default router;
