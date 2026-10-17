import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";

export function useWorkLike(workId) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const queryKey = ["work-like", workId, user?.id];

  const query = useQuery({
    queryKey,
    enabled: !!workId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_likes")
        .select("work_id")
        .eq("user_id", user.id)
        .eq("work_id", workId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("toggle_work_like", {
        work_id_in: workId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (liked) => {
      queryClient.setQueryData(queryKey, liked);
      queryClient.invalidateQueries({ queryKey: ["work", workId] });
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["hot-works"] });
      queryClient.invalidateQueries({ queryKey: ["recent-updates"] });
      queryClient.invalidateQueries({ queryKey: ["infinite-works"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["search-results"] });
    },
  });

  return {
    isLiked: query.data ?? false,
    isLoading: query.isLoading,
    toggleLike: mutation,
  };
}

export function useWorkBookmark(workId, folder = "reading") {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const queryKey = ["work-bookmark", workId, user?.id, folder];

  const query = useQuery({
    queryKey,
    enabled: !!workId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("work_id", workId)
        .eq("folder", folder)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("toggle_bookmark", {
        work_id_in: workId,
        folder_in: folder,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (bookmarked) => {
      queryClient.setQueryData(queryKey, bookmarked);
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] });
    },
  });

  return {
    isBookmarked: query.data ?? false,
    isLoading: query.isLoading,
    toggleBookmark: mutation,
  };
}
