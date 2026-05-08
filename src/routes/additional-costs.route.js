import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  getAdditionalCosts,
  addLabor,
  addPart,
  addDiscount,
  removeAdditionalCost,
} from '../controllers/additional-costs.controller.js';

const additionalCostsRouter = Router();

additionalCostsRouter.get('/appointments/:appointmentId', getAdditionalCosts);
additionalCostsRouter.post('/appointments/:appointmentId/labor', addLabor);
additionalCostsRouter.post('/appointments/:appointmentId/part', addPart);
additionalCostsRouter.post('/appointments/:appointmentId/discount', addDiscount);
additionalCostsRouter.delete('/:id', removeAdditionalCost);

export default additionalCostsRouter;