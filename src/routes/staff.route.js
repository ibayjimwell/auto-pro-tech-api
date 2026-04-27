import { Router } from 'express';
import {
  createStaff,
  getStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  resetStaffPassword,
} from '../controllers/staff.controller.js';

const staffRouter = Router();

staffRouter.post('/', createStaff);
staffRouter.get('/', getStaff);
staffRouter.get('/:id', getStaffById);
staffRouter.put('/:id', updateStaff);
staffRouter.delete('/:id', deleteStaff);
staffRouter.post('/:id/reset-password', resetStaffPassword);

export default staffRouter;