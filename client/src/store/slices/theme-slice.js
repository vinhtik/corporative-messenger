export const createThemeSlice = (set) => ({
  themeMode: "system",
  activeThemeSource: {
    light: "preset",
    dark: "preset",
  },
  activePreset: {
    light: "default",
    dark: "default",
  },
  activeCustomThemeId: {
    light: null,
    dark: null,
  },
  customThemes: [],

  setThemeMode: (themeMode) => set({ themeMode }),

  setPreset: (mode, presetName) =>
    set((state) => ({
      activePreset: {
        ...state.activePreset,
        [mode]: presetName,
      },
      activeThemeSource: {
        ...state.activeThemeSource,
        [mode]: "preset",
      },
    })),

  activateCustomTheme: (mode, themeId) =>
    set((state) => ({
      activeCustomThemeId: {
        ...state.activeCustomThemeId,
        [mode]: themeId,
      },
      activeThemeSource: {
        ...state.activeThemeSource,
        [mode]: "custom",
      },
    })),

  saveCustomTheme: (theme) =>
    set((state) => {
      const exists = state.customThemes.some((item) => item.id === theme.id);

      const customThemes = exists
        ? state.customThemes.map((item) =>
            item.id === theme.id ? theme : item
          )
        : [...state.customThemes, theme];

      return {
        customThemes,
        activeCustomThemeId: {
          ...state.activeCustomThemeId,
          [theme.mode]: theme.id,
        },
        activeThemeSource: {
          ...state.activeThemeSource,
          [theme.mode]: "custom",
        },
      };
    }),

  removeCustomTheme: (themeId) =>
    set((state) => {
      const themeToRemove = state.customThemes.find((item) => item.id === themeId);

      if (!themeToRemove) {
        return {};
      }

      const customThemes = state.customThemes.filter((item) => item.id !== themeId);
      const mode = themeToRemove.mode;
      const isActive = state.activeCustomThemeId[mode] === themeId;

      return {
        customThemes,
        activeCustomThemeId: isActive
          ? { ...state.activeCustomThemeId, [mode]: null }
          : state.activeCustomThemeId,
        activeThemeSource: isActive
          ? { ...state.activeThemeSource, [mode]: "preset" }
          : state.activeThemeSource,
      };
    }),
});
