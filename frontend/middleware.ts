import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, secret)
        return payload
    } catch {
        return null
    }
}

export default async function middleware(req: NextRequest) {
    const token = req.cookies.get("token")?.value
    const pathname = req.nextUrl.pathname

    console.log({ pathname, token })

    if (pathname === "/") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    if (!token && !pathname.includes("/auth")) {
        return NextResponse.redirect(new URL("/auth/login", req.url))
    }

    if (!token && pathname.includes("/auth")) {
        return NextResponse.next()
    }

    const payload = await verifyToken(token || "")

    if (!payload) {
        // Invalid / expired token → clear cookie & redirect
        const res = NextResponse.redirect(new URL("/auth/login", req.url))
        
        res.cookies.delete("token")
        return res
    }

    if (pathname.includes("/auth")) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // ✅ Token valid → allow access
    return NextResponse.next()
}

// Apply to protected routes only
export const config = {
    matcher: ["/dashboard/:path*", "/", "/auth/:path"],
}
