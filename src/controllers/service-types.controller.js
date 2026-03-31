import { Database } from '../database/drizzle.js';
import { ServiceTypes } from '../models/index.js';
import { eq } from 'drizzle-orm';

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
    if (!name || !basePrice || !durationMinutes) {
      return res.status(400).json({
        success: false,
        message: 'name, basePrice, and durationMinutes are required',
      });
    }

    if (typeof basePrice !== 'number' || basePrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'basePrice must be a positive number',
      });
    }

    if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'durationMinutes must be a positive number',
      });
    }

    const [serviceType] = await Database.insert(ServiceTypes)
      .values({
        name,
        description: description || null,
        basePrice,
        durationMinutes,
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
