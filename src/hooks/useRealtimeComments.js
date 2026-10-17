// src/hooks/useRealtimeComments.js
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";

export function useRealtimeComments(chapterId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chapterId) return;

    const channel = supabase
      .channel(`comments:${chapterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `chapter_id=eq.${chapterId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["chapter-comments", chapterId],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chapterId, queryClient]);
}
