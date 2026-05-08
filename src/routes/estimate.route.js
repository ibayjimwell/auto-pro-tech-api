import { Router } from 'express';
import { getAdjustments, addLabor, removeLabor, addDiscount, removeDiscount } from '../controllers/estimate.controller.js';

const estimateRouter = Router();

estimateRouter.get('/appointments/:appointmentId/estimate', getAdjustments);
estimateRouter.post('/appointments/:appointmentId/estimate/labor', addLabor);
estimateRouter.delete('/estimate/labor/:id', removeLabor);
estimateRouter.post('/appointments/:appointmentId/estimate/discount', addDiscount);
estimateRouter.delete('/estimate/discount/:id', removeDiscount);

export default estimateRouter;