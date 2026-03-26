import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Key,
  Instagram,
  Facebook,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ScopeStatus {
  scope: string;
  granted: boolean;
}

interface TokenInfo {
  configured: boolean;
  isValid?: boolean;
  tokenType?: string;
  isNeverExpires?: boolean;
  expiresAt?: string | null;
  isExpired?: boolean;
  grantedScopes?: string[];
  scopeStatus?: ScopeStatus[];
  page?: { name?: string; picture?: string } | null;
  instagram?: {
    id?: string;
    username?: string;
    name?: string;
    profilePicture?: string;
    followersCount?: number;
  } | null;
  tokenError?: string | null;
  error?: string;
}

const SCOPE_LABELS: Record<string, string> = {
  instagram_basic: "قراءة المنشورات والحساب",
  instagram_manage_comments: "إدارة التعليقات والرد عليها",
  instagram_manage_messages: "إدارة الرسائل المباشرة",
  instagram_content_publish: "نشر المحتوى على انستغرام",
  pages_read_engagement: "قراءة تفاعلات الصفحة",
  pages_manage_posts: "إدارة منشورات الصفحة",
};

export default function TokenChecker() {
  const { toast } = useToast();
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScopes, setShowScopes] = useState(false);

  async function checkToken() {
    setLoading(true);
    setInfo(null);
    try {
      const res = await fetch(`${BASE}/api/bot/token-info`);
      const data = (await res.json()) as TokenInfo;
      setInfo(data);
      if (data.isValid) {
        toast({ title: "التوكن صالح ✅", description: "تم التحقق من صلاحية التوكن بنجاح" });
      } else {
        toast({ title: "مشكلة في التوكن", description: "راجع التفاصيل أدناه", variant: "destructive" });
      }
    } catch {
      setInfo({ configured: false, error: "فشل الاتصال بالخادم" });
    } finally {
      setLoading(false);
    }
  }

  const allRequired = info?.scopeStatus?.every((s) => s.granted) ?? false;
  const missingCount = info?.scopeStatus?.filter((s) => !s.granted).length ?? 0;

  return (
    <div className="space-y-3">
      <Button
        onClick={() => void checkToken()}
        disabled={loading}
        className="w-full rounded-xl font-bold gap-2"
        variant="outline"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> جاري التحقق...</>
        ) : (
          <><ShieldCheck className="w-4 h-4" /> التحقق من صلاحية التوكن</>
        )}
      </Button>

      <AnimatePresence>
        {info && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {!info.configured ? (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-destructive">
                <ShieldX className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{info.error ?? "التوكن غير مُعيَّن"}</span>
              </div>
            ) : (
              <>
                <div
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold ${
                    info.isValid && !info.isExpired
                      ? "bg-success/10 border-success/20 text-success"
                      : "bg-destructive/5 border-destructive/20 text-destructive"
                  }`}
                >
                  {info.isValid && !info.isExpired ? (
                    <><ShieldCheck className="w-4 h-4 shrink-0" /> التوكن صالح وفعّال</>
                  ) : info.isExpired ? (
                    <><ShieldX className="w-4 h-4 shrink-0" /> التوكن منتهي الصلاحية</>
                  ) : (
                    <><ShieldX className="w-4 h-4 shrink-0" /> التوكن غير صالح — {info.tokenError}</>
                  )}
                </div>

                <div className="space-y-2">
                  {info.page?.name && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/30">
                      <Facebook className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">صفحة فيسبوك</p>
                        <p className="text-sm font-bold truncate">{info.page.name}</p>
                      </div>
                      {info.page.picture && (
                        <img src={info.page.picture} alt="" className="w-8 h-8 rounded-full border border-border/40" />
                      )}
                    </div>
                  )}

                  {info.instagram && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/30">
                      <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">حساب انستغرام</p>
                        <p className="text-sm font-bold truncate">@{info.instagram.username ?? info.instagram.name}</p>
                      </div>
                      {info.instagram.followersCount !== undefined && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          {info.instagram.followersCount.toLocaleString("ar-EG")}
                        </div>
                      )}
                    </div>
                  )}

                  {info.isNeverExpires ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                      <Clock className="w-3 h-3" />
                      <span>التوكن دائم (لا ينتهي)</span>
                      <Badge variant="outline" className="text-xs text-success border-success/30">دائم</Badge>
                    </div>
                  ) : info.expiresAt ? (
                    <div className="flex items-center gap-2 text-xs px-1 text-destructive">
                      <Clock className="w-3 h-3" />
                      <span>ينتهي: {new Date(info.expiresAt).toLocaleDateString("ar-EG")}</span>
                    </div>
                  ) : null}
                </div>

                {info.scopeStatus && info.scopeStatus.length > 0 && (
                  <div className="border border-border/30 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowScopes(!showScopes)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        <Key className="w-3.5 h-3.5 text-muted-foreground" />
                        الصلاحيات المطلوبة
                        {allRequired ? (
                          <Badge className="text-xs bg-success/10 text-success border-success/20">مكتملة</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">{missingCount} ناقصة</Badge>
                        )}
                      </div>
                      {showScopes ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    <AnimatePresence>
                      {showScopes && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="divide-y divide-border/20">
                            {info.scopeStatus.map(({ scope, granted }) => (
                              <div key={scope} className="flex items-center gap-2 px-3 py-2">
                                {granted ? (
                                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium ${granted ? "text-foreground" : "text-destructive"}`}>
                                    {SCOPE_LABELS[scope] ?? scope}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-mono">{scope}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {missingCount > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      بعض الصلاحيات غير ممنوحة. لمنحها، اذهب إلى{" "}
                      <a
                        href="https://developers.facebook.com/tools/explorer/"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-semibold"
                      >
                        Graph API Explorer
                      </a>{" "}
                      وأضف الصلاحيات الناقصة إلى التوكن.
                    </span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
