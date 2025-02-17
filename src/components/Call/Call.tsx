import { FC } from "react";

interface IProps extends React.ComponentPropsWithoutRef<"li"> {
  props?: HTMLLIElement;
  value?: "X" | "O";
  isOpacity?: boolean;
}

const Call: FC<IProps> = ({ value, isOpacity, ...props }) => {
  return (
    <li
      {...props}
      className={`bg-[#171716] rounded-2xl flex justify-center items-center text-center text-[10rem] font-bold text-white h-full ${
        value || isOpacity ? "" : "hover:bg-[#121211]"
      }`}
    >
      <span
        className={`leading-[24px] h-[36px] select-none ${
          value === "X" ? "text-red-500" : "text-blue-600"
        } ${isOpacity ? "opacity-50" : ""}`}
      >
        {value}
      </span>
    </li>
  );
};

export default Call;
