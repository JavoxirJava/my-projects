import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((x) => x.includes("="))
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1)];
    }),
);
test("desktop and mobile project lifecycle, roles and navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Kirish", exact: true }).waitFor();
  await page.screenshot({ path: ".private/login-desktop.png", fullPage: true });
  await page.getByLabel("Login", { exact: true }).fill(env.ADMIN_LOGIN);
  await page.getByLabel("Parol", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Loyihalaringiz, bir qarashda." }),
  ).toBeVisible();
  const groupName = "Browser test " + Date.now();
  await page
    .getByRole("button", { name: "Guruh qo‘shish", exact: true })
    .click();
  await page.getByLabel("Guruh nomi").fill(groupName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guruh qo‘shish", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText(groupName, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yopish", exact: true }).click();
  await page
    .getByRole("button", { name: "Loyiha qo‘shish", exact: true })
    .click();
  await page.getByLabel("Loyiha nomi").fill("Atlas workspace");
  await page
    .getByLabel("Qisqa tavsif")
    .fill(
      "Loyihalar, bir nechta havola va rollarni sinash uchun vaqtinchalik test.",
    );
  await page
    .getByLabel("Guruh", { exact: true })
    .selectOption({ label: groupName });
  await page.getByLabel("Holati", { exact: true }).selectOption("live");
  await page.getByLabel("Bajarilishi").selectOption("team");
  await page.getByLabel("Teglar").fill("test, workspace");
  await page.getByRole("button", { name: "Havolalar (0)" }).click();
  await page
    .getByRole("button", { name: "Havola qo‘shish", exact: true })
    .click();
  await page.getByLabel("Nomi", { exact: true }).fill("Asosiy sayt");
  await page.getByLabel("Manzil", { exact: true }).fill("https://example.com");
  await page.getByLabel("Havola izohi").fill("Test manzili");
  await page
    .getByRole("button", { name: "Havola qo‘shish", exact: true })
    .click();
  await page.getByLabel("Nomi", { exact: true }).nth(1).fill("Bot");
  await page
    .getByLabel("Manzil", { exact: true })
    .nth(1)
    .fill("https://t.me/testbot");
  await page.getByRole("button", { name: "Hisoblar (0)" }).click();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Hisob qo‘shish", exact: true })
      .click();
    await page
      .getByLabel("Hisob nomi", { exact: true })
      .nth(i)
      .fill(i ? "Operator" : "Administrator");
    await page
      .getByLabel("Rol", { exact: true })
      .nth(i)
      .fill(i ? "Operator" : "Admin");
    await page
      .getByLabel("Login", { exact: true })
      .nth(i)
      .fill(i ? "operator" : "admin");
    await page
      .getByLabel("Parol", { exact: true })
      .nth(i)
      .fill("test-secret-" + i);
  }
  await page.getByRole("button", { name: "Reja va monitoring" }).click();
  await page.getByRole("button", { name: "Vazifa qo‘shish" }).click();
  await page.getByLabel("Vazifa matni").fill("Birinchi bosqich");
  await page.getByLabel("Eslatmalar", { exact: true }).fill("Bu sinov yozuvi.");
  await page.getByLabel("Domen tugash sanasi").fill("2026-12-31");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Atlas workspace", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".private/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("heading", { name: "Atlas workspace", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Administrator", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Parolni ko‘rsatish", exact: true })
    .first()
    .click();
  await expect(page.getByText("test-secret-0", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Parolni yashirish", exact: true })
    .click();
  await page.getByRole("button", { name: "Tahrirlash", exact: true }).click();
  await page.getByLabel("Loyiha nomi").fill("Atlas workspace updated");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("heading", { name: "Atlas workspace updated", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Parolni ko‘rsatish", exact: true })
    .first()
    .click();
  await expect(page.getByText("test-secret-0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yopish", exact: true }).click();
  await page
    .getByRole("button", { name: "Sevimlilarga qo‘shish", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Sevimlilar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Atlas workspace updated", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ro‘yxat ko‘rinishi" }).click();
  await page.getByLabel("Loyihalarni qidirish").fill("no-such-project");
  await expect(
    page.getByRole("heading", { name: "Mos loyiha topilmadi" }),
  ).toBeVisible();
  await page.getByLabel("Loyihalarni qidirish").fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Menyu", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kartochka ko‘rinishi" }).click();
  await page.screenshot({
    path: ".private/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("heading", { name: "Atlas workspace updated", exact: true })
    .click();
  await page.screenshot({
    path: ".private/details-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Arxivlash", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Menyu", exact: true }).click();
  await page.getByRole("button", { name: "Arxiv", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Atlas workspace updated", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menyu", exact: true }).click();
  await page.getByRole("button", { name: "Sozlamalar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Zaxiralar tarixi", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
