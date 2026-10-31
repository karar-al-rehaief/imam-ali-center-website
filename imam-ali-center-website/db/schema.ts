import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const serviceRequests = sqliteTable('service_requests', {
  id: text('id').primaryKey(),
  service: text('service').notNull(),
  payload: text('payload').notNull(),
  payloadHash: text('payload_hash').notNull(),
  status: text('status').notNull().default('new'),
  createdAt: text('created_at').notNull(),
}, table => [index('service_requests_created').on(table.createdAt)]);
export const serviceRequestLimits = sqliteTable('service_request_limits', {
  ip: text('ip').notNull(), hour: integer('hour').notNull(), count: integer('count').notNull(),
}, table => [primaryKey({ columns: [table.ip, table.hour] })]);
export const hallCheckouts = sqliteTable('hall_checkouts', {
 id: text('id').primaryKey(), tokenHash: text('token_hash').notNull(),
 payload: text('payload').notNull(), amount: integer('amount').notNull(),
 status: text('status').notNull().default('open'), configId: text('config_id').notNull(),
 attempt: text('attempt'), source: text('source'), orderId: text('order_id'),
 paymentId: text('payment_id'), receipt: text('receipt'),
 notified: integer('notified').notNull().default(0), createdAt: text('created_at').notNull(),
});
