import { Module } from "@nestjs/common";
import { CONFIG, type Config } from "../config";
import { CryptoPayClient } from "./cryptopay.client";

// Клиент Crypto Pay - общий для заказов (отмена удаляет счет) и оплаты (счет, опрос, истечение).
// null - платежка не Crypto Pay
export const CRYPTOPAY = Symbol("CRYPTOPAY");

@Module({
  providers: [
    {
      provide: CRYPTOPAY,
      inject: [CONFIG],
      useFactory: (c: Config) =>
        c.PAYMENT_PROVIDER === "cryptopay" && c.CRYPTOPAY_TOKEN
          ? new CryptoPayClient(c.CRYPTOPAY_TOKEN, c.CRYPTOPAY_NETWORK, c.CRYPTOPAY_API_URL)
          : null,
    },
  ],
  exports: [CRYPTOPAY],
})
export class CryptoPayModule {}
