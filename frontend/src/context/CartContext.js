import { createContext, useContext } from 'react';

// Lets any product card show "− 1 +" for what is already in the cart (Yandex Lavka style)
export const CartContext = createContext(null);

export function useCart() {
  return useContext(CartContext);
}
