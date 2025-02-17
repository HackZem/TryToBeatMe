import "./App.css";
import _ from "lodash";
import { useEffect, useState } from "react";
import Call from "./components/Call/Call";
import Strike from "./components/Strike/Strike";
import classNames from "classnames-ts";
import Button from "@mui/material/Button";
import { LayersModel } from "@tensorflow/tfjs";
import * as tf from "@tensorflow/tfjs";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";

export type TCell = 1 | -1 | 0;
type TPlayer = 1 | -1;
type TWinner = TPlayer | 0;
interface ICombination {
  line: number[];
  strike: TStrike;
}
type TGameMode = "2p" | "ai" | "train-ai";

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

interface ITransition {
  state: number[];
  action: number;
  player: TPlayer;
  winner: TWinner;
}

function App() {
  const [calls, setCalls] = useState<TCell[]>(_.times(9, () => 0));
  const [playerTurn, setPlayerTurn] = useState<TPlayer>(1);
  const [winner, setWinner] = useState<TWinner | null>(null);
  const [winningCombination, setWinningCombination] =
    useState<ICombination | null>(null);
  const [gameMode, setGameMode] = useState<TGameMode>("2p");

  //Neural Network
  const [model, setModel] = useState<LayersModel | null>(null);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [generations, setGenerations] = useState<number>(0);

  useEffect(() => {
    step(calls);
  }, [calls]);

  useEffect(() => {
    const loadModel = async () => {
      let model: LayersModel | null = null;
      try {
        model = await tf.loadLayersModel("localstorage://model");
      } catch (e) {
        console.log("Model not found");
      }

      if (model) {
        model.compile({
          loss: "meanSquaredError",
          optimizer: tf.train.adam(0.001),
        });
        setModel(model);
      } else {
        console.log("Model not found, creating new model");
        const model = createModel();
        setModel(model);
      }
    };
    loadModel();
  }, []);

  const predictionMove = async (model: LayersModel) => {
    const availableMoves = getAvilableMoves(calls);
    const state = _.clone(calls);
    const input = tf.tensor2d([state], [1, 9]);
    const prediction = model.predict(input) as tf.Tensor;
    const qValues = ((await prediction.array()) as number[][])[0];

    const mask = qValues.map((value, index) =>
      availableMoves.includes(index) ? value : -Infinity
    );

    const action = mask.indexOf(Math.max(...mask));
    input.dispose();
    prediction.dispose();

    return action;
  };

  const simulateTrainGeneration = async (
    model: LayersModel,
    epsilon: number
  ): Promise<ITransition[]> => {
    const calls: TCell[] = _.times(9, () => 0);
    let transitions: ITransition[] = [];
    let currentPlayer = 1;

    while (true) {
      const availableMoves = getAvilableMoves(calls);

      if (availableMoves.length === 0) {
        break;
      }

      const state = _.clone(calls);
      let action: number;

      if (epsilon > Math.random()) {
        action =
          availableMoves[Math.floor(Math.random() * availableMoves.length)];
      } else {
        const input = tf.tensor2d([state], [1, 9]);
        const prediction = model.predict(input) as tf.Tensor;
        const qValues = ((await prediction.array()) as number[][])[0];

        const mask = qValues.map((value, index) =>
          availableMoves.includes(index) ? value : -Infinity
        );

        action = mask.indexOf(Math.max(...mask));
        input.dispose();
        prediction.dispose();
      }

      calls[action] = currentPlayer as TCell;

      const result = checkWinner(calls);

      const transition = {
        state,
        action,
        player: currentPlayer as TPlayer,
        winner: 0 as TWinner,
      };

      transitions.push(transition);

      if (result !== null) {
        console.log("/////////////////////");
        console.log(result, "result");
        console.log(epsilon, "epsilon");
        console.log(`${calls[0]}  ${calls[1]}  ${calls[2]}`);
        console.log(`${calls[3]}  ${calls[4]}  ${calls[5]}`);
        console.log(`${calls[6]}  ${calls[7]}  ${calls[8]}`);
        console.log("/////////////////////");

        transitions = transitions.map((t) => ({
          ...t,
          winner: result,
        }));
        break;
      }

      currentPlayer = -currentPlayer;
    }

    // const applyDiscount = (
    //   transitions: ITransition[],
    //   reward: number,
    //   discount: number
    // ) => {
    //   let cumulativeReward = reward;
    //   return transitions
    //     .reverse()
    //     .map((t) => {
    //       cumulativeReward = t.reward + discount * cumulativeReward;
    //       return { ...t, reward: cumulativeReward };
    //     })
    //     .reverse();
    // };

    return transitions;
  };

  const calculateReward = (winner: TWinner | null, player: TPlayer) => {
    if (winner === 0) {
      return 0;
    }

    if (winner === player) {
      return 1;
    }

    return -1;
  };

  const trainOnGame = async (
    model: LayersModel,
    transitions: ITransition[],
    discount: number,
    learningRate: number
  ) => {
    const reverseTransitions = transitions.reverse();

    for (let i = 0; i < reverseTransitions.length; i++) {
      const { state, action, player, winner } = transitions[i];

      const tensorState = tf.tensor2d([state], [1, 9]);
      const prediction = model.predict(tensorState) as tf.Tensor;
      const qValues = ((await prediction.array()) as number[][])[0];

      let reward = calculateReward(winner, player);
      if (i !== 0) {
        const nextState = transitions[i - 1].state;
        const tensorNextState = tf.tensor2d([nextState], [1, 9]);
        const nextPrediction = model.predict(tensorNextState) as tf.Tensor;
        const nextQValues = ((await nextPrediction.array()) as number[][])[0];

        const nextAvilableMoves = getAvilableMoves(nextState as TCell[]);

        const mask = nextQValues.map((value, index) =>
          nextAvilableMoves.includes(index) ? value : -Infinity
        );

        reward = reward + discount * Math.max(...mask);

        tensorNextState.dispose();
        nextPrediction.dispose();
      }

      const targetState = _.clone(qValues);
      targetState[action] =
        (1 - learningRate) * qValues[action] + learningRate * reward;

      const tensorTarget = tf.tensor2d([targetState], [1, 9]);

      await model.fit(tensorState, tensorTarget, {
        epochs: 1,
        verbose: 0,
      });
      tensorState.dispose();
      tensorTarget.dispose();
      prediction.dispose();
    }
  };

  const trainModel = async () => {
    if (!model || isTraining) return;
    setIsTraining(true);

    const generations = 30000;
    let epsilon = 0.2;
    const discount = 0.9;
    const learningRate = 0.1;

    for (let i = 0; i < generations; i++) {
      const transitions = await simulateTrainGeneration(model, epsilon);

      await trainOnGame(model, transitions, discount, learningRate);

      epsilon = Math.max(...[0.2, epsilon * 0.995]);
      setGenerations(i + 1);

      await tf.nextFrame();
    }

    await model.save("localstorage://model");

    setIsTraining(false);
  };

  const createModel = (): LayersModel => {
    const model = tf.sequential();

    model.add(
      tf.layers.dense({ units: 64, inputShape: [9], activation: "relu" })
    );
    model.add(tf.layers.dense({ units: 64, activation: "relu" }));
    model.add(tf.layers.dense({ units: 9, activation: "linear" }));

    model.compile({
      loss: "meanSquaredError",
      optimizer: tf.train.adam(0.001),
    });

    return model;
  };

  const onCallClickHandler = async (id: number) => {
    if (calls[id] || winner || (gameMode === "ai" && playerTurn === -1)) return;

    setCalls((prev) => ((prev[id] = playerTurn), [...prev]));
    setPlayerTurn((prev) => (prev === 1 ? -1 : 1));
  };

  const getAvilableMoves = (calls: TCell[]): number[] => {
    return calls.reduce((acc, call, index) => {
      if (!call) {
        acc.push(index);
      }

      return acc;
    }, [] as number[]);
  };

  const checkWinner = (calls: TCell[]): TWinner | null => {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination.line;
      if (calls[a] && calls[a] === calls[b] && calls[a] === calls[c]) {
        return calls[a] as TPlayer;
      }
    }

    if (calls.every((call) => call)) {
      return 0;
    }

    return null;
  };

  const getWinnerCombination = (calls: TCell[]): ICombination | null => {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination.line;
      if (calls[a] && calls[a] === calls[b] && calls[a] === calls[c]) {
        return combination;
      }
    }

    return null;
  };

  const step = (calls: TCell[]) => {
    const winnerStatus = checkWinner(calls);

    if (winnerStatus === 0) {
      setWinner(winnerStatus);
    } else if (winnerStatus) {
      setWinner(winnerStatus);
      setWinningCombination(getWinnerCombination(calls));
    }

    const predictionAsync = async () => {
      if (gameMode === "ai" && playerTurn === -1 && winnerStatus === null) {
        const move = await predictionMove(model as LayersModel);
        setCalls((prev) => ((prev[move] = -1), [...prev]));
        setPlayerTurn(1);
      }
    };

    predictionAsync();
  };

  const restart = () => {
    setCalls(_.times(9, () => 0));
    setPlayerTurn(1);
    setWinner(null);
    setWinningCombination(null);
  };

  return (
    <div className="min-h-screen flex justify-center items-center">
      <div className="relative w-180 rounded-2xl">
        <div
          className={classNames(
            "absolute w-full bottom-[50%] left-0 bg-gray-800 rounded-2xl overflow-hidden mt-1 flex justify-between items-start gap-10 p-8 z-1 transition-[top] duration-700 ease-in-out",
            winner !== null ? "top-[-15%]" : "top-0"
          )}
        >
          <ToggleButtonGroup
            size="large"
            className="[&>*]:!text-yellow-200 [&>*]:w-18 [&>*]:!border-0 
            [&>*:not(:last-child)]:!border-r-2 [&>*]:!border-solid [&>*]:!border-[#1E2939] 
            [&>*]:!bg-blue-900 [&>.Mui-selected]:!bg-blue-700 
            [&>*]:!text-[1.3rem] [&>*]:!p-[10px]"
            value={gameMode}
            exclusive
            onChange={(_, newMode: string | null) => {
              if (newMode !== null) {
                setGameMode(newMode as TGameMode);
              }
            }}
            aria-label="game mode"
          >
            <ToggleButton value="2p" aria-label="left aligned" disableRipple>
              2P
            </ToggleButton>
            <ToggleButton value="ai" aria-label="centered" disableRipple>
              AI
            </ToggleButton>
            <ToggleButton
              value="train-ai"
              aria-label="right aligned"
              disableRipple
            >
              T
            </ToggleButton>
          </ToggleButtonGroup>

          {gameMode === "train-ai" && (
            <Button
              className="!bg-green-700 w-50 h-14 !text-2xl !shadow-none hover:!bg-green-800 active:!bg-green-950"
              disableRipple
              variant="contained"
              onClick={trainModel}
              disabled={isTraining || !model}
            >
              Train model
            </Button>
          )}
        </div>
        <div className="bg-gray-800 w-full h-180 rounded-2xl p-6 relative z-10 overflow-hidden">
          <ol className="grid grid-cols-3 grid-rows-3 gap-6 w-full h-full">
            {_.times(9, (i) => (
              <Call
                key={i}
                isOpacity={
                  !(winner === null) && !winningCombination?.line.includes(i)
                }
                value={calls[i] === 1 ? "X" : calls[i] === -1 ? "O" : undefined}
                onClick={() => {
                  onCallClickHandler(i);
                }}
              />
            ))}
          </ol>
          {<Strike strike={winningCombination?.strike ?? null} />}
        </div>
        <div
          className={classNames(
            "absolute w-full top-[50%] left-0 bg-gray-800 rounded-2xl overflow-hidden mt-1 flex justify-center items-end p-8 z-1 transition-[bottom] duration-700 ease-in-out",
            winner !== null ? "bottom-[-16%]" : "bottom-0"
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
      </div>
    </div>
  );
}

export default App;
