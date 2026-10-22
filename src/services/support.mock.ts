// Мок отправки обращения (ТЗ 12.18). API: POST /support/tickets (multipart) -> 201 { ticketId }
// Текст "error" - ошибка сервера, чтобы проверить состояние ошибки.

export async function sendTicket(data: { email: string; topic: string; message: string; file?: File | null }) {
  await new Promise((r) => setTimeout(r, 800));
  if (data.message.trim().toLowerCase() === "error") throw new Error("Не удалось отправить. Попробуйте еще раз");
  console.log("[support] ticket", { ...data, file: data.file?.name });
  return { ticketId: 2041 };
}
