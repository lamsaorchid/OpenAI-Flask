import { db, botRepliesTable } from "@workspace/db";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID;
const INSTAGRAM_ACCOUNT_ID_ENV = process.env.INSTAGRAM_ACCOUNT_ID;
const POLL_INTERVAL_MS = 60_000;

interface BotState {
  running: boolean;
  instagramAccountId: string | null;
  lastChecked: string | null;
  errorMessage: string | null;
  totalReplies: number;
}

export const botState: BotState = {
  running: false,
  instagramAccountId: null,
  lastChecked: null,
  errorMessage: null,
  totalReplies: 0,
};

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let repliedIds: Set<string> = new Set();

async function getInstagramAccountId(): Promise<string | null> {
  if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
    throw new Error("PAGE_ACCESS_TOKEN and PAGE_ID environment variables are required");
  }
  const url = `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=instagram_business_account&access_token=${PAGE_ACCESS_TOKEN}`;
  const res = await fetch(url);
  const data = (await res.json()) as { instagram_business_account?: { id: string }; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.instagram_business_account?.id ?? null;
}

async function getReply(text: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 150,
      messages: [
        {
          role: "system",
          content:
            "أنت مساعد ودود لمتجر لمسة أوركيد للزهور والهدايا. رد على تعليقات العملاء بإيجاز ومودة مع إيموجي مناسب. للاستفسارات التفصيلية اذكر واتساب: 783200063",
        },
        { role: "user", content: text },
      ],
    });
    return completion.choices[0]?.message?.content ?? "شكراً لتعليقك 🌸 واتساب: 783200063";
  } catch {
    return "شكراً لتعليقك 🌸 واتساب: 783200063";
  }
}

async function loadRepliedIds(): Promise<void> {
  const rows = await db.select({ commentId: botRepliesTable.commentId }).from(botRepliesTable);
  repliedIds = new Set(rows.map((r) => r.commentId));
  botState.totalReplies = rows.length;
}

async function pollAndReply(): Promise<void> {
  if (!botState.instagramAccountId) return;

  try {
    const postsUrl = `https://graph.facebook.com/v21.0/${botState.instagramAccountId}/media?fields=id&limit=5&access_token=${PAGE_ACCESS_TOKEN}`;
    const postsRes = await fetch(postsUrl);
    const postsData = (await postsRes.json()) as { data?: { id: string }[]; error?: { message: string } };

    if (postsData.error) {
      botState.errorMessage = postsData.error.message;
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
        logger.error({ error: commentsData.error.message }, "Error fetching comments");
        continue;
      }

      for (const comment of commentsData.data ?? []) {
        if (repliedIds.has(comment.id)) continue;

        logger.info({ commentId: comment.id, text: comment.text.slice(0, 50) }, "Generating reply");
        const reply = await getReply(comment.text);

        const replyRes = await fetch(`https://graph.facebook.com/v21.0/${comment.id}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: reply, access_token: PAGE_ACCESS_TOKEN }),
        });

        if (replyRes.ok) {
          repliedIds.add(comment.id);
          await db.insert(botRepliesTable).values({
            commentId: comment.id,
            commentText: comment.text,
            replyText: reply,
            username: comment.username ?? null,
            postId: post.id,
          });
          botState.totalReplies += 1;
          logger.info({ commentId: comment.id }, "Reply posted successfully");
        } else {
          const errData = (await replyRes.json()) as { error?: { message: string } };
          logger.error({ error: errData.error?.message }, "Failed to post reply");
        }
      }
    }

    botState.lastChecked = new Date().toISOString();
    botState.errorMessage = null;
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

    let accountId: string | null = null;

    if (INSTAGRAM_ACCOUNT_ID_ENV) {
      accountId = INSTAGRAM_ACCOUNT_ID_ENV;
      logger.info({ accountId }, "Using INSTAGRAM_ACCOUNT_ID from environment");
    } else {
      accountId = await getInstagramAccountId();
    }

    if (!accountId) {
      botState.errorMessage = "لم يتم العثور على حساب Instagram. يرجى إضافة INSTAGRAM_ACCOUNT_ID في الإعدادات.";
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
