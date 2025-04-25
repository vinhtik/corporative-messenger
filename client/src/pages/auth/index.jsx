import Background from "@/assets/login.jpg"
import Welcome from "@/assets/logo.svg"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs"
import { Table } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client.js"
import { LOGIN_ROUTE, SIGNUP_ROUTE } from "@/utils/constants.js"
import { useNavigate } from "react-router-dom"
import { useAppStore } from "@/store"

const Auth = () => {
    const navigate = useNavigate();
    const { setUserInfo } = useAppStore();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const validateLogin = () => {
        if(!email.length) {
            toast.error("Почта обязательна");
            return false;
        }
        if(!password.length){
            toast.error("Пароль обязателен")
            return false;
        }
        return true;
    };


    const validateSignup = () => {
        if(!email.length) {
            toast.error("Почта обязательна");
            return false;
        }
        if(!password.length){
            toast.error("Пароль обязателен")
            return false;
        }
        if(password !== confirmPassword){
            toast.error("Пароли должны совпадать")
            return false
        }
        return true;
    };

    const handleLogin = async () => {
        if(validateLogin()) {
            const response = await apiClient.post(LOGIN_ROUTE, {email, password}, {withCredentials: true});
            if(response.data.user.id){
                setUserInfo(response.data.user);
                if(response.data.user.profileSetup) navigate("/chat");
                else navigate("/profile");
            }
            console.log({response});
        }

    }

    const handleSignup = async () => {
        if(validateSignup()){
            const response = await apiClient.post(SIGNUP_ROUTE, { email, password }, {withCredentials: true});
            if(response.status === 201){
                navigate("/profile");
            }
            console.log({response});
        }
    };

  return (
    <div className="h-[100vh] w-[100vw] flex items-center justify-center">
        <div className="relative rounded-2xl h-[80vh] bg-white border-2 border-white text-opacity-90 shadow-2xl w-[80vw] xl:w-[50vw]">

        <div className="absolute inset-0 rounded-2xl
           bg-[url(@/assets/login.jpg)] bg-no-repeat 
             bg-cover opacity-0 z-0 animate-[pulse_10s_ease-in-out_infinite]">
        </div>
            
            <div className="m-5 relative z-10 flex flex-col gap-10 items-center justify-center">
                <div className="flex items-center justify-center flex-col">
                    <div className="flex items-center justify-center">
                        <h1 className="text-5xl font-bold md:text-6xl">Welcome</h1>
                        <img src={Welcome} alt="Welcome" className="h-[5rem]" />
                    </div>
                    <p className="font-medium text-center">авантюрный, творческий корпоративный мессенджер</p>
                </div>
                <div className="flex items-center justify-center w-full">
                    <Tabs className="w-3/4" defaultValue="login">
                        <TabsList className="bg-transparent rounded-none w-full">
                            <TabsTrigger value="login" className="data-[state=active]:bg-transparent text-black text-opacity-90 border-b-2 rounded-none w-[50%] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:border-b-green-700 p-3 transition-all duration-300 ">Авторизация</TabsTrigger>
                            <TabsTrigger value="signup" className="data-[state=active]:bg-transparent text-black text-opacity-90 border-b-2 rounded-none w-[50%] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:border-b-green-700 p-3 transition-all duration-300 ">Регистрация</TabsTrigger>
                        </TabsList>
                        <TabsContent className="flex flex-col gap-5 mt-10" value="login">
                            <Input 
                                placeholder="Email" 
                                type="email" 
                                className="rounded-full p-6" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)}
                            />
                             <Input 
                                placeholder="Password" 
                                type="password" 
                                className="rounded-full p-6" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <Button className="rounded-full p-6" onClick={handleLogin}>Вход</Button>
                        </TabsContent>
                        <TabsContent className="flex flex-col gap-5 mt-10" value="signup">
                        <Input 
                                placeholder="Email" 
                                type="email" 
                                className="rounded-full p-6" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)}
                            />
                             <Input 
                                placeholder="Пароль" 
                                type="password" 
                                className="rounded-full p-6" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        <Input 
                                placeholder="Подтвердите пароль" 
                                type="password" 
                                className="rounded-full p-6" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                              <Button className="rounded-full p-6" onClick={handleSignup}>Зарегистрироваться</Button>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            </div> 
    </div>
    
  )
}

export default Auth