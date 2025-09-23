// Utility functions for cross-component communication

export const refreshPrintOrderCount = () => {
  window.dispatchEvent(new CustomEvent('refreshPrintOrderCount'));
};

export const refreshEvents = {
  printOrderCount: refreshPrintOrderCount,
};