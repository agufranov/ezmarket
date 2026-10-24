// Текст писем. Код - только в теле письма, в логи и базу он не попадает.
export function codeEmail(code: string, mode: "login" | "register") {
  const action = mode === "register" ? "завершения регистрации" : "входа";
  const subject = `${code} - код для ${action} в EzMarket`;
  const text = [
    `Ваш код для ${action}: ${code}`,
    "",
    "Код действует 10 минут и подходит один раз.",
    "Если вы не запрашивали код, просто проигнорируйте это письмо.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#1e2229">
  <p>Ваш код для ${action}:</p>
  <p style="font-size:32px;font-weight:900;letter-spacing:6px;margin:16px 0">${code}</p>
  <p style="color:#686e78">Код действует 10 минут и подходит один раз.<br>Если вы не запрашивали код, просто проигнорируйте это письмо.</p>
</div>`;
  return { subject, text, html };
}
