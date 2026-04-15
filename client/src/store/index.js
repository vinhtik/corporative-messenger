import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { createAuthSlice } from "./slices/auth-slice.js";
import { createChatSlice } from "./slices/chat-slice.js";
import { createCallSlice } from "./slices/call-slice.js";
import { createThemeSlice } from "./slices/theme-slice.js";

export const useAppStore = create()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createChatSlice(...a),
      ...createCallSlice(...a),
      ...createThemeSlice(...a),
    }),
    {
      name: "corp-messenger-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        activeThemeSource: state.activeThemeSource,
        activePreset: state.activePreset,
        activeCustomThemeId: state.activeCustomThemeId,
        customThemes: state.customThemes,
      }),
    }
  )
);
