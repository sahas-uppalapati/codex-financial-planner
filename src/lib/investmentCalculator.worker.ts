import { calculateInvestments } from "./investmentCalculator";
import type { CalculatorRequest } from "./investmentCalculator";

self.onmessage = (event: MessageEvent<CalculatorRequest>) => {
  try {
    self.postMessage({ results: calculateInvestments(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Unable to calculate these inputs.",
    });
  }
};
