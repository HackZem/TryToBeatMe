import { FC } from "react";
import { TStrike } from "../../App";
import classNames from "classnames-ts";
import "./Strike.scss";

interface IProps {
  strike: TStrike | null;
}

const Strike: FC<IProps> = ({ strike }) => {
  return (
    <div
      className={classNames(
        "absolute top-0 bottom-full left-0 right-full bg-emerald-100",
        strike
      )}
    />
  );
};

export default Strike;
