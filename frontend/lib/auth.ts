"use server"

import { ENV } from "@/config/env"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { SignJWT } from "jose"

type SignInActionPayload = {
    username: string
    password: string
}

export const signInAction = async ({ username, password }: SignInActionPayload) => {
    const cookie = await cookies()

    if (username !== ENV.USERNAME || password !== ENV.PASSWORD) {
        return {
            success: false,
            message: "Invalid username or password",
        }
    }

    // Signing Token with `jose`
    const secret = new TextEncoder().encode(ENV.JWT_SECRET)

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
