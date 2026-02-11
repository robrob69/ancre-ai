import { TiptapCanvas } from "./TiptapCanvas"
import { LineItemsTable } from "./LineItemsTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2 } from "lucide-react"
import type { DocBlock, LineItemData } from "@/types"

interface BlockRendererProps {
  block: DocBlock
  onChange: (patch: Partial<DocBlock>) => void
  onRemove: () => void
}

export function BlockRenderer({
  block,
  onChange,
  onRemove,
}: BlockRendererProps) {
  const renderContent = () => {
    switch (block.type) {
      case "rich_text":
        return (
          <TiptapCanvas
            blockId={block.id}
            content={block.content || {}}
            onChange={(content) => onChange({ content })}
            editable={!block.locked}
          />
        )

      case "clause":
        return (
          <div className="space-y-1">
            {block.clause_ref && (
              <p className="text-xs text-muted-foreground">
                Ref: {block.clause_ref}
              </p>
            )}
            <TiptapCanvas
              blockId={block.id}
              content={block.content || {}}
              onChange={(content) => onChange({ content })}
              editable={!block.locked}
              placeholder="Redigez la clause..."
            />
          </div>
        )

      case "terms":
        return (
          <TiptapCanvas
            blockId={block.id}
            content={block.content || {}}
            onChange={(content) => onChange({ content })}
            editable={!block.locked}
            placeholder="Conditions generales..."
          />
        )

      case "line_items":
        return (
          <LineItemsTable
            blockId={block.id}
            items={block.items || []}
            currency={block.currency || "EUR"}
            onChange={(items: LineItemData[]) => onChange({ items })}
          />
        )

      case "signature":
        return (
          <div className="flex gap-8 pt-8">
            {(block.parties || []).map((party, i) => (
              <div key={i} className="flex-1 border-t pt-3">
                <p className="font-medium">
                  {(party as Record<string, string>).name || ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(party as Record<string, string>).role || ""}
                </p>
                {(party as Record<string, string>).date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Date: {(party as Record<string, string>).date}
                  </p>
                )}
              </div>
            ))}
          </div>
        )

      case "attachments":
        return (
          <div className="space-y-1">
            {(block.files || []).map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span>
                  {(file as Record<string, string>).filename ||
                    (file as Record<string, string>).name ||
                    "Fichier"}
                </span>
              </div>
            ))}
            {(!block.files || block.files.length === 0) && (
              <p className="text-sm text-muted-foreground italic">
                Aucune piece jointe
              </p>
            )}
          </div>
        )

      case "variables":
        return (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(block.variables || {}).map(([key, val]) => (
              <div key={key} className="flex gap-2">
                <span className="font-medium">{key}:</span>
                <span className="text-muted-foreground">{String(val)}</span>
              </div>
            ))}
          </div>
        )

      default:
        return (
          <p className="text-sm text-muted-foreground italic">
            Bloc non supporte: {block.type}
          </p>
        )
    }
  }

  return (
    <div className="group relative">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {block.label && (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {block.label}
            </span>
          )}
          <Badge variant="outline" className="text-[10px] py-0">
            {block.type}
          </Badge>
          {block.locked && (
            <Badge variant="secondary" className="text-[10px] py-0">
              verrouille
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {renderContent()}
    </div>
  )
}
