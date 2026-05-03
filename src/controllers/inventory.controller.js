import { Database } from '../database/drizzle.js';
import { InventoryItems } from '../models/index.js';
import { eq, ilike } from 'drizzle-orm';

export const getItems = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = Database.select().from(InventoryItems);
    if (search) {
      query = query.where(
        ilike(InventoryItems.name, `%${search}%`)
        // could also search by sku or category
      );
    }
    const items = await query;
    res.json({ success: true, data: items });
  } catch (error) { next(error); }
};

export const getItemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [item] = await Database.select().from(InventoryItems).where(eq(InventoryItems.id, id));
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (error) { next(error); }
};

export const createItem = async (req, res, next) => {
  try {
    const { name, sku, category, stockQty, minThreshold, unit, costPrice, sellPrice } = req.body;
    const [existing] = await Database.select().from(InventoryItems).where(eq(InventoryItems.sku, sku));
    if (existing) return res.status(409).json({ success: false, message: 'SKU already exists' });
    const [item] = await Database.insert(InventoryItems).values({
      name, sku, category, stockQty: stockQty || 0, minThreshold, unit, costPrice, sellPrice
    }).returning();
    res.status(201).json({ success: true, data: item });
  } catch (error) { next(error); }
};

export const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const [updated] = await Database.update(InventoryItems).set(updates).where(eq(InventoryItems.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};

export const deleteItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Database.delete(InventoryItems).where(eq(InventoryItems.id, id));
    res.json({ success: true });
  } catch (error) { next(error); }
};

// Deduct stock (used when mechanic uses a product)
export const deductStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const [item] = await Database.select().from(InventoryItems).where(eq(InventoryItems.id, id));
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.stockQty < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }
    const [updated] = await Database.update(InventoryItems)
      .set({ stockQty: item.stockQty - quantity, updatedAt: new Date() })
      .where(eq(InventoryItems.id, id))
      .returning();
    res.json({ success: true, data: updated, alert: updated.stockQty <= (item.minThreshold || 0) ? { level: 'LOW_STOCK', stockQty: updated.stockQty } : null });
  } catch (error) { next(error); }
};