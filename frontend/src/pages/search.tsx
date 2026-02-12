import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Bot,
  FileText,
  Plug,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { assistantsApi } from "@/api/assistants";
import { chatApi } from "@/api/chat";
import type { Assistant, Citation } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const suggestions = [
  "Résume le dernier échange avec le client Dupont",
  "Quelles sont les clauses du NDA en cours ?",
  "Trouve les tarifs actuels",
  "Cherche le contrat de prestation",
];

interface SearchResult {
  id: string;
  content: string;
  citations: Citation[];
  isStreaming: boolean;
}

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Fetch assistants for the selector
  const { data: assistants = [] } = useQuery({
    queryKey: ["assistants"],
    queryFn: assistantsApi.list,
  });

  // Auto-select first assistant
  useEffect(() => {
    const first = assistants[0];
    if (first && !selectedAssistantId) {
      setSelectedAssistantId(first.id);
    }
  }, [assistants, selectedAssistantId]);

  // Scroll to result when it appears
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [result?.id]);

  const handleSearch = useCallback(() => {
    if (!query.trim() || !selectedAssistantId) return;

    // Abort previous search
    if (abortRef.current) abortRef.current();

    const resultId = Date.now().toString();
    setResult({ id: resultId, content: "", citations: [], isStreaming: true });
    setIsSearching(true);
    setShowCitations(false);

    abortRef.current = chatApi.stream(
      selectedAssistantId,
      { message: query.trim() },
      // onToken
      (token) => {
        setResult((prev) =>
          prev ? { ...prev, content: prev.content + token } : prev
        );
      },
      // onComplete
      (response) => {
        setResult((prev) =>
          prev
            ? { ...prev, isStreaming: false, citations: response.citations }
            : prev
        );
        setIsSearching(false);
      },
      // onError
      (error) => {
        console.error("Search error:", error);
        setResult((prev) =>
          prev
            ? { ...prev, content: "Une erreur s'est produite. Réessayez.", isStreaming: false }
            : prev
        );
        setIsSearching(false);
      }
    );
  }, [query, selectedAssistantId]);

  const selectedAssistant = assistants.find((a: Assistant) => a.id === selectedAssistantId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 h-auto min-h-[3.5rem] px-3 sm:px-5 py-2 border-b border-border bg-surface-elevated shrink-0 flex-wrap">
        <Search className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
        <h1 className="font-display font-semibold text-foreground text-sm sm:text-base">
          Recherche
        </h1>
        {assistants.length > 0 && (
          <select
            value={selectedAssistantId || ""}
            onChange={(e) => setSelectedAssistantId(e.target.value)}
            className="ml-auto text-xs bg-card border border-border rounded-md px-2 py-1.5 text-foreground outline-none focus:ring-4 focus:ring-ring/15 focus:border-ring/35"
          >
            {assistants.map((a: Assistant) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-surface">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {/* Search hero */}
          {!result && (
            <div className="pt-16 pb-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-lg bg-accent flex items-center justify-center">
                <Search className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Interrogez vos sources
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Posez une question en langage naturel. L'IA cherchera dans vos
                  documents et sources connectées.
                </p>
              </div>
              {selectedAssistant && (
                <div className="flex justify-center gap-2">
                  {selectedAssistant.collection_ids.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {selectedAssistant.collection_ids.length} collection{selectedAssistant.collection_ids.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {selectedAssistant.integration_ids.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Plug className="h-3 w-3" />
                      {selectedAssistant.integration_ids.length} connecteur{selectedAssistant.integration_ids.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search input */}
          <div className={cn("sticky top-0 z-10 bg-surface pb-4", result ? "pt-6" : "pt-0")}>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Rechercher dans vos sources..."
                className="w-full text-sm bg-card border border-border rounded-lg px-4 py-4 pr-24 outline-none focus:ring-4 focus:ring-ring/15 focus:border-ring/35 text-foreground placeholder:text-muted-foreground shadow-soft transition-colors"
                disabled={isSearching}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  variant="premium"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={handleSearch}
                  disabled={!query.trim() || isSearching || !selectedAssistantId}
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          {!result && (
            <div className="space-y-2 pb-8">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Suggestions
              </p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQuery(s);
                  }}
                  className="block w-full text-left text-sm px-4 py-3 rounded-lg bg-card border border-border hover:border-primary/30 hover:shadow-soft transition-all text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Result */}
          {result && (
            <div ref={resultRef} className="pb-8 space-y-4">
              <div className="bg-card border border-border rounded-lg p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {result.isStreaming && !result.content ? (
                      <div className="flex gap-1 py-2">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {result.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {/* Citations */}
                {!result.isStreaming && result.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => setShowCitations(!showCitations)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showCitations ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {result.citations.length} source{result.citations.length > 1 ? "s" : ""}
                    </button>
                    {showCitations && (
                      <div className="mt-3 space-y-2">
                        {result.citations.map((c, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
                          >
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {c.document_filename}
                              {c.page_number && (
                                <span>· Page {c.page_number}</span>
                              )}
                            </div>
                            <p className="mt-1 text-xs italic text-foreground/70">
                              "{c.excerpt}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* New search button */}
              {!result.isStreaming && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResult(null);
                      setQuery("");
                    }}
                    className="gap-1.5"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Nouvelle recherche
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
