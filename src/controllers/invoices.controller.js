import { Database } from "../database/drizzle.js";
import { Invoices, Appointments, Staff } from "../models/index.js";
import { eq, and, ilike, or } from "drizzle-orm";

export const createInvoice = async (req, res, next) => {
  try {
    const {
      appointmentId,
      invoiceType,
      status,
      totalAmount,
      details,
      issuedByStaffId,
    } = req.body;

    // Validate required fields
    if (
      !appointmentId ||
      !invoiceType ||
      !status ||
      totalAmount === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "appointmentId, invoiceType, status, and totalAmount are required",
      });
    }

    // Check if appointment exists
    const [appointment] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, appointmentId));
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Check if staff exists if provided
    if (issuedByStaffId) {
      const [staff] = await Database.select()
        .from(Staff)
        .where(eq(Staff.id, issuedByStaffId));
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: "Staff not found",
        });
      }
    }

    const [invoice] = await Database.insert(Invoices)
      .values({
        appointmentId,
        invoiceType,
        status,
        totalAmount,
        details: details || null,
        issuedByStaffId: issuedByStaffId || null,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Invoice created",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

export const getInvoices = async (req, res, next) => {
  try {
    const { status, appointmentId, issuedByStaffId } = req.query;
    let query = Database.select().from(Invoices);

    if (status) {
      query = query.where(eq(Invoices.status, status));
    }

    if (appointmentId) {
      query = query.where(eq(Invoices.appointmentId, appointmentId));
    }

    if (issuedByStaffId) {
      query = query.where(eq(Invoices.issuedByStaffId, issuedByStaffId));
    }

    const invoices = await query;
    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
};

export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [invoice] = await Database.select()
      .from(Invoices)
      .where(eq(Invoices.id, id));
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }
    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

export const getInvoicesByAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const invoices = await Database.select()
      .from(Invoices)
      .where(eq(Invoices.appointmentId, appointmentId));
    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
};

export const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      invoiceType,
      status,
      totalAmount,
      details,
      issuedByStaffId,
      approvedAt,
      completedAt,
      cancelledAt,
    } = req.body;

    // Check if invoice exists
    const [existingInvoice] = await Database.select()
      .from(Invoices)
      .where(eq(Invoices.id, id));
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Check if staff exists if provided
    if (issuedByStaffId) {
      const [staff] = await Database.select()
        .from(Staff)
        .where(eq(Staff.id, issuedByStaffId));
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: "Staff not found",
        });
      }
    }

    const updateData = {};
    if (invoiceType) updateData.invoiceType = invoiceType;
    if (status) updateData.status = status;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
    if (details !== undefined) updateData.details = details;
    if (issuedByStaffId !== undefined)
      updateData.issuedByStaffId = issuedByStaffId;
    if (approvedAt) updateData.approvedAt = new Date(approvedAt);
    if (completedAt) updateData.completedAt = new Date(completedAt);
    if (cancelledAt) updateData.cancelledAt = new Date(cancelledAt);

    const [invoice] = await Database.update(Invoices)
      .set(updateData)
      .where(eq(Invoices.id, id))
      .returning();

    res.json({
      success: true,
      message: "Invoice updated",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [invoice] = await Database.select()
      .from(Invoices)
      .where(eq(Invoices.id, id));
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    await Database.delete(Invoices).where(eq(Invoices.id, id));
    res.json({
      success: true,
      message: "Invoice deleted",
    });
  } catch (error) {
    next(error);
  }
};
