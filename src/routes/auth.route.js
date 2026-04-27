import { Router } from 'express';
import {
  register,
  login,
  getMe,
  staffLogin,
  setNewStaffPassword,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const authRouter = Router();

// Customer routes
authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', authenticate, getMe);

// Staff routes
authRouter.post('/staff/login', staffLogin);
authRouter.post('/staff/set-new-password', setNewStaffPassword);

export default authRouter;