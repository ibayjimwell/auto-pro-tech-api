import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  savePushToken,
  deletePushToken,
  getPushTokens,
} from '../controllers/pushTokens.controller.js';

const pushTokensRouter = Router();

// All routes require authentication
pushTokensRouter.use(authenticate);

pushTokensRouter.post('/', savePushToken);
pushTokensRouter.delete('/', deletePushToken);
pushTokensRouter.get('/', getPushTokens);

export default pushTokensRouter;