import { useEffect } from "react";
import { useAppStore } from "@/store";
import { themePresets } from "@/lib/theme-presets";
import { applyThemePalette, getSystemThemeMode } from "@/lib/theme-utils";

const ThemeBootstrap = () => {
  const themeMode = useAppStore((state) => state.themeMode);
  const activeThemeSource = useAppStore((state) => state.activeThemeSource);
  const activePreset = useAppStore((state) => state.activePreset);
  const activeCustomThemeId = useAppStore((state) => state.activeCustomThemeId);
  const customThemes = useAppStore((state) => state.customThemes);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyCurrentTheme = () => {
      const resolvedMode =
        themeMode === "system" ? getSystemThemeMode() : themeMode;

      const presetPalette =
        themePresets[resolvedMode]?.[activePreset[resolvedMode]] ||
        themePresets[resolvedMode]?.default;

      const customTheme = customThemes.find(
        (item) =>
          item.id === activeCustomThemeId[resolvedMode] &&
          item.mode === resolvedMode
      );

      const palette =
        activeThemeSource[resolvedMode] === "custom" && customTheme?.palette
          ? customTheme.palette
          : presetPalette;

      applyThemePalette(resolvedMode, palette);
    };

    applyCurrentTheme();

    const handleSystemChange = () => {
      if (themeMode === "system") {
        applyCurrentTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [
    themeMode,
    activeThemeSource,
    activePreset,
    activeCustomThemeId,
    customThemes,
  ]);

  return null;
};

export default ThemeBootstrap;
