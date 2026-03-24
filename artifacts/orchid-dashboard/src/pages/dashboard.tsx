import React, { useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  Bot, 
  Play, 
  Square, 
  MessageCircle, 
  Instagram, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Mail
} from "lucide-react";
import { 
  useGetBotStatus, 
  useGetBotReplies,
  useGetBotDmReplies,
  useStartBot, 
  useStopBot 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("comments");

  const { data: status, isLoading: isLoadingStatus } = useGetBotStatus({
    query: { refetchInterval: 5000 }
  });

  const { data: repliesData, isLoading: isLoadingReplies } = useGetBotReplies(
    { limit: 20 },
    { query: { refetchInterval: 10000 } }
  );

  const { data: dmRepliesData, isLoading: isLoadingDmReplies } = useGetBotDmReplies(
    { limit: 20 },
    { query: { refetchInterval: 10000 } }
  );

  const startMutation = useStartBot({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] })
    }
  });

  const stopMutation = useStopBot({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] })
    }
  });

  const isRunning = status?.running || false;
  const isPending = startMutation.isPending || stopMutation.isPending;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  return (
    <div className="min-h-screen pb-20 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Background" 
          className="w-full h-[60vh] object-cover opacity-80 mix-blend-multiply dark:mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/90 to-background" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12"
        >
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 text-white">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-l from-primary to-secondary">
                لمسة أوركيد
              </h1>
              <p className="text-muted-foreground mt-1 font-medium">لوحة تحكم بوت الانستغرام الذكي</p>
            </div>
          </div>

          <div className="glass px-6 py-3 rounded-full flex items-center gap-3">
            <div className="relative flex h-4 w-4">
              {isRunning && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-4 w-4 ${isRunning ? 'bg-success' : 'bg-muted-foreground'}`}></span>
            </div>
            <span className="font-bold text-sm">
              {isLoadingStatus ? "جاري التحقق..." : isRunning ? "البوت نشط الآن" : "البوت متوقف"}
            </span>
          </div>
        </motion.header>

        {/* Error Alert */}
        {status?.errorMessage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-5 bg-destructive/10 border-2 border-destructive/20 rounded-2xl flex items-start gap-4 text-destructive-foreground"
          >
            <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-destructive">خطأ في النظام</h3>
              <p className="text-sm mt-1 opacity-90">{status.errorMessage}</p>
            </div>
          </motion.div>
        )}

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-12 gap-8"
        >
          {/* Left sidebar */}
          <div className="md:col-span-4 space-y-6">
            <motion.div variants={itemVariants}>
              <Card className="glass-card border-none shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Bot className="w-5 h-5 text-primary" />
                    التحكم بالبوت
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingStatus ? (
                    <div className="py-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center justify-center py-6 bg-background/50 rounded-2xl border border-white/10">
                        {isRunning ? (
                          <>
                            <CheckCircle2 className="w-16 h-16 text-success mb-4" />
                            <h3 className="text-2xl font-bold text-foreground">جاري التشغيل</h3>
                            <p className="text-sm text-muted-foreground mt-1">البوت يراقب التعليقات والرسائل</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-16 h-16 text-muted-foreground mb-4" />
                            <h3 className="text-2xl font-bold text-foreground">متوقف</h3>
                            <p className="text-sm text-muted-foreground mt-1">البوت لا يقوم بالرد حالياً</p>
                          </>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        {!isRunning ? (
                          <Button 
                            size="lg" 
                            className="w-full text-lg shadow-primary/30"
                            onClick={() => startMutation.mutate()}
                            disabled={isPending}
                          >
                            {startMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Play className="w-5 h-5 ml-2 fill-current" />}
                            تشغيل البوت
                          </Button>
                        ) : (
                          <Button 
                            size="lg" 
                            variant="destructive" 
                            className="w-full text-lg"
                            onClick={() => stopMutation.mutate()}
                            disabled={isPending}
                          >
                            {stopMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Square className="w-5 h-5 ml-2 fill-current" />}
                            إيقاف البوت
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-gradient-to-br from-card to-card/50 shadow-lg border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Instagram className="w-5 h-5 text-pink-500" />
                    معلومات الحساب
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground text-sm">مُعرّف الحساب</span>
                    <span className="font-mono font-bold text-sm bg-muted px-2 py-1 rounded-md">
                      {status?.instagramAccountId || 'غير متصل'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> آخر تحقق
                    </span>
                    <span className="font-semibold text-sm">
                      {status?.lastChecked ? (
                        formatDistanceToNow(parseISO(status.lastChecked), { addSuffix: true, locale: ar })
                      ) : (
                        'لم يتم التحقق بعد'
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Main content */}
          <div className="md:col-span-8 space-y-6">
            {/* Stats */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-background border-l-4 border-l-primary shadow-md">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-4 bg-primary/10 rounded-2xl">
                    <MessageCircle className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">ردود التعليقات</p>
                    <h4 className="text-4xl font-extrabold text-foreground">
                      {isLoadingStatus ? "-" : status?.totalReplies?.toLocaleString('ar-EG') || "0"}
                    </h4>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background border-l-4 border-l-secondary shadow-md">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-4 bg-secondary/10 rounded-2xl">
                    <Mail className="w-8 h-8 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">ردود الرسائل</p>
                    <h4 className="text-4xl font-extrabold text-foreground">
                      {isLoadingStatus ? "-" : status?.totalDmReplies?.toLocaleString('ar-EG') || "0"}
                    </h4>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tabs */}
            <motion.div variants={itemVariants}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full mb-4 h-12">
                  <TabsTrigger value="comments" className="flex-1 gap-2 text-sm font-semibold">
                    <MessageCircle className="w-4 h-4" /> ردود التعليقات
                    <Badge variant="secondary" className="mr-1">{repliesData?.replies?.length || 0}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="dms" className="flex-1 gap-2 text-sm font-semibold">
                    <Mail className="w-4 h-4" /> ردود الرسائل
                    <Badge variant="secondary" className="mr-1">{dmRepliesData?.replies?.length || 0}</Badge>
                  </TabsTrigger>
                </TabsList>

                {/* Comments Tab */}
                <TabsContent value="comments">
                  <Card className="shadow-lg border-border/50 bg-card overflow-hidden">
                    <CardContent className="p-0">
                      {isLoadingReplies ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                          <Loader2 className="w-10 h-10 animate-spin text-primary/50 mb-4" />
                          <p>جاري تحميل الردود...</p>
                        </div>
                      ) : repliesData?.replies && repliesData.replies.length > 0 ? (
                        <div className="divide-y divide-border/50">
                          {repliesData.replies.map((reply) => (
                            <div key={reply.id} className="p-6 hover:bg-muted/20 transition-colors">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">
                                    {reply.username ? reply.username.charAt(0).toUpperCase() : '@'}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{reply.username || 'مستخدم مجهول'}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {formatDistanceToNow(parseISO(reply.repliedAt), { addSuffix: true, locale: ar })}
                                    </p>
                                  </div>
                                </div>
                                <a 
                                  href={`https://instagram.com/p/${reply.postId}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-xs flex items-center gap-1 text-primary hover:underline bg-primary/5 px-2.5 py-1.5 rounded-md transition-colors"
                                >
                                  عرض المنشور <Instagram className="w-3 h-3" />
                                </a>
                              </div>
                              <div className="space-y-3 pl-2">
                                <div className="bg-muted/40 rounded-2xl rounded-tr-sm p-4 text-sm text-foreground/90 border border-border/30">
                                  <span className="block text-xs font-semibold text-muted-foreground mb-1">التعليق:</span>
                                  {reply.commentText}
                                </div>
                                <div className="bg-primary/5 rounded-2xl rounded-tl-sm p-4 text-sm text-foreground border border-primary/10 mr-8">
                                  <span className="block text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" /> رد البوت:
                                  </span>
                                  {reply.replyText}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                          <MessageCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
                          <h4 className="text-lg font-bold text-foreground mb-1">لا توجد ردود بعد</h4>
                          <p className="text-sm">سيظهر هنا سجل الردود على التعليقات.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* DMs Tab */}
                <TabsContent value="dms">
                  <Card className="shadow-lg border-border/50 bg-card overflow-hidden">
                    <CardContent className="p-0">
                      {isLoadingDmReplies ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                          <Loader2 className="w-10 h-10 animate-spin text-secondary/50 mb-4" />
                          <p>جاري تحميل الرسائل...</p>
                        </div>
                      ) : dmRepliesData?.replies && dmRepliesData.replies.length > 0 ? (
                        <div className="divide-y divide-border/50">
                          {dmRepliesData.replies.map((reply) => (
                            <div key={reply.id} className="p-6 hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-secondary/30 to-secondary/10 flex items-center justify-center font-bold text-secondary">
                                  {reply.senderUsername ? reply.senderUsername.charAt(0).toUpperCase() : '@'}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{reply.senderUsername || 'مستخدم مجهول'}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatDistanceToNow(parseISO(reply.repliedAt), { addSuffix: true, locale: ar })}
                                  </p>
                                </div>
                                <Badge variant="outline" className="mr-auto text-xs">رسالة مباشرة</Badge>
                              </div>
                              <div className="space-y-3 pl-2">
                                <div className="bg-muted/40 rounded-2xl rounded-tr-sm p-4 text-sm text-foreground/90 border border-border/30">
                                  <span className="block text-xs font-semibold text-muted-foreground mb-1">الرسالة:</span>
                                  {reply.messageText}
                                </div>
                                <div className="bg-secondary/5 rounded-2xl rounded-tl-sm p-4 text-sm text-foreground border border-secondary/10 mr-8">
                                  <span className="block text-xs font-semibold text-secondary mb-1 flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" /> رد البوت:
                                  </span>
                                  {reply.replyText}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                          <Mail className="w-16 h-16 text-muted-foreground/30 mb-4" />
                          <h4 className="text-lg font-bold text-foreground mb-1">لا توجد رسائل بعد</h4>
                          <p className="text-sm">سيظهر هنا سجل الردود على الرسائل المباشرة.</p>
                          <p className="text-xs mt-2 text-muted-foreground/70 max-w-xs text-center">
                            يتطلب صلاحية instagram_manage_messages في التوكن
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
