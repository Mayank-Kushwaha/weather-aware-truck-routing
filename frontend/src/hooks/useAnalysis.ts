import { useCallback, useRef, useState } from "react";
import { analyze } from "@/api";
import type { AnalyzeRequest, AnalyzeResult } from "@/types";

/** Runs analyses one at a time: a new request cancels the previous one, results keep the request that made them. */
export function useAnalysis() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [request, setRequest] = useState<AnalyzeRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (req: AnalyzeRequest): Promise<AnalyzeResult | null> => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await analyze(req, ctrl.signal);
      setResult(res);
      setRequest(req);
      return res;
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      return null;
    } finally {
      if (abort.current === ctrl) setLoading(false);
    }
  }, []);

  return { result, request, loading, error, run };
}
