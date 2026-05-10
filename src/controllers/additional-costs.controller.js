import { Database } from '../database/drizzle.js';
import { AdditionalCosts, InspectionFindings, InspectionFindingProducts, InventoryItems } from '../models/index.js';
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

/**
 * POST /api/v1/additional-costs/appointments/:appointmentId/finding
 * Add a new finding found during repair (IN_PROGRESS) as a pending additional cost
 * Body: { description, parts: [{ inventoryItemId, quantity }] }
 */
export const addFindingCost = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { description, parts } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Finding description required' });
    }

    // 1. Create a new inspection finding (will be linked to no specific task for IN_PROGRESS)
    const [finding] = await Database.insert(InspectionFindings)
      .values({ taskId: null, description: `[Additional] ${description}` })
      .returning();

    // 2. Calculate total parts cost
    let totalPartsCost = 0;
    if (parts && parts.length > 0) {
      for (const part of parts) {
        const [item] = await Database.select()
          .from(InventoryItems)
          .where(eq(InventoryItems.id, part.inventoryItemId));
        if (item) {
          const priceAtTime = parseFloat(item.sellPrice) || 0;
          totalPartsCost += priceAtTime * part.quantity;
          await Database.insert(InspectionFindingProducts).values({
            findingId: finding.id,
            inventoryItemId: part.inventoryItemId,
            quantity: part.quantity,
            priceAtTime,
          });
        }
      }
    }

    // 3. Create additional cost (PENDING approval)
    const amount = totalPartsCost;
    const [cost] = await Database.insert(AdditionalCosts)
      .values({
        appointmentId,
        findingId: finding.id,
        type: 'finding',
        description: description.trim(),
        amount,
        status: 'PENDING',
      })
      .returning();

    const io = getIo();
    io.emit('additionalCostAdded', { appointmentId, cost, finding });
    io.emit('findingAdded', { finding });

    res.status(201).json({ success: true, data: { cost, finding } });
  } catch (error) { next(error); }
};

/**
 * PATCH /api/v1/additional-costs/:id/approve
 * Customer approves a pending additional cost
 */
export const approveAdditionalCost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [cost] = await Database.update(AdditionalCosts)
      .set({ status: 'APPROVED' })
      .where(eq(AdditionalCosts.id, id))
      .returning();
    if (!cost) return res.status(404).json({ success: false, message: 'Cost not found' });

    const io = getIo();
    io.emit('additionalCostApproved', { appointmentId: cost.appointmentId, cost });
    res.json({ success: true, data: cost });
  } catch (error) { next(error); }
};

/**
 * PATCH /api/v1/additional-costs/:id/decline
 * Customer declines a pending additional cost
 */
export const declineAdditionalCost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [cost] = await Database.update(AdditionalCosts)
      .set({ status: 'DECLINED' })
      .where(eq(AdditionalCosts.id, id))
      .returning();
    if (!cost) return res.status(404).json({ success: false, message: 'Cost not found' });

    const io = getIo();
    io.emit('additionalCostDeclined', { appointmentId: cost.appointmentId, cost });
    res.json({ success: true, data: cost });
  } catch (error) { next(error); }
};