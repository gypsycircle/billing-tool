// lib/domain/shortcuts.ts
// The app's single-key shortcuts, in one place: the keys the hotkeys listen
// for and the keys the buttons and the command menu show.

export const SHORTCUTS = {
  newBooking: "b",
  newExpense: "e",
  /** On a booking's page. */
  downloadBill: "d",
  /** In Settings. */
  addTeamMember: "t",
  addListItem: "l",
} as const;
