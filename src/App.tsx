import "./App.css";
import _ from "lodash";
import { useEffect, useState } from "react";
import Call from "./components/Call/Call";
import Strike from "./components/Strike/Strike";
import classNames from "classnames-ts";
import Button from "@mui/material/Button";

export type TCell = "X" | "O" | null;
type TPlayer = "X" | "O";
type TWinner = TPlayer | "XO";
interface ICombination {
  line: number[];
  strike: TStrike;
}

export type TStrike =
  | "horizontal-1"
  | "horizontal-2"
  | "horizontal-3"
  | "vertical-1"
  | "vertical-2"
  | "vertical-3"
  | "diagonal-1"
  | "diagonal-2";

const winningCombinations: ICombination[] = [
  { line: [0, 1, 2], strike: "vertical-1" },
  { line: [3, 4, 5], strike: "vertical-2" },
  { line: [6, 7, 8], strike: "vertical-3" },
  { line: [0, 3, 6], strike: "horizontal-1" },
  { line: [1, 4, 7], strike: "horizontal-2" },
  { line: [2, 5, 8], strike: "horizontal-3" },
  { line: [0, 4, 8], strike: "diagonal-1" },
  { line: [2, 4, 6], strike: "diagonal-2" },
];

function App() {
  const [calls, setCalls] = useState<TCell[]>(_.times(9, () => null));
  const [playerTurn, setPlayerTurn] = useState<TPlayer>("X");
  const [winner, setWinner] = useState<TWinner | null>(null);
  const [winningCombination, setWinningCombination] =
    useState<ICombination | null>(null);

  useEffect(() => {
    step(calls);
  }, [calls]);

  const onCallClickHandler = (id: number) => {
    if (calls[id] || winner) return;

    setCalls((prev) => ((prev[id] = playerTurn), [...prev]));
    setPlayerTurn((prev) => (prev === "X" ? "O" : "X"));
  };

  const step = (calls: TCell[]) => {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination.line;
      if (calls[a] && calls[a] === calls[b] && calls[a] === calls[c]) {
        setWinner(calls[a] as TPlayer);
        setWinningCombination(combination);
      }
    }

    if (calls.every((call) => call)) {
      setWinner("XO");
    }
  };

  const restart = () => {
    setCalls(_.times(9, () => null));
    setPlayerTurn("X");
    setWinner(null);
    setWinningCombination(null);
  };

  return (
    <div className="min-h-screen flex justify-center items-center">
      <div className="relative w-180 h-205 overflow-hidden rounded-2xl">
        <div
          className={classNames(
            "absolute w-full top-0 left-0 bg-gray-800 rounded-2xl overflow-hidden mt-1 flex justify-center items-end p-8 transition-[height] duration-700 ease-in-out",
            winner ? "h-full" : "h-0"
          )}
        >
          <Button
            disableRipple
            variant="contained"
            className="!bg-green-700 w-50 h-15 !text-2xl !shadow-none hover:!bg-green-800 active:!bg-green-950"
            onClick={restart}
          >
            Try Again
          </Button>
        </div>

        <div className="bg-gray-800 w-full h-180 rounded-2xl p-6 relative">
          <ol className="grid grid-cols-3 grid-rows-3 gap-6 w-full h-full">
            {_.times(9, (i) => (
              <Call
                key={i}
                isOpacity={!!winner && !winningCombination?.line.includes(i)}
                onClick={() => {
                  onCallClickHandler(i);
                }}
              >
                {calls[i]}
              </Call>
            ))}
          </ol>
          {<Strike strike={winningCombination?.strike ?? null} />}
        </div>
      </div>
    </div>
  );
}

export default App;
