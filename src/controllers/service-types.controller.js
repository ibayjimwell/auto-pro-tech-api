import { Database } from '../database/drizzle.js';
import { ServiceTypes, Appointments } from '../models/index.js';
import { eq, sql, desc } from 'drizzle-orm';

/**
 * GET /api/v1/service-types
 * List all active service types with price and duration
 * Role: all (public)
 */
export const getAllServiceTypes = async (req, res, next) => {
  try {
    const serviceTypes = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.active, true));

    res.json({
      success: true,
      data: serviceTypes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/service-types
 * Create a new service type
 * Role: admin only
 */
export const createServiceType = async (req, res, next) => {
  try {
    const { name, description, basePrice, durationMinutes } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'name is required',
      });
    }

    // ➕ Check for duplicate name
    const [existing] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.name, name));

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A service type with the name "${name}" already exists.`,
      });
    }

    // Convert to numbers if they come as strings
    const priceNum = typeof basePrice === 'number' ? basePrice : parseFloat(basePrice);
    const durationNum = typeof durationMinutes === 'number' ? durationMinutes : parseInt(durationMinutes, 10);

    const [serviceType] = await Database.insert(ServiceTypes)
      .values({
        name,
        description: description || null,
        basePrice: priceNum,
        durationMinutes: durationNum,
        active: true,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: serviceType,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/service-types/{id}
 * Update a service type (price, duration, active status)
 * Role: admin only
 */
export const updateServiceType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, basePrice, durationMinutes, active } = req.body;

    // Check if service type exists
    const [existing] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, id));

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found',
      });
    }

    // Validate numeric fields if provided
    if (basePrice !== undefined) {
      if (typeof basePrice !== 'number' || basePrice <= 0) {
        return res.status(400).json({
          success: false,
          message: 'basePrice must be a positive number',
        });
      }
    }

    if (durationMinutes !== undefined) {
      if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
        return res.status(400).json({
          success: false,
          message: 'durationMinutes must be a positive number',
        });
      }
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (basePrice !== undefined) updateData.basePrice = basePrice;
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (active !== undefined) updateData.active = active;

    const [updated] = await Database.update(ServiceTypes)
      .set(updateData)
      .where(eq(ServiceTypes.id, id))
      .returning();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/service-types/{id}
 * Get a specific service type by ID
 * Role: all (public)
 */
export const getServiceTypeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [serviceType] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, id));

    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found',
      });
    }

    res.json({
      success: true,
      data: serviceType,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/service-types/{id}
 * Delete a service type (soft delete by setting active = false)
 * Role: admin only
 */
export const deleteServiceType = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, id));

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found',
      });
    }

    // Soft delete – set active to false
    const [deleted] = await Database.update(ServiceTypes)
      .set({ active: false })
      .where(eq(ServiceTypes.id, id))
      .returning();

    res.json({
      success: true,
      message: 'Service type deactivated',
      data: deleted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/service-types
 * List service types with optional active filter
 */
export const getServiceTypesWithFilter = async (req, res, next) => {
  try {
    const { active } = req.query; // "true" or "false"
    let query = Database.select().from(ServiceTypes);
    
    if (active !== undefined) {
      const isActive = active === 'true';
      query = query.where(eq(ServiceTypes.active, isActive));
    }
    
    const serviceTypes = await query;
    res.json({ success: true, data: serviceTypes });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/service-types/{id}/permanent
 * Permanently delete a service type (only allowed if active = false)
 */
export const permanentDeleteServiceType = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [existing] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, id));
    
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service type not found' });
    }
    
    if (existing.active === true) {
      return res.status(400).json({ success: false, message: 'Cannot delete active service type. Deactivate it first.' });
    }
    
    await Database.delete(ServiceTypes).where(eq(ServiceTypes.id, id));
    res.json({ success: true, message: 'Service type permanently deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/service-types/trending
 * Returns top 4 most booked service types (by appointment count across all statuses)
 * Role: all (public)
 */
export const getTrendingServiceTypes = async (req, res, next) => {
  try {
    const result = await Database.execute(sql`
      SELECT 
        st.id,
        st.name,
        st.description,
        st.base_price AS "basePrice",
        st.duration_minutes AS "durationMinutes",
        st.active,
        COUNT(a.id)::int AS "appointmentCount"
      FROM service_types st
      LEFT JOIN appointments a ON a.service_type_id = st.id
      WHERE st.active = true
      GROUP BY st.id
      ORDER BY "appointmentCount" DESC, st.name ASC
      LIMIT 4
    `);

    const trending = result.rows || [];

    res.json({
      success: true,
      data: trending,
    });
  } catch (error) {
    next(error);
  }
};