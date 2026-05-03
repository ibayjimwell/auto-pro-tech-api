import { Database } from '../database/drizzle.js';
import { 
  InspectionTasks,
  InspectionFindings,
  InspectionFindingProducts,
  InventoryItems,
  Appointments 
} from '../models/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { getIo } from '../websocket.js';

// ---------- Tasks (with attached findings and products) ----------
export const getTasks = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    // 1. Fetch tasks for this appointment
    const tasks = await Database.select()
      .from(InspectionTasks)
      .where(eq(InspectionTasks.appointmentId, appointmentId))
      .orderBy(InspectionTasks.order);

    // 2. For each task, fetch its findings and for each finding, fetch its products
    const tasksWithFindings = await Promise.all(tasks.map(async (task) => {
      // Fetch findings for this task
      const findings = await Database.select()
        .from(InspectionFindings)
        .where(eq(InspectionFindings.taskId, task.id))
        .orderBy(InspectionFindings.createdAt);

      // For each finding, fetch its products (with inventory item details)
      const findingsWithProducts = await Promise.all(findings.map(async (finding) => {
        const products = await Database.select({
          id: InspectionFindingProducts.id,
          inventoryItemId: InspectionFindingProducts.inventoryItemId,
          quantity: InspectionFindingProducts.quantity,
          priceAtTime: InspectionFindingProducts.priceAtTime,
          name: InventoryItems.name,
          sku: InventoryItems.sku,
          unit: InventoryItems.unit,
        })
          .from(InspectionFindingProducts)
          .leftJoin(InventoryItems, eq(InspectionFindingProducts.inventoryItemId, InventoryItems.id))
          .where(eq(InspectionFindingProducts.findingId, finding.id));

        return {
          ...finding,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            quantity: p.quantity,
            priceAtTime: p.priceAtTime,
            unit: p.unit,
          })),
        };
      }));

      return {
        ...task,
        findings: findingsWithProducts,
      };
    }));

    res.json({ success: true, data: tasksWithFindings });
  } catch (error) { next(error); }
};

export const createTask = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { title, order = 0 } = req.body;
    const [task] = await Database.insert(InspectionTasks)
      .values({ appointmentId, title, status: 'PENDING', order })
      .returning();
    const io = getIo();
    io.emit('taskChanged', { type: 'created', appointmentId, task });
    res.status(201).json({ success: true, data: task });
  } catch (error) { next(error); }
};

export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, title, order } = req.body;
    const [updated] = await Database.update(InspectionTasks)
      .set({ status, title, order, updatedAt: new Date() })
      .where(eq(InspectionTasks.id, id))
      .returning();
    const io = getIo();
    io.emit('taskChanged', { type: 'updated', appointmentId: updated.appointmentId, task: updated });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [task] = await Database.select().from(InspectionTasks).where(eq(InspectionTasks.id, id));
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    await Database.delete(InspectionTasks).where(eq(InspectionTasks.id, id));
    const io = getIo();
    io.emit('taskChanged', { type: 'deleted', appointmentId: task.appointmentId, taskId: id });
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) { next(error); }
};

// ---------- Findings ----------
export const addFinding = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { description, products } = req.body; // products array: { inventoryItemId, quantity, priceAtTime? }

    // Insert the finding
    const [finding] = await Database.insert(InspectionFindings)
      .values({ taskId, description })
      .returning();

    // Insert associated products
    if (products && products.length) {
      for (const prod of products) {
        await Database.insert(InspectionFindingProducts).values({
          findingId: finding.id,
          inventoryItemId: prod.inventoryItemId,
          quantity: prod.quantity,
          priceAtTime: prod.priceAtTime || 0,
        });
      }
    }

    // Emit WebSocket event so that all clients refresh tasks
    const io = getIo();
    io.emit('findingAdded', { taskId, finding: { ...finding, products: products || [] } });

    res.status(201).json({ success: true, data: finding });
  } catch (error) { next(error); }
};

export const deleteFinding = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Delete the finding (cascade delete products via foreign key)
    await Database.delete(InspectionFindings).where(eq(InspectionFindings.id, id));
    const io = getIo();
    io.emit('findingDeleted', { findingId: id });
    res.json({ success: true });
  } catch (error) { next(error); }
};

// ---------- Products (direct addition – may not be used, but kept) ----------
export const addProduct = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { name, quantity, price, notes } = req.body;
    // This is for stand‑alone products (not linked to a finding) – you may not need it.
    const [product] = await Database.insert(TaskProducts)
      .values({ taskId, name, quantity: quantity || 1, price: price || '0', notes })
      .returning();
    const io = getIo();
    io.emit('productAdded', { taskId, product });
    res.status(201).json({ success: true, data: product });
  } catch (error) { next(error); }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Database.delete(TaskProducts).where(eq(TaskProducts.id, id));
    const io = getIo();
    io.emit('productDeleted', { productId: id });
    res.json({ success: true });
  } catch (error) { next(error); }
};

// ---------- Complete Inspection ----------
export const completeInspection = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    // Check all tasks are DONE
    const tasks = await Database.select()
      .from(InspectionTasks)
      .where(eq(InspectionTasks.appointmentId, appointmentId));
    const allDone = tasks.every(t => t.status === 'DONE');
    if (!allDone) {
      return res.status(400).json({ success: false, message: 'Not all tasks are completed' });
    }
    // Update appointment status to WAITING_APPROVAL
    const [updated] = await Database.update(Appointments)
      .set({ status: 'WAITING_FOR_APPROVAL', updatedAt: new Date() })
      .where(eq(Appointments.id, appointmentId))
      .returning();
    const io = getIo();
    io.emit('appointmentChanged', { type: 'statusChanged', appointment: updated });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};