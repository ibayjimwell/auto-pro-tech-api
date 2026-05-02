import { Router } from "express";
import customersRouter from "./customers.route.js";
import appointmentsRouter from "./appointments.route.js";
import serviceTypesRouter from "./service-types.route.js";
import vehiclesRouter from "./vehicles.route.js";
import staffRouter from "./staff.route.js";
import invoicesRouter from "./invoices.route.js";
import authRouter from "./auth.route.js";
import pushTokensRouter from './pushTokens.route.js';

const router = Router();

router.use("/customers", customersRouter);
router.use("/appointments", appointmentsRouter);
router.use("/service-types", serviceTypesRouter);
router.use("/vehicles", vehiclesRouter);
router.use("/staff", staffRouter);
router.use("/invoices", invoicesRouter);
router.use("/auth", authRouter);
router.use('/push-tokens', pushTokensRouter);

export default router;
