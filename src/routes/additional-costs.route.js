import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  getAdditionalCosts,
  addLabor,
  addPart,
  addDiscount,
  addFindingCost,
  approveAdditionalCost,
  declineAdditionalCost,
  removeAdditionalCost,
} from '../controllers/additional-costs.controller.js';

const additionalCostsRouter = Router();

additionalCostsRouter.get('/appointments/:appointmentId', getAdditionalCosts);
additionalCostsRouter.post('/appointments/:appointmentId/labor', addLabor);
additionalCostsRouter.post('/appointments/:appointmentId/part', addPart);
additionalCostsRouter.post('/appointments/:appointmentId/discount', addDiscount);
additionalCostsRouter.post('/appointments/:appointmentId/finding', addFindingCost);
additionalCostsRouter.patch('/:id/approve', approveAdditionalCost);
additionalCostsRouter.patch('/:id/decline', declineAdditionalCost);
additionalCostsRouter.delete('/:id', removeAdditionalCost);

export default additionalCostsRouter;
