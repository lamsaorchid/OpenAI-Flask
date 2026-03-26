import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Sparkles,
  Send,
  ImageIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PublishedPost {
  id: number;
  instagramPostId: string | null;
  caption: string;
  imageUrl: string;
  status: string;
  errorMessage: string | null;
  publishedAt: string;
}

export default function PostPublisher() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [caption, setCaption] = useState("");
  const [mediaId, setMediaId] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedPostId, setPublishedPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: postsData, refetch: refetchPosts } = useQuery<{ posts: PublishedPost[] }>({
    queryKey: ["/api/posts"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/posts`);
      return res.json() as Promise<{ posts: PublishedPost[] }>;
    },
    refetchInterval: 30000,
  });

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }

  function loadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "خطأ", description: "يرجى رفع صورة فقط", variant: "destructive" });
      return;
    }
    setError(null);
    setCaption("");
    setMediaId(null);
    setPublishedPostId(null);
    setImageMime(file.type);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      const base64 = result.split(",")[1] ?? "";
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  }

  async function generateCaption() {
    if (!imageBase64) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/posts/caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: imageMime }),
      });
      const data = (await res.json()) as { caption?: string; mediaId?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "حدث خطأ");
        return;
      }
      setCaption(data.caption ?? "");
      setMediaId(data.mediaId ?? null);
      toast({ title: "تم التوليد", description: "تم توليد الكابشن بنجاح ✨" });
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setIsGenerating(false);
    }
  }

  async function publishPost() {
    if (!mediaId || !caption.trim()) return;
    setIsPublishing(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/posts/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, caption }),
      });
      const data = (await res.json()) as { success?: boolean; postId?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "فشل النشر");
        return;
      }
      setPublishedPostId(data.postId ?? "");
      toast({ title: "تم النشر! 🎉", description: "تم نشر المنشور على انستغرام بنجاح" });
      void refetchPosts();
      setImagePreview(null);
      setImageBase64(null);
      setCaption("");
      setMediaId(null);
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setIsPublishing(false);
    }
  }

  function reset() {
    setImagePreview(null);
    setImageBase64(null);
    setCaption("");
    setMediaId(null);
    setPublishedPostId(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              رفع صورة المنشور
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!imagePreview ? (
              <div
                className="border-2 border-dashed border-border/60 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all min-h-[260px]"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
              >
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">اسحب الصورة هنا أو انقر للرفع</p>
                  <p className="text-sm text-muted-foreground mt-1">JPG, PNG, WEBP — بحد أقصى 10MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-border/40 aspect-square max-h-[280px] flex items-center justify-center bg-muted/30">
                  <img src={imagePreview} alt="preview" className="w-full h-full object-contain" />
                  <button
                    onClick={reset}
                    className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm border border-border/40 rounded-full p-1.5 hover:bg-destructive/10 hover:border-destructive/30 transition-all"
                    title="إزالة الصورة"
                  >
                    <XCircle className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>

                <Button
                  onClick={() => void generateCaption()}
                  disabled={isGenerating || !imageBase64}
                  className="w-full rounded-xl bg-gradient-to-l from-primary to-secondary text-white font-bold gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري توليد الكابشن...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      توليد كابشن بالذكاء الاصطناعي
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              الكابشن والنشر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="سيظهر هنا الكابشن المُوَلَّد... يمكنك تعديله قبل النشر"
              className="min-h-[200px] rounded-xl border-border/40 bg-muted/20 text-sm leading-relaxed resize-none focus:border-primary/50"
              dir="rtl"
            />

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm"
                >
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {publishedPostId && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-start gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>تم النشر بنجاح! معرف المنشور: {publishedPostId}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <Button
                onClick={() => void publishPost()}
                disabled={isPublishing || !mediaId || !caption.trim()}
                className="flex-1 rounded-xl bg-gradient-to-l from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-bold gap-2 shadow-md"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري النشر...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    نشر على انستغرام
                  </>
                )}
              </Button>
              {caption && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void generateCaption()}
                  disabled={isGenerating || !imageBase64}
                  title="إعادة توليد الكابشن"
                  className="rounded-xl border-border/40"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>

            {!mediaId && caption === "" && (
              <p className="text-xs text-muted-foreground text-center">
                ارفع صورة أولاً ثم اضغط على "توليد كابشن"
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {postsData && postsData.posts.length > 0 && (
        <Card className="border border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              المنشورات السابقة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {postsData.posts.map((post) => (
                <div key={post.id} className="p-4 flex gap-4 hover:bg-muted/20 transition-colors">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border/30">
                    <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {post.status === "published" ? (
                        <Badge className="text-xs bg-success/10 text-success border-success/20 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> منشور
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <XCircle className="w-3 h-3" /> فشل
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(parseISO(post.publishedAt), { addSuffix: true, locale: ar })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2">{post.caption}</p>
                    {post.errorMessage && (
                      <p className="text-xs text-destructive mt-1">{post.errorMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
