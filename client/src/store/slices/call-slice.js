export const createCallSlice = (set) => ({
  incomingCall: undefined,

  setIncomingCall: (incomingCall) => set({ incomingCall }),

  clearIncomingCall: () =>
    set({
      incomingCall: undefined,
    }),
});