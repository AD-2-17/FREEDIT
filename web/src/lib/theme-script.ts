export const THEME_KEY = "freedit-theme";

/** Runs before first paint (inlined in <head>) so a saved light/dark choice never flashes. */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
