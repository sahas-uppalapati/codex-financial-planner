const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export const money = (n: number) =>
  currencyFormatter.format(Object.is(n, -0) ? 0 : n);

export const compactMoney = (n: number) =>
  compactCurrencyFormatter.format(n);

export const percent = (n: number) =>
  percentFormatter.format(n);

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

export const sourceDate = (isoDate: string) => dateFormatter.format(new Date(isoDate));
