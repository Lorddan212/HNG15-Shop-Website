/** Copy and available actions depend on real session and persisted guest selection. */
export function accountContent(hasSession: boolean, hasGuestItems: boolean) {
  return {
    showOrders: hasSession,
    heading: hasGuestItems ? 'Keep your selection close' : 'Your FolioVale account',
    body: hasGuestItems
      ? 'Sign in or create an account with Google to save this cart and sync it across your phone and the FolioVale website.'
      : 'Sign in or create an account with Google to save your cart, view your orders, and keep everything in sync across devices.',
  };
}
