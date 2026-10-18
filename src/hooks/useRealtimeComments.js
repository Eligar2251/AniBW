// src/hooks/useRealtimeComments.js
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";

export function useRealtimeComments(target) {
  const queryClient = useQueryClient();
  const chapterId = typeof target === "object" ? target?.chapterId : target;
  const workId = typeof target === "object" ? target?.workId : undefined;

  useEffect(() => {
    const filterId = chapterId || workId;
    if (!filterId) return undefined;

    const column = chapterId ? "chapter_id" : "work_id";
    const queryKey = chapterId
      ? ["chapter-comments", chapterId]
      : ["work-comments", workId];
    const channel = supabase
      .channel(`comments:${column}:${filterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `${column}=eq.${filterId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
          queryClient.invalidateQueries({
            queryKey: chapterId
              ? ["chapter-comment-replies", chapterId]
              : ["work-comment-replies", workId],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chapterId, workId, queryClient]);
}
