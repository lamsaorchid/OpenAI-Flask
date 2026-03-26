import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { db, publishedPostsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

interface MediaEntry {
  data: Buffer;
  mimeType: string;
  createdAt: number;
}

const mediaStore = new Map<string, MediaEntry>();

setInterval(() => {
  const tenMinutes = 10 * 60 * 1000;
  const now = Date.now();
  for (const [id, entry] of mediaStore.entries()) {
    if (now - entry.createdAt > tenMinutes) {
      mediaStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

function getPublicBase(req: { headers: Record<string, string | string[] | undefined> }): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || (req.headers["host"] as string) || "localhost";
  return `${proto}://${host}`;
}

router.get("/media/:id", (req, res) => {
  const entry = mediaStore.get(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "الصورة غير موجودة أو انتهت صلاحيتها" });
    return;
  }
  res.set("Content-Type", entry.mimeType);
  res.set("Cache-Control", "public, max-age=600");
  res.send(entry.data);
});

router.post("/posts/caption", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 مطلوب" });
      return;
    }

    const imgBuffer = Buffer.from(imageBase64, "base64");
    const mediaId = randomUUID();
    mediaStore.set(mediaId, { data: imgBuffer, mimeType, createdAt: Date.now() });

    const publicBase = getPublicBase(req);
    const imageUrl = `${publicBase}/api/media/${mediaId}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "أنت خبير تسويق لمتجر لمسة أوركيد للزهور والهدايا. اكتب كابشن جذاب باللغة العربية مناسب للنشر على انستغرام. يجب أن يكون الكابشن:\n- جذاباً وعاطفياً\n- يصف المنتج بشكل جميل\n- يشجع على التفاعل والشراء\n- يحتوي على إيموجي مناسبة\n- يختم بهاشتاق مناسبة\n- لا يتجاوز 200 كلمة",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: "text",
              text: "اكتب كابشن إبداعي لهذه الصورة مناسب لمتجر لمسة أوركيد للزهور والهدايا.",
            },
          ],
        },
      ],
    });

    const caption = completion.choices[0]?.message?.content ?? "لا يمكن توليد كابشن الآن";

    res.json({ caption, mediaId, imageUrl });
  } catch (err) {
    logger.error({ err }, "Error generating caption");
    res.status(500).json({ error: "حدث خطأ أثناء توليد الكابشن" });
  }
});

router.post("/posts/publish", async (req, res) => {
  try {
    const { mediaId, caption } = req.body as { mediaId?: string; caption?: string };

    if (!mediaId || !caption) {
      res.status(400).json({ error: "mediaId و caption مطلوبان" });
      return;
    }

    const entry = mediaStore.get(mediaId);
    if (!entry) {
      res.status(400).json({ error: "الصورة غير موجودة أو انتهت صلاحيتها، يرجى رفع الصورة مجدداً" });
      return;
    }

    const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
    const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID ?? process.env.INSTAGRAM_ACCOUNT_ID_ENV ?? "17841474711606081";

    if (!PAGE_ACCESS_TOKEN) {
      res.status(500).json({ error: "PAGE_ACCESS_TOKEN غير مُعيَّن" });
      return;
    }

    const publicBase = getPublicBase(req);
    const imageUrl = `${publicBase}/api/media/${mediaId}`;

    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${INSTAGRAM_ACCOUNT_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: PAGE_ACCESS_TOKEN,
        }),
      }
    );

    const containerData = (await containerRes.json()) as {
      id?: string;
      error?: { message: string };
    };

    if (containerData.error || !containerData.id) {
      const msg = containerData.error?.message ?? "فشل إنشاء حاوية الصورة";
      logger.error({ msg }, "Instagram container creation failed");
      await db.insert(publishedPostsTable).values({
        imageUrl,
        caption,
        status: "failed",
        errorMessage: msg,
      });
      res.status(500).json({ error: msg });
      return;
    }

    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: PAGE_ACCESS_TOKEN,
        }),
      }
    );

    const publishData = (await publishRes.json()) as {
      id?: string;
      error?: { message: string };
    };

    if (publishData.error || !publishData.id) {
      const msg = publishData.error?.message ?? "فشل نشر المنشور";
      logger.error({ msg }, "Instagram publish failed");
      await db.insert(publishedPostsTable).values({
        imageUrl,
        caption,
        status: "failed",
        errorMessage: msg,
      });
      res.status(500).json({ error: msg });
      return;
    }

    await db.insert(publishedPostsTable).values({
      instagramPostId: publishData.id,
      imageUrl,
      caption,
      status: "published",
    });

    logger.info({ postId: publishData.id }, "Post published successfully");
    res.json({ success: true, postId: publishData.id });
  } catch (err) {
    logger.error({ err }, "Error publishing post");
    res.status(500).json({ error: "حدث خطأ أثناء النشر" });
  }
});

router.get("/posts", async (_req, res) => {
  const posts = await db
    .select()
    .from(publishedPostsTable)
    .orderBy(desc(publishedPostsTable.publishedAt))
    .limit(20);

  res.json({
    posts: posts.map((p) => ({
      id: p.id,
      instagramPostId: p.instagramPostId,
      caption: p.caption,
      imageUrl: p.imageUrl,
      status: p.status,
      errorMessage: p.errorMessage,
      publishedAt: p.publishedAt.toISOString(),
    })),
  });
});

export default router;
