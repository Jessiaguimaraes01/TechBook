// Mantém a preferência de tema entre as páginas do TechBook.
(() => {
  const CHAVE = "techbook-alto-contraste";
  const aplicar = () => {
    const ativo = localStorage.getItem(CHAVE) === "1";
    document.body?.classList.toggle("alto-contraste", ativo);
    document.documentElement.style.colorScheme = ativo ? "dark" : "light";
  };
  aplicar();
  window.TechBookTheme = {
    aplicar,
    alternar() {
      const ativo = !document.body.classList.contains("alto-contraste");
      localStorage.setItem(CHAVE, ativo ? "1" : "0");
      aplicar();
      return ativo;
    }
  };
})();
