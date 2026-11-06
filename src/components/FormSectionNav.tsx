import { cn } from "@/lib/utils";

interface FormSectionNavProps {
  sections: { id: string; label: string; color?: string }[];
  activeSection: number;
  onNavigate: (index: number) => void;
  className?: string;
}

export function FormSectionNav({ 
  sections, 
  activeSection, 
  onNavigate,
  className 
}: FormSectionNavProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
    slate: 'bg-slate-500',
  };

  return (
    <nav 
      className={cn(
        "fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 p-2 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg",
        className
      )}
      aria-label="Form section navigation"
    >
      {sections.map((section, index) => (
        <button
          key={section.id}
          onClick={() => onNavigate(index)}
          className="group relative flex items-center"
          aria-label={`Go to ${section.label}`}
          aria-current={activeSection === index ? 'true' : 'false'}
        >
          {/* Tooltip */}
          <span className="absolute right-full mr-3 px-2 py-1 text-xs font-medium bg-popover text-popover-foreground rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
            {section.label}
          </span>
          
          {/* Dot */}
          <span
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300 ease-out",
              activeSection === index 
                ? cn("scale-150", section.color ? colorMap[section.color] : "bg-primary")
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50 hover:scale-125"
            )}
          />
        </button>
      ))}
    </nav>
  );
}
