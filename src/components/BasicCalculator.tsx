import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function BasicCalculator() {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".");
    }
  };

  const clear = () => {
    setDisplay("0");
    setExpression("");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const handleClearAll = () => {
    clear();
  };

  const toggleSign = () => {
    const value = parseFloat(display);
    setDisplay(String(-value));
  };

  const calculateSquareRoot = () => {
    const value = parseFloat(display);
    if (value < 0) {
      setDisplay("Error");
      return;
    }
    const result = Math.sqrt(value);
    setDisplay(String(result));
    setExpression(`√${value} = ${result}`);
  };

  const calculatePercentage = () => {
    const value = parseFloat(display);
    const result = value / 100;
    setDisplay(String(result));
  };

  const performOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
      setExpression(`${inputValue} ${nextOperation}`);
    } else if (operation) {
      const currentValue = previousValue || 0;
      let newValue = currentValue;

      switch (operation) {
        case "+":
          newValue = currentValue + inputValue;
          break;
        case "-":
          newValue = currentValue - inputValue;
          break;
        case "×":
          newValue = currentValue * inputValue;
          break;
        case "÷":
          newValue = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
      }

      setDisplay(String(newValue));
      setPreviousValue(newValue);
      setExpression(`${newValue} ${nextOperation}`);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      let newValue = previousValue;

      switch (operation) {
        case "+":
          newValue = previousValue + inputValue;
          break;
        case "-":
          newValue = previousValue - inputValue;
          break;
        case "×":
          newValue = previousValue * inputValue;
          break;
        case "÷":
          newValue = inputValue !== 0 ? previousValue / inputValue : 0;
          break;
      }

      setExpression(`${previousValue} ${operation} ${inputValue} =`);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  return (
    <TooltipProvider>
      <Card className="p-3 sm:p-6 max-w-md mx-auto shadow-lg">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">Basic Calculator</h2>
          <Button
            onClick={handleClearAll}
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9"
          >
            Clear All
          </Button>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 sm:p-6 mb-4 sm:mb-6 border border-border">
          {expression && (
            <div className="text-xs sm:text-sm text-muted-foreground font-mono mb-2 min-h-[16px] sm:min-h-[20px]">
              {expression}
            </div>
          )}
          <div className="text-2xl sm:text-4xl font-mono font-bold text-foreground break-all min-h-[32px] sm:min-h-[48px]">
            {display}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={clear} 
                variant="secondary" 
                className="h-12 sm:h-16 text-base sm:text-xl font-semibold transition-all hover:scale-105 active:scale-95 touch-manipulation"
              >
                C
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={toggleSign} 
                variant="secondary" 
                className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
              >
                ±
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle positive/negative</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={calculatePercentage} 
                variant="secondary" 
                className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
              >
                %
              </Button>
            </TooltipTrigger>
            <TooltipContent>Divide by 100</TooltipContent>
          </Tooltip>

          <Button 
            onClick={() => performOperation("÷")} 
            variant="secondary" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            ÷
          </Button>

          <Button 
            onClick={() => inputDigit("7")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            7
          </Button>
          <Button 
            onClick={() => inputDigit("8")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            8
          </Button>
          <Button 
            onClick={() => inputDigit("9")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            9
          </Button>
          <Button 
            onClick={() => performOperation("×")} 
            variant="secondary" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            ×
          </Button>

          <Button 
            onClick={() => inputDigit("4")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            4
          </Button>
          <Button 
            onClick={() => inputDigit("5")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            5
          </Button>
          <Button 
            onClick={() => inputDigit("6")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            6
          </Button>
          <Button 
            onClick={() => performOperation("-")} 
            variant="secondary" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            −
          </Button>

          <Button 
            onClick={() => inputDigit("1")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            1
          </Button>
          <Button 
            onClick={() => inputDigit("2")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            2
          </Button>
          <Button 
            onClick={() => inputDigit("3")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            3
          </Button>
          <Button 
            onClick={() => performOperation("+")} 
            variant="secondary" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            +
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={calculateSquareRoot} 
                variant="outline" 
                className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
              >
                √
              </Button>
            </TooltipTrigger>
            <TooltipContent>Square root</TooltipContent>
          </Tooltip>

          <Button 
            onClick={() => inputDigit("0")} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            0
          </Button>
          <Button 
            onClick={inputDot} 
            variant="outline" 
            className="h-12 sm:h-16 text-base sm:text-xl transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            .
          </Button>
          <Button 
            onClick={handleEquals} 
            variant="default" 
            className="h-12 sm:h-16 text-base sm:text-xl font-bold transition-all hover:scale-105 active:scale-95 touch-manipulation"
          >
            =
          </Button>
        </div>
      </Card>
    </TooltipProvider>
  );
}
