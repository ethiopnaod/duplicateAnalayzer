"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signInAction } from "@/lib/auth"
import { EyeClosedIcon, EyeIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { FormEvent, useState, useTransition } from "react"
import { toast } from "sonner"

const LoginPage = () => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, startTransition] = useTransition()
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()


    const handleLogin = async (ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault()

        if (username.trim().length === 0) {
            toast.error("Please provide username")
            return;
        }

        if (password.trim().length === 0) {
            toast.error("Please provide password")
            return;
        }


        startTransition(async () => {
            const response = await signInAction({ username, password })
            if (!response.success) {
                toast.error(response.message)
                return;
            }

            toast.success("User signed in successfully.")
            router.push("/dashboard")
        })
    }

    return (
        <main className="flex h-screen justify-center items-center">
            <form className="space-y-2" onSubmit={handleLogin}>
                <Card className="rounded-md shadow-none border-none">
                    <CardHeader>
                        <CardTitle className="text-3xl text-center">Sign In</CardTitle>
                        <CardDescription className="text-center">
                            Analyze your data with ease.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            <Label>Username</Label>
                            <Input
                                value={username}
                                onChange={(ev) => {
                                    setUsername(ev.target.value)
                                }}
                                className="h-[2.8rem] min-w-[20rem]"
                                type="text"
                                placeholder="nesru g" />

                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <div className="relative">
                                <Input
                                    value={password}
                                    onChange={(ev) => {
                                        setPassword(ev.target.value)
                                    }}
                                    className="h-[2.8rem] min-w-[20rem]" type={showPassword ? "text" : "password"}
                                    placeholder="******" />
                                <Button
                                    type="button"
                                    variant={"link"}
                                    onClick={() => {
                                        setShowPassword(prev => !prev)
                                    }}
                                    className="absolute right-0 top-1/2 -translate-y-1/2"
                                >
                                    {showPassword ? <EyeClosedIcon /> : <EyeIcon />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="h-[2.8rem] min-w-[20rem]" disabled={isLoading}>
                            {isLoading ? "Signing..." : "Sign In"}</Button>
                    </CardFooter>

                </Card>
            </form>
        </main>
    )
}

export default LoginPage