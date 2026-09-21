(() => {
  const stored = localStorage.getItem("papertrust-theme");
  const theme =
    stored === "light" || stored === "dark"
      ? stored
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#111b17" : "#f8f7f3";
})();
