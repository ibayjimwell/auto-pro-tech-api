import { Router } from "express";
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  getInvoicesByAppointment,
  updateInvoice,
  deleteInvoice,
} from "../controllers/invoices.controller.js";

const invoicesRouter = Router();

invoicesRouter.post("/", createInvoice);
invoicesRouter.get("/", getInvoices);
invoicesRouter.get("/:id", getInvoiceById);
invoicesRouter.get("/appointment/:appointmentId", getInvoicesByAppointment);
invoicesRouter.put("/:id", updateInvoice);
invoicesRouter.delete("/:id", deleteInvoice);

export default invoicesRouter;
