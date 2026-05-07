// Boot file — initializes the theme store at app start so the first paint
// already shows the user's chosen theme (no flash-of-wrong-mode).

import { boot } from "quasar/wrappers";
import { useThemeStore } from "@/stores/theme";

export default boot(({ store }) => {
  // Pinia is already installed by the "pinia" boot file (registered earlier).
  void store;
  const theme = useThemeStore();
  theme.init();
});
