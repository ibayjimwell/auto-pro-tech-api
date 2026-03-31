import { pgEnum } from 'drizzle-orm/pg-core';

export const InvoiceTypeEnum = pgEnum('invoice_type', ['ESTIMATE', 'FINAL']);
export const InvoiceStatusEnum = pgEnum('invoice_status', ['PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED']);
