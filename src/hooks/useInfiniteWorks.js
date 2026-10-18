// src/hooks/useInfiniteWorks.js
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";

const PAGE_SIZE = 20;

export function useInfiniteWorks({ sort = "popular", fandomId, tags } = {}) {
  return useInfiniteQuery({
    queryKey: ["infinite-works", sort, fandomId, tags],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("works_full")
        .select("*")
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      query = query.eq("visibility", "public").neq("status", "draft");
      if (fandomId) query = query.eq("fandom_id", fandomId);
      if (tags?.length) {
        const normalizedTags = (Array.isArray(tags) ? tags : [tags]).map((tag) =>
          String(tag).toLowerCase(),
        );
        query = query.contains("tags", normalizedTags);
      }

      const orderMap = {
        popular: { column: "views_count", ascending: false },
        new: { column: "created_at", ascending: false },
        updated: { column: "last_chapter_at", ascending: false },
        random: { column: "created_at", ascending: false },
      };

      const order = orderMap[sort] || orderMap.popular;
      query = query.order(order.column, { ascending: order.ascending });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
  });
}
