import { animationDefaultOptions } from "@/lib/utils.js";
import Lottie from "react-lottie";

const EmptyChatContainer = () => {
  return (
    <div className="flex-1 md:bg-background md:flex flex-col justify-center items-center hidden duration-1000 transition-all">
        <Lottie 
        isClickToPauseDisabled={true}
        height={200}
        width={200}
        options={animationDefaultOptions}
        />
        <div className="text-opaciy-80 text-foreground flex flex-col gap-5 items-center mt-10 lg:text-4xl text-3xl transition-all duration-200 text-center">
          <h3 className="poppins-medium">
            Hi<span className="text-primary">!</span> Welcome to
            <span className="text-primary"> Corp-messenger </span> App<span className="text text-primary">.</span>
          </h3>
        </div>
    </div>
  )
}

export default EmptyChatContainer;