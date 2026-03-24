import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botRepliesTable = pgTable("bot_replies", {
  id: serial("id").primaryKey(),
  commentId: text("comment_id").notNull().unique(),
  commentText: text("comment_text").notNull(),
  replyText: text("reply_text").notNull(),
  username: text("username"),
  postId: text("post_id").notNull(),
  repliedAt: timestamp("replied_at").defaultNow().notNull(),
});

export const insertBotReplySchema = createInsertSchema(botRepliesTable).omit({ id: true, repliedAt: true });
export type InsertBotReply = z.infer<typeof insertBotReplySchema>;
export type BotReply = typeof botRepliesTable.$inferSelect;
