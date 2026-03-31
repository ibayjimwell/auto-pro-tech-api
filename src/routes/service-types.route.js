import { Router } from 'express';
import {
  getAllServiceTypes,
  getServiceTypeById,
  createServiceType,
  updateServiceType,
} from '../controllers/service-types.controller.js';

const serviceTypesRouter = Router();

serviceTypesRouter.get('/', getAllServiceTypes);
serviceTypesRouter.post('/', createServiceType);
serviceTypesRouter.get('/:id', getServiceTypeById);
serviceTypesRouter.put('/:id', updateServiceType);

export default serviceTypesRouter;
