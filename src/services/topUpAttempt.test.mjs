// Выбор попытки оплаты в плашке Steam (src/services/topUpAttempt.ts). Запуск: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { attemptInput, nextAttempt } from "./topUpAttempt.ts";

const gaben = attemptInput({ steamLogin: "gaben", amount: 500, currency: "USD" });
const newLogin = attemptInput({ steamLogin: "new_login", amount: 500, currency: "USD" });
const notAsked = async () => assert.fail("статус заказа не должен запрашиваться");
const status = (finished) => async () => finished;

test("первое нажатие - новая попытка для этих данных", async () => {
  const a = await nextAttempt(null, gaben, notAsked);
  assert.equal(a.input, gaben);
  assert.ok(a.key);
  assert.equal(a.orderId, undefined);
});

test("те же данные, заказ не завершен - та же попытка и тот же ключ (двойной клик, повтор)", async () => {
  const prev = { key: "k1", input: gaben, orderId: "o1" };
  assert.equal(await nextAttempt(prev, gaben, status(false)), prev);
});

test("те же данные, заказа еще нет (ошибка сети до ответа) - та же попытка", async () => {
  const prev = { key: "k1", input: gaben };
  assert.equal(await nextAttempt(prev, gaben, notAsked), prev);
});

test("те же данные, заказ завершен - новая попытка (ревью F7)", async () => {
  const next = await nextAttempt({ key: "k1", input: gaben, orderId: "o1" }, gaben, status(true));
  assert.notEqual(next.key, "k1");
  assert.equal(next.orderId, undefined);
});

test("статус заказа узнать не удалось - та же попытка (дубля не будет)", async () => {
  const prev = { key: "k1", input: gaben, orderId: "o1" };
  const failing = async () => {
    throw new Error("нет связи");
  };
  assert.equal(await nextAttempt(prev, gaben, failing), prev);
});

test("другие данные формы - новая попытка, статус прежнего заказа не нужен", async () => {
  const next = await nextAttempt({ key: "k1", input: gaben, orderId: "o1" }, newLogin, notAsked);
  assert.notEqual(next.key, "k1");
  assert.equal(next.input, newLogin);
});

test("ревью F10: форму изменили, пока шел запрос статуса, - запоздавшая старая попытка не подходит новым данным", async () => {
  // как в компоненте: attemptRef и клик, чей запрос статуса прошлого заказа висит
  let ref = { key: "k1", input: gaben, orderId: "o1" };
  let release;
  const gate = new Promise((r) => (release = r));
  const click = nextAttempt(ref, gaben, async () => {
    await gate;
    return false;
  });
  // пользователь меняет логин на new_login (прежний код здесь сбрасывал ref - и сброс затирался ниже)
  release();
  ref = await click; // запоздавшая запись в ref попытки для старых данных
  assert.equal(ref.key, "k1");

  const next = await nextAttempt(ref, newLogin, notAsked); // нажатие с новыми данными
  assert.notEqual(next.key, "k1");
  assert.equal(next.input, newLogin);
});
