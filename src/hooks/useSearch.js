import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef(null);

  const debouncedSetQuery = useCallback((value) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 400);
  }, []);

  useEffect(() => {
    debouncedSetQuery(query);
    return () => clearTimeout(timerRef.current);
  }, [query, debouncedSetQuery]);

  const results = useQuery({
    queryKey: ["search-results", debouncedQuery],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_works", {
        search_query_in: debouncedQuery.trim() || null,
        tag_in: null,
        genre_in: null,
        result_limit: 20,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedQuery.trim().length >= 2,
  });

  return { query, setQuery, results, debouncedQuery };
}
