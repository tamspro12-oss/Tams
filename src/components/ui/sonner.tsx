import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={{
        ["--top-offset" as any]: "calc(env(safe-area-inset-top, 0px) + 8px)",
      }}
      toastOptions={{
        duration: 3500,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg text-sm py-2.5 px-3.5 rounded-xl",
          description: "group-[.toast]:text-muted-foreground text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground text-xs",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground text-xs",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
