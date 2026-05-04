import { Router } from 'express';
import {
  getServiceTypesWithFilter,
  getServiceTypeById,
  createServiceType,
  updateServiceType,
  deleteServiceType,
  permanentDeleteServiceType,
} from '../controllers/service-types.controller.js';

const serviceTypesRouter = Router();

serviceTypesRouter.get('/', getServiceTypesWithFilter); // now accepts ?active=true/false
serviceTypesRouter.post('/', createServiceType);
serviceTypesRouter.get('/:id', getServiceTypeById);
serviceTypesRouter.put('/:id', updateServiceType);
serviceTypesRouter.delete('/:id', deleteServiceType);          // soft delete (set active=false)
serviceTypesRouter.delete('/:id/permanent', permanentDeleteServiceType); // hard delete

export default serviceTypesRouter;