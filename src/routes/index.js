import { Router } from "express";
import customersRouter from "./customers.route.js";
import appointmentsRouter from "./appointments.route.js";
import serviceTypesRouter from "./service-types.route.js";
import vehiclesRouter from "./vehicles.route.js";
import staffRouter from "./staff.route.js";
import invoicesRouter from "./invoices.route.js";
import authRouter from "./auth.route.js";
import pushTokensRouter from './pushTokens.route.js';
import inspectionRouter from './inspection.route.js';
import inventoryRouter from './inventory.route.js';
import estimateRouter from './estimate.route.js';
import additionalCostsRouter from './additional-costs.route.js';

const router = Router();

router.use("/customers", customersRouter);
router.use("/appointments", appointmentsRouter);
router.use("/service-types", serviceTypesRouter);
router.use("/vehicles", vehiclesRouter);
router.use("/staff", staffRouter);
router.use("/invoices", invoicesRouter);
router.use("/auth", authRouter);
router.use('/push-tokens', pushTokensRouter);
router.use('/inspection', inspectionRouter);
router.use('/inventory', inventoryRouter);
router.use('/estimate', estimateRouter);
router.use('/additional-costs', additionalCostsRouter);

export default router;
