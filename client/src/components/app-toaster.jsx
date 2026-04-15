import { Toaster } from "sonner";
import { useAppStore } from "@/store";
import { getSystemThemeMode } from "@/lib/theme-utils";

const AppToaster = () => {
  const themeMode = useAppStore((state) => state.themeMode);

  const resolvedTheme =
    themeMode === "system" ? getSystemThemeMode() : themeMode;

  return (
    <Toaster
      theme={resolvedTheme}
      position="top-right"
      closeButton
      richColors={false}
      icons={{
        success: null,
        error: null,
        info: null,
        warning: null,
        loading: null,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "!relative !rounded-2xl !border !border-border !bg-card !text-card-foreground !shadow-lg !px-4 !py-4 !pr-4 !pl-4",
          content: "!m-0 !p-0 !gap-1",
          title: "!text-sm !font-medium !text-card-foreground !leading-5",
          description: "!mt-1 !text-sm !text-muted-foreground !leading-5",

          closeButton:
            "!absolute !left--8 !top--8 !z-10 !m-0 !h-6 !w-6 !rounded-full !border !border-border !bg-background !p-0 !text-muted-foreground !flex !items-center !justify-center !transition-all hover:!bg-secondary hover:!text-accent-foreground",

          actionButton:
            "!rounded-xl !bg-primary !text-primary-foreground hover:!bg-primary/90",
          cancelButton:
            "!rounded-xl !bg-secondary !text-secondary-foreground hover:!bg-secondary/80",

          default:
            "!border-border !bg-card !text-card-foreground",
          success:
            "!border-border !bg-card !text-card-foreground",
          error:
            "!border-border !bg-card !text-card-foreground",
          info:
            "!border-border !bg-card !text-card-foreground",
          warning:
            "!border-border !bg-card !text-card-foreground",
          loading:
            "!border-border !bg-card !text-card-foreground",
        },
      }}
    />
  );
};

export default AppToaster;
