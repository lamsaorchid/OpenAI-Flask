import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botDmRepliesTable = pgTable("bot_dm_replies", {
  id: serial("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  messageId: text("message_id").notNull().unique(),
  messageText: text("message_text").notNull(),
  replyText: text("reply_text").notNull(),
  senderUsername: text("sender_username"),
  senderId: text("sender_id"),
  repliedAt: timestamp("replied_at").defaultNow().notNull(),
});

export const insertBotDmReplySchema = createInsertSchema(botDmRepliesTable).omit({ id: true, repliedAt: true });
export type InsertBotDmReply = z.infer<typeof insertBotDmReplySchema>;
export type BotDmReply = typeof botDmRepliesTable.$inferSelect;
