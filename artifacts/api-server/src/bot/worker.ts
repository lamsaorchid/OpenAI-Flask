import { db, botRepliesTable, botDmRepliesTable } from "@workspace/db";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID;
const INSTAGRAM_ACCOUNT_ID_ENV =
  process.env.INSTAGRAM_ACCOUNT_ID === "26365467606417316"
    ? "17841474711606081"
    : (process.env.INSTAGRAM_ACCOUNT_ID ?? "17841474711606081");
const POLL_INTERVAL_MS = 60_000;

interface BotState {
  running: boolean;
  instagramAccountId: string | null;
  lastChecked: string | null;
  errorMessage: string | null;
  totalReplies: number;
  totalDmReplies: number;
}

export const botState: BotState = {
  running: false,
  instagramAccountId: null,
  lastChecked: null,
  errorMessage: null,
  totalReplies: 0,
  totalDmReplies: 0,
};

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let repliedCommentIds: Set<string> = new Set();
let repliedMessageIds: Set<string> = new Set();

async function getInstagramAccountId(): Promise<string | null> {
  if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
    throw new Error(
      "PAGE_ACCESS_TOKEN and PAGE_ID environment variables are required",
    );
  }
  const url = `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=instagram_business_account&access_token=${PAGE_ACCESS_TOKEN}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    instagram_business_account?: { id: string };
    error?: { message: string };
  };
  if (data.error) throw new Error(data.error.message);
  return data.instagram_business_account?.id ?? null;
}

async function getReply(
  text: string,
  context: "comment" | "dm",
): Promise<string> {
  const systemPrompt =
    context === "dm"
      ? "أنت مساعد ودود لمتجر لمسة أوركيد للزهور والهدايا. رد على رسائل العملاء المباشرة بإيجاز ومودة مع إيموجي مناسب. أجب على أسئلة المنتجات والأسعار وأوقات العمل بشكل مفيد. للاستفسارات التفصيلية اذكر واتساب: 783200063"
      : "أنت مساعد ودود لمتجر لمسة أوركيد للزهور والهدايا. رد على تعليقات العملاء بإيجاز ومودة مع إيموجي مناسب. للاستفسارات التفصيلية اذكر واتساب: 783200063";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });
    const fallback =
      context === "dm"
        ? "شكراً لرسالتك 🌸 سنرد عليك قريباً. واتساب: 783200063"
        : "شكراً لتعليقك 🌸 واتساب: 783200063";
    return completion.choices[0]?.message?.content ?? fallback;
  } catch {
    return context === "dm"
      ? "شكراً لرسالتك 🌸 سنرد عليك قريباً. واتساب: 783200063"
      : "شكراً لتعليقك 🌸 واتساب: 783200063";
  }
}

async function loadRepliedIds(): Promise<void> {
  const commentRows = await db
    .select({ commentId: botRepliesTable.commentId })
    .from(botRepliesTable);
  repliedCommentIds = new Set(commentRows.map((r) => r.commentId));
  botState.totalReplies = commentRows.length;

  const dmRows = await db
    .select({ messageId: botDmRepliesTable.messageId })
    .from(botDmRepliesTable);
  repliedMessageIds = new Set(dmRows.map((r) => r.messageId));
  botState.totalDmReplies = dmRows.length;
}

async function pollComments(): Promise<void> {
  if (!botState.instagramAccountId) return;

  const postsUrl = `https://graph.facebook.com/v21.0/${botState.instagramAccountId}/media?fields=id&limit=5&access_token=${PAGE_ACCESS_TOKEN}`;
  const postsRes = await fetch(postsUrl);
  const postsData = (await postsRes.json()) as {
    data?: { id: string }[];
    error?: { message: string };
  };

  if (postsData.error) {
    const msg = postsData.error.message;
    if (
      msg.includes("nonexisting field") ||
      msg.includes("OAuthException") ||
      msg.includes("permission")
    ) {
      botState.errorMessage = `خطأ في الصلاحيات (التعليقات): يجب أن يحتوي التوكن على صلاحية instagram_basic. (${msg})`;
    } else {
      botState.errorMessage = msg;
    }
    return;
  }

  const posts = postsData.data ?? [];
  logger.info({ count: posts.length }, "Fetched Instagram posts");

  for (const post of posts) {
    const commentsUrl = `https://graph.facebook.com/v21.0/${post.id}/comments?fields=id,text,username&access_token=${PAGE_ACCESS_TOKEN}`;
    const commentsRes = await fetch(commentsUrl);
    const commentsData = (await commentsRes.json()) as {
      data?: { id: string; text: string; username?: string }[];
      error?: { message: string };
    };

    if (commentsData.error) {
      logger.error(
        { error: commentsData.error.message },
        "Error fetching comments",
      );
      continue;
    }

    for (const comment of commentsData.data ?? []) {
      if (repliedCommentIds.has(comment.id)) continue;

      logger.info(
        { commentId: comment.id, text: comment.text.slice(0, 50) },
        "Generating comment reply",
      );
      const reply = await getReply(comment.text, "comment");

      const replyRes = await fetch(
        `https://graph.facebook.com/v21.0/${comment.id}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: reply,
            access_token: PAGE_ACCESS_TOKEN,
          }),
        },
      );

      if (replyRes.ok) {
        repliedCommentIds.add(comment.id);
        await db.insert(botRepliesTable).values({
          commentId: comment.id,
          commentText: comment.text,
          replyText: reply,
          username: comment.username ?? null,
          postId: post.id,
        });
        botState.totalReplies += 1;
        logger.info({ commentId: comment.id }, "Comment reply posted");
      } else {
        const errData = (await replyRes.json()) as {
          error?: { message: string };
        };
        logger.error(
          { error: errData.error?.message },
          "Failed to post comment reply",
        );
      }
    }
  }
}

async function pollDms(): Promise<void> {
  if (!botState.instagramAccountId) return;

  try {
    const convsUrl = `https://graph.facebook.com/v21.0/${PAGE_ID}/conversations?platform=instagram&fields=id,senders,former_participants&access_token=${PAGE_ACCESS_TOKEN}`;
    const convsRes = await fetch(convsUrl);
    const convsData = (await convsRes.json()) as {
      data?: {
        id: string;
        senders?: { data: { id: string; username?: string }[] };
      }[];
      error?: { message: string };
    };

    if (convsData.error) {
      const msg = convsData.error.message;
      if (msg.includes("permission") || msg.includes("nonexisting")) {
        logger.info(
          "DM polling unavailable — requires instagram_manage_messages permission",
        );
      } else {
        logger.debug({ msg }, "DM conversation fetch error");
      }
      return;
    }

    const conversations = convsData.data ?? [];
    if (conversations.length === 0) return;

    logger.info({ count: conversations.length }, "Fetched DM conversations");

    for (const conv of conversations) {
      const msgsUrl = `https://graph.facebook.com/v21.0/${conv.id}/messages?fields=id,message,from,created_time&access_token=${PAGE_ACCESS_TOKEN}`;
      const msgsRes = await fetch(msgsUrl);
      const msgsData = (await msgsRes.json()) as {
        data?: {
          id: string;
          message: string;
          from?: { id: string; username?: string };
          created_time: string;
        }[];
        error?: { message: string };
      };

      if (msgsData.error) {
        logger.debug(
          { error: msgsData.error.message },
          "Error fetching messages",
        );
        continue;
      }

      for (const msg of msgsData.data ?? []) {
        if (repliedMessageIds.has(msg.id)) continue;
        if (msg.from?.id === botState.instagramAccountId) continue;
        if (!msg.message?.trim()) continue;

        logger.info(
          { msgId: msg.id, text: msg.message.slice(0, 50) },
          "Generating DM reply",
        );
        const reply = await getReply(msg.message, "dm");

        const senderId = msg.from?.id;
        if (!senderId) continue;

        const sendUrl = `https://graph.facebook.com/v21.0/${botState.instagramAccountId}/messages`;
        const sendRes = await fetch(sendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: reply },
            access_token: PAGE_ACCESS_TOKEN,
          }),
        });

        if (sendRes.ok) {
          repliedMessageIds.add(msg.id);
          await db.insert(botDmRepliesTable).values({
            conversationId: conv.id,
            messageId: msg.id,
            messageText: msg.message,
            replyText: reply,
            senderUsername: msg.from?.username ?? null,
            senderId: senderId,
          });
          botState.totalDmReplies += 1;
          logger.info({ msgId: msg.id }, "DM reply sent");
        } else {
          const errData = (await sendRes.json()) as {
            error?: { message: string };
          };
          logger.debug(
            { error: errData.error?.message },
            "Failed to send DM reply",
          );
        }
      }
    }
  } catch (err) {
    logger.debug(
      { err },
      "DM polling error — feature may not be available with current token permissions",
    );
  }
}

async function pollAndReply(): Promise<void> {
  try {
    await pollComments();
    await pollDms();
    botState.lastChecked = new Date().toISOString();
    if (!botState.errorMessage?.includes("الصلاحيات")) {
      botState.errorMessage = null;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    botState.errorMessage = message;
    logger.error({ err }, "Error in bot poll cycle");
  }
}

async function workerLoop(): Promise<void> {
  if (!botState.running) return;
  await pollAndReply();
  if (botState.running) {
    workerTimer = setTimeout(workerLoop, POLL_INTERVAL_MS);
  }
}

export async function startBot(): Promise<void> {
  if (botState.running) return;
  botState.running = true;
  botState.errorMessage = null;

  try {
    await loadRepliedIds();

    const accountId =
      INSTAGRAM_ACCOUNT_ID_ENV || (await getInstagramAccountId());

    if (!accountId) {
      botState.errorMessage =
        "لم يتم العثور على حساب Instagram. يرجى إضافة INSTAGRAM_ACCOUNT_ID في الإعدادات.";
      botState.running = false;
      return;
    }
    botState.instagramAccountId = accountId;
    logger.info({ accountId }, "Bot started with Instagram account");
    void workerLoop();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    botState.errorMessage = message;
    botState.running = false;
    logger.error({ err }, "Failed to start bot");
  }
}

export function stopBot(): void {
  botState.running = false;
  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }
  logger.info("Bot stopped");
}
