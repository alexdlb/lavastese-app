export function normalizePhoneForWhatsApp(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";
  if (hasPlus) return digits;
  if (digits.length === 10) return `39${digits}`;
  return digits;
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    const giorno = d.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const ora = d.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    // Capitalizza la prima lettera
    return giorno.charAt(0).toUpperCase() + giorno.slice(1) + " alle " + ora;
  } catch {
    return value;
  }
}

export function buildOrderWhatsAppMessage(order) {
  const nome   = order?.customer?.name || "cliente";
  const phone  = normalizePhoneForWhatsApp(order?.customer?.phone);
  const items  = Array.isArray(order?.items) ? order.items : [];
  const tipo   = order?.fulfillment?.type === "delivery" ? "consegna" : "ritiro";
  const quando = formatDateTime(
    order?.fulfillment?.deliveryDateTime ||
    order?.fulfillment?.dateTime ||
    order?.fulfillment?.date
  );

  // Riga prodotto: nome + eventuale peso
  const rigaProdotto = (item) => {
    let riga = item.productName || "Prodotto";
    if (item.weightGrams) {
      riga += " " + (item.weightGrams / 1000).toFixed(1) + " kg";
    }
    if (item.persons) {
      riga += " (" + item.persons + " persone)";
    }
    if (item.allergenOption && item.allergenOption !== "standard") {
      riga += " [" + item.allergenOption.replace(/_/g, " ") + "]";
    }
    if (item.notes) {
      riga += " - " + item.notes;
    }
    return "  * " + riga;
  };

  const lines = [
    "Gentile " + nome + ",",
    "",
    "grazie per il tuo ordine! Ecco il riepilogo:",
    "",
  ];

  // Prodotti
  if (items.length === 1) {
    lines.push("Prodotto ordinato:");
  } else {
    lines.push("Prodotti ordinati:");
  }
  items.forEach(item => lines.push(rigaProdotto(item)));

  // Data ritiro/consegna
  lines.push("");
  lines.push("Data " + tipo + ":");
  lines.push("  " + quando);

  // Note ordine
  if (order?.notes) {
    lines.push("");
    lines.push("Note: " + order.notes);
  }

  lines.push("");
  lines.push("Ti aspettiamo!");
  lines.push("Lo staff di Lavastese");

  return {
    phone,
    text: lines.join("\n"),
  };
}

export function buildWhatsAppUrl(order) {
  const { phone, text } = buildOrderWhatsAppMessage(order);
  if (!phone) return "";
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
}
