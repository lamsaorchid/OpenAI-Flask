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

router.get("/bot/token-info", async (_req, res) => {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const PAGE_ID = process.env.PAGE_ID;

  if (!PAGE_ACCESS_TOKEN) {
    res.status(200).json({
      configured: false,
      error: "PAGE_ACCESS_TOKEN غير مُعيَّن في الإعدادات",
    });
    return;
  }

  try {
    const [debugRes, pageRes] = await Promise.all([
      fetch(
        `https://graph.facebook.com/debug_token?input_token=${PAGE_ACCESS_TOKEN}&access_token=${PAGE_ACCESS_TOKEN}`
      ),
      PAGE_ID
        ? fetch(
            `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name,picture,instagram_business_account{username,name,profile_picture_url,followers_count}&access_token=${PAGE_ACCESS_TOKEN}`
          )
        : Promise.resolve(null),
    ]);

    type DebugData = {
      data?: {
        is_valid?: boolean;
        expires_at?: number;
        scopes?: string[];
        type?: string;
        app_id?: string;
        error?: { message: string };
      };
      error?: { message: string };
    };

    type PageData = {
      name?: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: {
        id?: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      };
      error?: { message: string };
    };

    const debugData = (await debugRes.json()) as DebugData;
    const pageData = pageRes ? ((await pageRes.json()) as PageData) : null;

    const tokenInfo = debugData.data ?? {};
    const igAccount = pageData?.instagram_business_account;

    const requiredScopes = [
      "instagram_basic",
      "instagram_manage_comments",
      "instagram_manage_messages",
      "instagram_content_publish",
      "pages_read_engagement",
      "pages_manage_posts",
    ];

    const grantedScopes = tokenInfo.scopes ?? [];
    const scopeStatus = requiredScopes.map((scope) => ({
      scope,
      granted: grantedScopes.includes(scope),
    }));

    const expiresAt = tokenInfo.expires_at;
    const isNeverExpires = expiresAt === 0;
    const expiresDate = expiresAt && !isNeverExpires ? new Date(expiresAt * 1000).toISOString() : null;
    const isExpired = expiresDate ? new Date(expiresDate) < new Date() : false;

    res.json({
      configured: true,
      isValid: tokenInfo.is_valid ?? false,
      tokenType: tokenInfo.type ?? "unknown",
      isNeverExpires,
      expiresAt: expiresDate,
      isExpired,
      grantedScopes,
      scopeStatus,
      page: pageData?.error ? null : {
        name: pageData?.name,
        picture: pageData?.picture?.data?.url,
      },
      instagram: igAccount
        ? {
            id: igAccount.id,
            username: igAccount.username,
            name: igAccount.name,
            profilePicture: igAccount.profile_picture_url,
            followersCount: igAccount.followers_count,
          }
        : null,
      tokenError: tokenInfo.error?.message ?? debugData.error?.message ?? null,
    });
  } catch (err) {
    res.status(500).json({
      configured: true,
      error: err instanceof Error ? err.message : "حدث خطأ أثناء التحقق من التوكن",
    });
  }
});

export default router;
