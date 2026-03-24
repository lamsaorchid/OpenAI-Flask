import { Router, type IRouter } from "express";
import { db, botRepliesTable, botDmRepliesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { GetBotRepliesQueryParams, GetBotDmRepliesQueryParams } from "@workspace/api-zod";
import { botState, startBot, stopBot } from "../bot/worker";

const router: IRouter = Router();

function formatStatus() {
  return {
    running: botState.running,
    totalReplies: botState.totalReplies,
    totalDmReplies: botState.totalDmReplies,
    instagramAccountId: botState.instagramAccountId,
    lastChecked: botState.lastChecked,
    errorMessage: botState.errorMessage,
  };
}

router.get("/bot/status", (_req, res) => {
  res.json(formatStatus());
});

router.get("/bot/replies", async (req, res) => {
  const query = GetBotRepliesQueryParams.parse(req.query);
  const limit = query.limit ?? 20;
  const replies = await db
    .select()
    .from(botRepliesTable)
    .orderBy(desc(botRepliesTable.repliedAt))
    .limit(limit);

  res.json({
    replies: replies.map((r) => ({
      id: r.id,
      commentId: r.commentId,
      commentText: r.commentText,
      replyText: r.replyText,
      username: r.username,
      postId: r.postId,
      repliedAt: r.repliedAt.toISOString(),
    })),
  });
});

router.get("/bot/dm-replies", async (req, res) => {
  const query = GetBotDmRepliesQueryParams.parse(req.query);
  const limit = query.limit ?? 20;
  const replies = await db
    .select()
    .from(botDmRepliesTable)
    .orderBy(desc(botDmRepliesTable.repliedAt))
    .limit(limit);

  res.json({
    replies: replies.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      messageId: r.messageId,
      messageText: r.messageText,
      replyText: r.replyText,
      senderUsername: r.senderUsername,
      senderId: r.senderId,
      repliedAt: r.repliedAt.toISOString(),
    })),
  });
});

router.post("/bot/start", async (_req, res) => {
  await startBot();
  res.json(formatStatus());
});

router.post("/bot/stop", (_req, res) => {
  stopBot();
  res.json(formatStatus());
});

export default router;
