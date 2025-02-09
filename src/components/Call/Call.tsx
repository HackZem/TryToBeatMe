import { FC } from "react";
import { TCell } from "../../App";

interface IProps extends React.ComponentPropsWithoutRef<"li"> {
  props?: HTMLLIElement;
  children?: TCell;
  isOpacity?: boolean;
}

const Call: FC<IProps> = ({ children, isOpacity, ...props }) => {
  return (
    <li
      {...props}
      className={`bg-[#1C1C1A] rounded-2xl flex justify-center items-center text-center text-[10rem] font-bold text-white h-full ${
        children || isOpacity ? "" : "hover:bg-[#121211]"
      }`}
    >
      <span
        className={`leading-[24px] h-[36px] select-none ${
          children === "X" ? "text-red-500" : "text-blue-600"
        } ${isOpacity ? "opacity-50" : ""}`}
      >
        {children}
      </span>
    </li>
  );
};

export default Call;
