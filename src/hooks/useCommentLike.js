import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";

export function useCommentLike(commentId, invalidateKey) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("toggle_comment_like", {
        comment_id_in: commentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (invalidateKey) {
        queryClient.invalidateQueries({ queryKey: invalidateKey });
      }
    },
  });
}
