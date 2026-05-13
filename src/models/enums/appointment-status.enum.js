import { pgEnum } from 'drizzle-orm/pg-core';

export const AppointmentStatusEnum = pgEnum('appointment_status', [
  'PENDING',
  'UNDER_INSPECTION',
  'WAITING_FOR_APPROVAL',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'CONFIRMED' 
]);