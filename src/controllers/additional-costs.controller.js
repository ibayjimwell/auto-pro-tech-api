import { Database } from '../database/drizzle.js';
import { AdditionalCosts } from '../models/index.js';
import { eq } from 'drizzle-orm';
import { getIo } from '../websocket.js';

export const getAdditionalCosts = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const costs = await Database.select()
      .from(AdditionalCosts)
      .where(eq(AdditionalCosts.appointmentId, appointmentId));
    res.json({ success: true, data: costs });
  } catch (error) { next(error); }
};

export const addLabor = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { amount, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }
    const [cost] = await Database.insert(AdditionalCosts)
      .values({ appointmentId, type: 'labor', amount, description: description || 'Labor charge' })
      .returning();
    const io = getIo();
    io.emit('additionalCostAdded', { appointmentId, cost });
    res.status(201).json({ success: true, data: cost });
  } catch (error) { next(error); }
};

export const addPart = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { amount, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }
    const [cost] = await Database.insert(AdditionalCosts)
      .values({ appointmentId, type: 'part', amount, description: description || 'Extra part' })
      .returning();
    const io = getIo();
    io.emit('additionalCostAdded', { appointmentId, cost });
    res.status(201).json({ success: true, data: cost });
  } catch (error) { next(error); }
};

export const addDiscount = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { discountType, discountValue, description } = req.body;
    if (!discountType || !discountValue || discountValue <= 0) {
      return res.status(400).json({ success: false, message: 'Valid discount required' });
    }
    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json({ success: false, message: 'Percentage cannot exceed 100' });
    }
    const amount = discountType === 'fixed' ? discountValue : 0;
    const [cost] = await Database.insert(AdditionalCosts)
      .values({
        appointmentId,
        type: 'discount',
        amount: amount,
        discountType,
        discountValue,
        description: description || 'Discount',
      })
      .returning();
    const io = getIo();
    io.emit('additionalCostAdded', { appointmentId, cost });
    res.status(201).json({ success: true, data: cost });
  } catch (error) { next(error); }
};

export const removeAdditionalCost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await Database.select().from(AdditionalCosts).where(eq(AdditionalCosts.id, id));
    if (!existing) return res.status(404).json({ success: false });
    await Database.delete(AdditionalCosts).where(eq(AdditionalCosts.id, id));
    const io = getIo();
    io.emit('additionalCostRemoved', { appointmentId: existing.appointmentId, costId: id });
    res.json({ success: true });
  } catch (error) { next(error); }
};