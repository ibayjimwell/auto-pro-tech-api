import { Database } from '../database/drizzle.js';
import { EstimateAdjustments } from '../models/index.js';
import { eq } from 'drizzle-orm';
import { getIo } from '../websocket.js';

// Get all adjustments for an appointment
export const getAdjustments = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const adjustments = await Database.select()
      .from(EstimateAdjustments)
      .where(eq(EstimateAdjustments.appointmentId, appointmentId));
    res.json({ success: true, data: adjustments });
  } catch (error) { next(error); }
};

// Add labor charge
export const addLabor = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { amount, label } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }
    const [adj] = await Database.insert(EstimateAdjustments)
      .values({ appointmentId, type: 'labor', amount, label: label || 'Labor', discountType: null, discountValue: null })
      .returning();
    const io = getIo();
    io.emit('estimateUpdated', { type: 'laborAdded', appointmentId, adjustment: adj });
    res.status(201).json({ success: true, data: adj });
  } catch (error) { next(error); }
};

// Remove labor
export const removeLabor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await Database.select().from(EstimateAdjustments).where(eq(EstimateAdjustments.id, id));
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    await Database.delete(EstimateAdjustments).where(eq(EstimateAdjustments.id, id));
    const io = getIo();
    io.emit('estimateUpdated', { type: 'laborRemoved', appointmentId: existing.appointmentId, adjustmentId: id });
    res.json({ success: true });
  } catch (error) { next(error); }
};

// Add discount
export const addDiscount = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { discountType, discountValue, label } = req.body;
    if (!discountType || !discountValue || discountValue <= 0) {
      return res.status(400).json({ success: false, message: 'Valid discount required' });
    }
    const [adj] = await Database.insert(EstimateAdjustments)
      .values({ appointmentId, type: 'discount', label: label || 'Discount', amount: null, discountType, discountValue })
      .returning();
    const io = getIo();
    io.emit('estimateUpdated', { type: 'discountAdded', appointmentId, adjustment: adj });
    res.status(201).json({ success: true, data: adj });
  } catch (error) { next(error); }
};

// Remove discount
export const removeDiscount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await Database.select().from(EstimateAdjustments).where(eq(EstimateAdjustments.id, id));
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    await Database.delete(EstimateAdjustments).where(eq(EstimateAdjustments.id, id));
    const io = getIo();
    io.emit('estimateUpdated', { type: 'discountRemoved', appointmentId: existing.appointmentId, adjustmentId: id });
    res.json({ success: true });
  } catch (error) { next(error); }
};