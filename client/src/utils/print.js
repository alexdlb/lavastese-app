import { apiFetch } from "./auth.js";

// Scarica il PDF della comanda e apre la finestra di stampa del browser,
// che stampa sulla stampante installata sul dispositivo in uso.
export async function printOrder(orderId) {
  const res = await apiFetch(`/api/orders/${orderId}/pdf`);
  if (!res.ok) throw new Error("Errore generazione comanda");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.src = url;

  const cleanup = () => {
    iframe.remove();
    URL.revokeObjectURL(url);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      // Se il browser non permette la stampa diretta, apre il PDF in una scheda
      window.open(url, "_blank");
    }
    setTimeout(cleanup, 60000);
  };

  document.body.appendChild(iframe);
}
