// src/hooks/useSearch.js
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef(null);

  const debouncedSetQuery = useCallback((val) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 400);
  }, []);

  useEffect(() => {
    debouncedSetQuery(query);
    return () => clearTimeout(timerRef.current);
  }, [query, debouncedSetQuery]);

  const results = useQuery({
    queryKey: ["search-results", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];

      const { data } = await supabase
        .from("works_full")
        .select("*")
        .or(
          `title.ilike.%${debouncedQuery}%,` +
            `description.ilike.%${debouncedQuery}%,` +
            `summary.ilike.%${debouncedQuery}%`,
        )
        .limit(20);

      return data || [];
    },
    enabled: debouncedQuery.length >= 2,
  });

  return { query, setQuery, results, debouncedQuery };
}
