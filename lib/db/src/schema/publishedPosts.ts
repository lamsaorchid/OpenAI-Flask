import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const publishedPostsTable = pgTable("published_posts", {
  id: serial("id").primaryKey(),
  instagramPostId: text("instagram_post_id"),
  imageUrl: text("image_url").notNull(),
  caption: text("caption").notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  status: text("status").notNull().default("published"),
  errorMessage: text("error_message"),
});

export type PublishedPost = typeof publishedPostsTable.$inferSelect;
