import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectContextType {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  label: React.ReactNode
  setLabel: (label: React.ReactNode) => void
}

const SelectContext = React.createContext<SelectContextType | null>(null)

function useSelectContext() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("Select components must be used within <Select>")
  return ctx
}

export function Select({
  value,
  onValueChange,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [label, setLabel] = React.useState<React.ReactNode>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, label, setLabel }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

export function SelectTrigger({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const { open, setOpen } = useSelectContext()
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
        className
      )}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 opacity-60 transition-transform", open && "rotate-180")} />
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { label } = useSelectContext()
  return <span className="truncate">{label ?? placeholder}</span>
}

export function SelectContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { open } = useSelectContext()
  if (!open) return null
  return (
    <div
      className={cn(
        // Explicit dark-but-distinct panel background + light text so options
        // are always legible (never dark-on-dark) — matches spec Section 5/4.
        "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-800 py-1 text-zinc-100 shadow-xl shadow-black/50",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SelectItem({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const { onValueChange, setOpen, setLabel, value: selectedValue } = useSelectContext()

  React.useEffect(() => {
    if (selectedValue === value) setLabel(children)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, value])

  return (
    <div
      onClick={() => {
        onValueChange(value)
        setLabel(children)
        setOpen(false)
      }}
      className={cn(
        "cursor-pointer px-3 py-2 text-sm text-zinc-100 transition-colors hover:bg-amber-500/15 hover:text-amber-400",
        selectedValue === value && "bg-amber-500/10 text-amber-400",
        className
      )}
    >
      {children}
    </div>
  )
}
