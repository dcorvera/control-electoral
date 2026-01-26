// src/lib/stores/themeStore.ts
import { writable } from 'svelte/store';

export const darkMode = writable(false);

darkMode.subscribe((value) => {
  if (typeof window !== 'undefined') {
    if (value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
});
