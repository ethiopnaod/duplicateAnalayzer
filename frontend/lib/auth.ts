"use server"

import { SERVER_ENV } from "@/config/env"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { SignJWT } from "jose"

type SignInActionPayload = {
    username: string
    password: string
}

export const signInAction = async ({ username, password }: SignInActionPayload) => {
    const cookie = await cookies()

    // Debug logging to help identify the issue
    console.log("Login attempt:", { 
        providedUsername: username, 
        providedPassword: password,
        expectedUsername: SERVER_ENV.USERNAME,
        expectedPassword: SERVER_ENV.PASSWORD,
        usernameMatch: username === SERVER_ENV.USERNAME,
        passwordMatch: password === SERVER_ENV.PASSWORD
    })

    if (username !== SERVER_ENV.USERNAME || password !== SERVER_ENV.PASSWORD) {
        return {
            success: false,
            message: "Invalid username or password",
        }
    }

    // Signing Token with `jose`
    const secret = new TextEncoder().encode(SERVER_ENV.JWT_SECRET)

    const token = await new SignJWT({ username })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h") // 1 hour expiry
        .setIssuedAt()
        .sign(secret)

    cookie.set("token", token, {
        httpOnly: true,
       // secure: process.env.NODE_ENV === "production",
        path: "/",
    })

    revalidatePath("/", "layout")

    return {
        success: true,
        message: "User signed in successfully.",
    }
}


export const logoutAction = async () => {
    const cookie = await cookies()
    cookie.delete("token")
    
    revalidatePath("/", "layout")
}
